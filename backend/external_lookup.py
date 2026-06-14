"""External API lookups: Crossref and ORCID (public APIs, no key required)."""
import requests
from typing import Dict, Any

CROSSREF_URL = "https://api.crossref.org/works/{doi}"
ORCID_URL = "https://pub.orcid.org/v3.0/{orcid}/person"
HEADERS = {"User-Agent": "OpenJATSEditor/1.0 (mailto:noreply@openjats.local)"}


def lookup_crossref(doi: str) -> Dict[str, Any]:
    doi = doi.strip().replace("https://doi.org/", "").replace("http://doi.org/", "")
    resp = requests.get(CROSSREF_URL.format(doi=doi), headers=HEADERS, timeout=10)
    resp.raise_for_status()
    data = resp.json().get("message", {})

    authors = []
    for a in data.get("author", []):
        family = a.get("family", "")
        given = a.get("given", "")
        if family or given:
            authors.append(f"{family}, {given}".strip(", "))

    title = (data.get("title") or [""])[0]
    container = (data.get("container-title") or [""])[0]
    year = ""
    issued = data.get("issued", {}).get("date-parts") or [[]]
    if issued and issued[0]:
        year = str(issued[0][0])

    return {
        "title": title,
        "authors": authors,
        "journal": container,
        "year": year,
        "volume": str(data.get("volume", "")),
        "issue": str(data.get("issue", "")),
        "pages": data.get("page", ""),
        "doi": data.get("DOI", doi),
        "publisher": data.get("publisher", ""),
        "url": data.get("URL", ""),
        "type": "journal",
    }


def lookup_orcid(orcid: str) -> Dict[str, Any]:
    orcid = orcid.strip().replace("https://orcid.org/", "")
    headers = {**HEADERS, "Accept": "application/json"}
    resp = requests.get(ORCID_URL.format(orcid=orcid), headers=headers, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    name = data.get("name") or {}
    given = (name.get("given-names") or {}).get("value", "")
    family = (name.get("family-name") or {}).get("value", "")
    emails_block = (data.get("emails") or {}).get("email") or []
    email = emails_block[0].get("email", "") if emails_block else ""

    # affiliations from employments / educations not always public; keep simple
    return {
        "given_name": given,
        "family_name": family,
        "full_name": f"{given} {family}".strip(),
        "email": email,
        "orcid": orcid,
    }
