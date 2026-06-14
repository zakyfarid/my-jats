"""Reference import/export: RIS, BibTeX, EndNote XML."""
import re
from typing import List
from xml.etree import ElementTree as ET
from models import Reference

# --- RIS ---
RIS_MAP = {
    "TI": "title", "T1": "title",
    "JO": "journal", "T2": "journal", "JF": "journal",
    "PY": "year", "Y1": "year",
    "VL": "volume", "IS": "issue",
    "SP": "pages_start", "EP": "pages_end",
    "DO": "doi",
    "UR": "url",
    "PB": "publisher",
}


def parse_ris(text: str) -> List[Reference]:
    refs: List[Reference] = []
    current = {"authors": []}
    pages_start = ""
    pages_end = ""
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        m = re.match(r"^([A-Z][A-Z0-9])\s*-\s*(.*)$", line)
        if not m:
            continue
        tag, value = m.group(1), m.group(2).strip()
        if tag == "TY":
            current = {"authors": [], "type": value.lower()}
            pages_start, pages_end = "", ""
        elif tag in ("AU", "A1", "A2"):
            current["authors"].append(value)
        elif tag in RIS_MAP:
            key = RIS_MAP[tag]
            if key == "pages_start":
                pages_start = value
            elif key == "pages_end":
                pages_end = value
            else:
                current[key] = value
        elif tag == "ER":
            if pages_start or pages_end:
                current["pages"] = f"{pages_start}-{pages_end}".strip("-")
            current["raw"] = text
            try:
                refs.append(Reference(**current))
            except Exception:
                pass
            current = {"authors": []}
            pages_start, pages_end = "", ""
    return refs


def to_ris(refs: List[Reference]) -> str:
    out = []
    for r in refs:
        out.append("TY  - JOUR")
        for a in r.authors:
            out.append(f"AU  - {a}")
        if r.title:
            out.append(f"TI  - {r.title}")
        if r.journal:
            out.append(f"JO  - {r.journal}")
        if r.year:
            out.append(f"PY  - {r.year}")
        if r.volume:
            out.append(f"VL  - {r.volume}")
        if r.issue:
            out.append(f"IS  - {r.issue}")
        if r.pages:
            parts = r.pages.split("-")
            out.append(f"SP  - {parts[0]}")
            if len(parts) > 1:
                out.append(f"EP  - {parts[1]}")
        if r.doi:
            out.append(f"DO  - {r.doi}")
        if r.url:
            out.append(f"UR  - {r.url}")
        out.append("ER  - ")
        out.append("")
    return "\n".join(out)


# --- BibTeX ---
def parse_bibtex(text: str) -> List[Reference]:
    refs: List[Reference] = []
    # Simple parser: find @type{key, field=value, ...}
    entries = re.findall(r"@(\w+)\s*\{([^,]+),(.*?)\n\}", text, re.DOTALL)
    for entry_type, _key, body in entries:
        fields = {}
        # match field = {value} or field = "value"
        for m in re.finditer(r"(\w+)\s*=\s*[\{\"]([^\}\"]+)[\}\"]", body):
            fields[m.group(1).lower()] = m.group(2).strip()
        authors = [a.strip() for a in re.split(r"\s+and\s+", fields.get("author", "")) if a.strip()]
        pages = fields.get("pages", "").replace("--", "-")
        try:
            refs.append(Reference(
                type=entry_type.lower(),
                authors=authors,
                title=fields.get("title", ""),
                journal=fields.get("journal", ""),
                year=fields.get("year", ""),
                volume=fields.get("volume", ""),
                issue=fields.get("number", ""),
                pages=pages,
                doi=fields.get("doi", ""),
                url=fields.get("url", ""),
                publisher=fields.get("publisher", ""),
                raw=body.strip(),
            ))
        except Exception:
            pass
    return refs


def to_bibtex(refs: List[Reference]) -> str:
    out = []
    for i, r in enumerate(refs, 1):
        key = f"ref{i}"
        if r.authors:
            first = r.authors[0].split(",")[0].replace(" ", "")
            key = f"{first.lower()}{r.year or i}"
        lines = [f"@article{{{key},"]
        if r.authors:
            lines.append(f"  author = {{{ ' and '.join(r.authors) }}},")
        if r.title:
            lines.append(f"  title = {{{r.title}}},")
        if r.journal:
            lines.append(f"  journal = {{{r.journal}}},")
        if r.year:
            lines.append(f"  year = {{{r.year}}},")
        if r.volume:
            lines.append(f"  volume = {{{r.volume}}},")
        if r.issue:
            lines.append(f"  number = {{{r.issue}}},")
        if r.pages:
            lines.append(f"  pages = {{{r.pages.replace('-', '--')}}},")
        if r.doi:
            lines.append(f"  doi = {{{r.doi}}},")
        if r.url:
            lines.append(f"  url = {{{r.url}}},")
        if r.publisher:
            lines.append(f"  publisher = {{{r.publisher}}},")
        lines.append("}")
        out.append("\n".join(lines))
    return "\n\n".join(out)


# --- EndNote XML ---
def parse_endnote(text: str) -> List[Reference]:
    refs: List[Reference] = []
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return refs

    for record in root.iter("record"):
        def get_text(xpath: str) -> str:
            el = record.find(xpath)
            if el is None:
                return ""
            return "".join(el.itertext()).strip()

        authors = []
        for a in record.findall(".//contributors/authors/author"):
            authors.append("".join(a.itertext()).strip())

        title = get_text(".//titles/title")
        journal = get_text(".//titles/secondary-title") or get_text(".//periodical/full-title")
        year = get_text(".//dates/year")
        volume = get_text(".//volume")
        issue = get_text(".//number")
        pages = get_text(".//pages")
        doi = get_text(".//electronic-resource-num")
        url = get_text(".//urls/related-urls/url")
        try:
            refs.append(Reference(
                authors=authors, title=title, journal=journal, year=year,
                volume=volume, issue=issue, pages=pages, doi=doi, url=url
            ))
        except Exception:
            pass
    return refs
