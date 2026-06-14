"""Heuristic parser to detect references from a pasted plain-text list."""
import re
from typing import List
from models import Reference

DOI_RE = re.compile(r"\b(10\.\d{4,9}/[-._;()/:A-Z0-9]+)\b", re.IGNORECASE)
YEAR_RE = re.compile(r"\(?\b(19|20)\d{2}\b\)?")
PAGES_RE = re.compile(r"\b(\d{1,5}\s*[-–—]\s*\d{1,5})\b")
VOL_ISSUE_RE = re.compile(r"\b(\d+)\s*\(\s*(\d+)\s*\)")
URL_RE = re.compile(r"https?://[^\s]+")
LEADING_NUM_RE = re.compile(r"^\s*(?:\[\d+\]|\d+\.|\d+\))\s*")


def _split_entries(text: str) -> List[str]:
    """Split raw paste into individual reference strings."""
    text = text.replace("\r", "")
    # Strategy 1: lines starting with a number marker "1." "[1]" "1)"
    if re.search(r"^\s*(?:\[\d+\]|\d+[.)])\s+", text, re.MULTILINE):
        chunks = re.split(r"(?m)^\s*(?=(?:\[\d+\]|\d+[.)])\s)", text)
        return [c.strip() for c in chunks if c.strip()]
    # Strategy 2: blank-line separated
    if "\n\n" in text:
        return [p.strip() for p in text.split("\n\n") if p.strip()]
    # Fallback: each line is a reference
    return [l.strip() for l in text.splitlines() if l.strip()]


def _parse_authors(segment: str) -> List[str]:
    """Parse the authors segment (before the year)."""
    segment = segment.strip().rstrip(".,;")
    if not segment:
        return []
    # Normalize ' and ' / ' & ' separator
    segment = re.sub(r"\s*&\s*", ", ", segment)
    segment = re.sub(r"\s+and\s+", ", ", segment)
    # Split into individual author tokens.
    # APA style: "Family, F. M., Family2, A. B., & Family3, C."
    # We want to recombine "Family, F." pairs since the comma inside is the separator
    parts = [p.strip() for p in re.split(r",\s*", segment) if p.strip()]
    authors: List[str] = []
    i = 0
    while i < len(parts):
        token = parts[i]
        # If next token looks like initials only (e.g., "J." or "J. M."), combine
        if i + 1 < len(parts) and re.match(r"^[A-Z]\.(?:\s*[A-Z]\.)*$", parts[i + 1].rstrip(".")) is not None:
            authors.append(f"{token}, {parts[i + 1]}")
            i += 2
        elif i + 1 < len(parts) and re.match(r"^[A-Z](?:\.\s*[A-Z])*\.?$", parts[i + 1]) is not None:
            authors.append(f"{token}, {parts[i + 1]}")
            i += 2
        else:
            authors.append(token)
            i += 1
    # Filter trivial fragments
    return [a for a in authors if len(a) > 1]


def parse_reference_line(line: str) -> Reference:
    """Best-effort parse a single reference string into a Reference."""
    original = line
    line = LEADING_NUM_RE.sub("", line).strip()

    # Extract DOI + URL (DOI first, so we strip any "https://doi.org/{doi}" prefix together)
    doi = ""
    # match a DOI optionally prefixed by https://doi.org/ or doi:
    m_doi_with_prefix = re.search(
        r"(?:https?://(?:dx\.)?doi\.org/|doi:\s*)?(10\.\d{4,9}/[-._;()/:A-Z0-9]+)",
        line,
        re.IGNORECASE,
    )
    if m_doi_with_prefix:
        doi = m_doi_with_prefix.group(1).rstrip(".,;)")
        line = line.replace(m_doi_with_prefix.group(0), "").strip()

    url = ""
    m_url = URL_RE.search(line)
    if m_url:
        url = m_url.group(0).rstrip(".,;)")
        line = line.replace(m_url.group(0), "").strip()

    # Extract pages
    pages = ""
    m_pages = PAGES_RE.search(line)
    if m_pages:
        pages = m_pages.group(1).replace("–", "-").replace("—", "-").replace(" ", "")

    # Extract volume(issue)
    volume = ""
    issue = ""
    m_vi = VOL_ISSUE_RE.search(line)
    if m_vi:
        volume = m_vi.group(1)
        issue = m_vi.group(2)

    # Find year
    year = ""
    m_year = YEAR_RE.search(line)
    authors_seg = ""
    rest = line
    if m_year:
        year = m_year.group(0).strip("()")
        authors_seg = line[: m_year.start()].strip().rstrip(".,;")
        rest = line[m_year.end():].strip().lstrip(".,;:)").strip()

    authors = _parse_authors(authors_seg)

    # rest = "Title. Journal, vol(issue), pages."
    # Split title from journal: try at ". " before italic-ish journal name
    title = ""
    journal = ""
    if rest:
        # Remove trailing pages/vol info now (already captured)
        if m_pages:
            rest = rest.replace(m_pages.group(0), "")
        if m_vi:
            rest = rest.replace(m_vi.group(0), "")
        rest = rest.strip(" .,;-")
        # Split on first ". " or "  "
        parts = re.split(r"\.\s+", rest, maxsplit=1)
        if len(parts) == 2:
            title = parts[0].strip().rstrip(".,;:")
            journal = parts[1].strip().rstrip(".,;: ()")
            # Remove leftover comma sequences
            journal = re.sub(r",\s*,", ",", journal).strip(",.; ")
        else:
            title = parts[0].strip().rstrip(".,;:")

    # If we have a DOI and no title, fall back to original
    if not title and not journal and not authors:
        title = original.strip()

    return Reference(
        type="journal",
        authors=authors,
        title=title,
        journal=journal,
        year=year,
        volume=volume,
        issue=issue,
        pages=pages,
        doi=doi,
        url=url,
        raw=original.strip(),
    )


def parse_references_text(text: str) -> List[Reference]:
    entries = _split_entries(text)
    return [parse_reference_line(e) for e in entries]
