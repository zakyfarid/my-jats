"""Format references as APA 7th, Harvard, or Vancouver strings."""
from typing import List
from models import Reference


def _author_init(name: str) -> str:
    """Convert 'Family, Given Middle' to 'Family, G. M.' (APA)."""
    if "," in name:
        family, given = name.split(",", 1)
        initials = " ".join(f"{p.strip()[0]}." for p in given.strip().split() if p.strip())
        return f"{family.strip()}, {initials}"
    parts = name.strip().split()
    if not parts:
        return name
    family = parts[-1]
    initials = " ".join(f"{p[0]}." for p in parts[:-1])
    return f"{family}, {initials}"


def format_apa(r: Reference, idx: int = 0) -> str:
    authors = ", ".join(_author_init(a) for a in r.authors) or "Anonymous"
    if len(r.authors) > 1:
        # last author with &
        parts = [_author_init(a) for a in r.authors]
        authors = ", ".join(parts[:-1]) + ", & " + parts[-1]
    year = f"({r.year})" if r.year else ""
    title = r.title.rstrip(".") + "." if r.title else ""
    journal = f" *{r.journal}*" if r.journal else ""
    volume = f", *{r.volume}*" if r.volume else ""
    issue = f"({r.issue})" if r.issue else ""
    pages = f", {r.pages}" if r.pages else ""
    doi = f". https://doi.org/{r.doi}" if r.doi else ""
    return f"{authors} {year}. {title}{journal}{volume}{issue}{pages}{doi}".strip()


def format_harvard(r: Reference, idx: int = 0) -> str:
    authors = " and ".join(_author_init(a) for a in r.authors) or "Anonymous"
    year = f"({r.year})" if r.year else ""
    title = f"'{r.title}'" if r.title else ""
    journal = f", *{r.journal}*" if r.journal else ""
    volume = f", {r.volume}" if r.volume else ""
    issue = f"({r.issue})" if r.issue else ""
    pages = f", pp. {r.pages}" if r.pages else ""
    doi = f". doi: {r.doi}" if r.doi else ""
    return f"{authors} {year} {title}{journal}{volume}{issue}{pages}{doi}.".strip()


def format_vancouver(r: Reference, idx: int = 0) -> str:
    # Vancouver: numbered, "Family GM, Family2 AB. Title. Journal. Year;Vol(Issue):pages."
    def vanc_name(name: str) -> str:
        if "," in name:
            family, given = name.split(",", 1)
            initials = "".join(p.strip()[0] for p in given.strip().split() if p.strip())
            return f"{family.strip()} {initials}"
        parts = name.strip().split()
        if not parts:
            return name
        return f"{parts[-1]} {''.join(p[0] for p in parts[:-1])}"

    authors = ", ".join(vanc_name(a) for a in r.authors) or "Anonymous"
    title = r.title.rstrip(".") + "." if r.title else ""
    journal = f" {r.journal}." if r.journal else ""
    year = r.year or ""
    volume = f";{r.volume}" if r.volume else ""
    issue = f"({r.issue})" if r.issue else ""
    pages = f":{r.pages}" if r.pages else ""
    doi = f" doi:{r.doi}" if r.doi else ""
    num = f"{idx}." if idx else ""
    return f"{num} {authors}. {title}{journal} {year}{volume}{issue}{pages}.{doi}".strip()


def format_references(refs: List[Reference], style: str = "apa") -> List[str]:
    style = (style or "apa").lower()
    fn = {"apa": format_apa, "harvard": format_harvard, "vancouver": format_vancouver}.get(style, format_apa)
    return [fn(r, idx=i + 1) for i, r in enumerate(refs)]
