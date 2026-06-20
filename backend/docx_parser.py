"""Parse uploaded DOCX template into Article structure.
Detects title (first big bold paragraph) + IMRAD sections by heading match."""
import re
from io import BytesIO
from typing import Dict, Any
from docx import Document

# Known section labels — case-insensitive match
IMRAD_LABELS = {
    "introduction": "introduction",
    "pendahuluan": "introduction",
    "background": "introduction",
    "methods": "methods",
    "method": "methods",
    "methodology": "methods",
    "metode": "methods",
    "metodologi": "methods",
    "materials and methods": "methods",
    "results": "results",
    "hasil": "results",
    "result": "results",
    "findings": "results",
    "discussion": "discussion",
    "pembahasan": "discussion",
    "diskusi": "discussion",
    "conclusion": "conclusion",
    "conclusions": "conclusion",
    "kesimpulan": "conclusion",
    "summary": "conclusion",
}

BACK_LABELS = {
    "acknowledgement": "acknowledgement",
    "acknowledgements": "acknowledgement",
    "ucapan terima kasih": "acknowledgement",
    "funding": "funding",
    "funding statement": "funding",
    "pendanaan": "funding",
    "conflict of interest": "conflict_of_interest",
    "competing interests": "conflict_of_interest",
    "data availability": "data_availability",
    "data availability statement": "data_availability",
    "author contributions": "author_contributions",
    "ethical approval": "ethical_approval",
    "ethics statement": "ethical_approval",
}

ABSTRACT_LABELS = {"abstract", "abstrak"}
KEYWORDS_LABELS = {"keywords", "kata kunci"}
REFERENCES_LABELS = {"references", "daftar pustaka", "bibliography"}


def _is_heading_like(para) -> bool:
    """Detect if a paragraph likely is a heading: H-style or bold short line."""
    if para.style and "heading" in (para.style.name or "").lower():
        return True
    text = (para.text or "").strip()
    if not text or len(text) > 80:
        return False
    if not para.runs:
        return False
    # bold + short text = likely heading
    bold_share = sum(1 for r in para.runs if r.bold) / max(1, len(para.runs))
    return bold_share >= 0.5


def _normalize(text: str) -> str:
    return re.sub(r"[\s:.\d]+", " ", text or "").strip().lower()


def parse_docx_template(file_bytes: bytes) -> Dict[str, Any]:
    """Extract title, abstract, keywords, IMRAD sections, and references list from DOCX."""
    doc = Document(BytesIO(file_bytes))

    out = {
        "title": "",
        "subtitle": "",
        "abstract": "",
        "keywords": [],
        "sections": {
            "introduction": "",
            "methods": "",
            "results": "",
            "discussion": "",
            "conclusion": "",
            "acknowledgement": "",
            "funding": "",
            "conflict_of_interest": "",
            "data_availability": "",
            "author_contributions": "",
            "ethical_approval": "",
        },
        "references_text": "",
    }

    paragraphs = [p for p in doc.paragraphs if (p.text or "").strip()]
    if not paragraphs:
        return out

    # Title: first paragraph with large bold runs OR very first non-empty paragraph
    title_idx = 0
    for idx, p in enumerate(paragraphs[:5]):
        if any(r.font.size and r.font.size.pt and r.font.size.pt >= 14 for r in p.runs):
            title_idx = idx
            out["title"] = p.text.strip()
            break
        if any(r.bold for r in p.runs) and len(p.text.strip()) > 8:
            title_idx = idx
            out["title"] = p.text.strip()
            break
    if not out["title"]:
        out["title"] = paragraphs[0].text.strip()
        title_idx = 0

    # Walk through remaining paragraphs, partition by detected section headings
    current_key = None  # None = not yet in IMRAD; "abstract"; "keywords"; "intro/methods/..."
    buffer = []

    def flush_to(key):
        text = "\n\n".join(buffer).strip()
        buffer.clear()
        if not key or not text:
            return
        if key == "abstract":
            out["abstract"] = text
        elif key == "keywords":
            # Comma-split keywords
            kw_text = text.replace("\n", " ").lstrip("Keywords:").lstrip("Kata Kunci:").strip(": ")
            out["keywords"] = [k.strip() for k in re.split(r"[,;]", kw_text) if k.strip()]
        elif key == "references":
            out["references_text"] = text
        elif key in out["sections"]:
            out["sections"][key] = text

    for p in paragraphs[title_idx + 1:]:
        text = p.text.strip()
        normalized = _normalize(text)
        # Detect if this paragraph IS a section heading
        new_key = None
        if _is_heading_like(p) or len(text) < 60:
            for label, key in IMRAD_LABELS.items():
                if normalized == label or normalized.startswith(label + " "):
                    new_key = key
                    break
            if not new_key:
                for label, key in BACK_LABELS.items():
                    if normalized == label or normalized.startswith(label + " "):
                        new_key = key
                        break
            if not new_key and normalized in ABSTRACT_LABELS:
                new_key = "abstract"
            elif not new_key and normalized in KEYWORDS_LABELS:
                new_key = "keywords"
            elif not new_key and normalized in REFERENCES_LABELS:
                new_key = "references"

        if new_key:
            flush_to(current_key)
            current_key = new_key
            continue

        # If we haven't found a section yet, paragraph may belong to abstract or be skipped
        if current_key is None:
            # Try to capture inline Keywords paragraph: "Keywords: a, b, c"
            if normalized.startswith("keywords") or normalized.startswith("kata kunci"):
                kw_text = re.sub(r"^[a-zA-Z ]+:\s*", "", text, count=1)
                out["keywords"] = [k.strip() for k in re.split(r"[,;]", kw_text) if k.strip()]
                continue
            continue

        buffer.append(text)

    flush_to(current_key)

    return out
