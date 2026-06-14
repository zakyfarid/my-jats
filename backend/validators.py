"""Validation logic for articles."""
import re
from typing import List, Dict
from models import Article

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
ORCID_RE = re.compile(r"^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$")
DOI_RE = re.compile(r"^10\.\d{4,9}/[-._;()/:A-Z0-9]+$", re.IGNORECASE)


def validate_article(article: Article) -> Dict[str, List[Dict[str, str]]]:
    """Return dict with errors and warnings."""
    errors: List[Dict[str, str]] = []
    warnings: List[Dict[str, str]] = []

    if not article.title.strip():
        errors.append({"field": "title", "message": "Article title is empty"})

    if not article.abstract.english.strip():
        errors.append({"field": "abstract.english", "message": "Abstract (English) is empty"})

    if article.doi and not DOI_RE.match(article.doi):
        errors.append({"field": "doi", "message": f"Invalid DOI format: {article.doi}"})

    if not article.authors:
        errors.append({"field": "authors", "message": "At least one author is required"})

    has_corresponding = False
    for i, author in enumerate(article.authors):
        prefix = f"authors[{i}]"
        if not author.affiliation.strip():
            warnings.append({"field": f"{prefix}.affiliation", "message": f"Author '{author.full_name or author.given_name}' has no affiliation"})
        if author.email and not EMAIL_RE.match(author.email):
            errors.append({"field": f"{prefix}.email", "message": f"Invalid email format: {author.email}"})
        if author.orcid and not ORCID_RE.match(author.orcid):
            errors.append({"field": f"{prefix}.orcid", "message": f"Invalid ORCID format: {author.orcid}"})
        if author.corresponding:
            has_corresponding = True

    if article.authors and not has_corresponding:
        warnings.append({"field": "authors", "message": "No corresponding author marked"})

    if not article.sections.funding.strip():
        warnings.append({"field": "sections.funding", "message": "Funding statement is empty"})

    if not article.sections.introduction.strip():
        warnings.append({"field": "sections.introduction", "message": "Introduction is empty"})

    if not article.sections.methods.strip():
        warnings.append({"field": "sections.methods", "message": "Methods section is empty"})

    # duplicate references
    seen = {}
    for i, r in enumerate(article.references):
        key = (r.doi.lower() if r.doi else r.title.lower().strip())
        if key and key in seen:
            warnings.append({"field": f"references[{i}]", "message": f"Duplicate reference: '{r.title or r.doi}'"})
        elif key:
            seen[key] = i

    # validate reference DOIs
    for i, r in enumerate(article.references):
        if r.doi and not DOI_RE.match(r.doi):
            warnings.append({"field": f"references[{i}].doi", "message": f"Invalid DOI in reference: {r.doi}"})

    return {"errors": errors, "warnings": warnings, "valid": len(errors) == 0}
