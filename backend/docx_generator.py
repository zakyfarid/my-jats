"""Generate DOCX file from an Article."""
from io import BytesIO
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from models import Article
from citation_formatter import format_references


def _h(doc, text, level=1, bold=True, size=14):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold
    run.font.size = Pt(size)
    return p


def _p(doc, text):
    if not text:
        return
    for chunk in text.split("\n\n"):
        if chunk.strip():
            par = doc.add_paragraph(chunk.strip())
            par.paragraph_format.first_line_indent = Inches(0.3)


def generate_docx(article: Article, citation_style: str = "apa") -> bytes:
    doc = Document()

    style = doc.styles["Normal"]
    style.font.name = "Times New Roman"
    style.font.size = Pt(11)

    # Title
    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    tr = t.add_run(article.title or "Untitled")
    tr.bold = True
    tr.font.size = Pt(18)

    if article.subtitle:
        sub = doc.add_paragraph()
        sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
        sr = sub.add_run(article.subtitle)
        sr.italic = True
        sr.font.size = Pt(13)

    # Authors
    if article.authors:
        ap = doc.add_paragraph()
        ap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        names = []
        for a in article.authors:
            n = a.full_name or f"{a.given_name} {a.family_name}".strip()
            if a.corresponding:
                n += "*"
            names.append(n)
        ap.add_run(", ".join(names))

        # Affiliations
        for i, a in enumerate(article.authors, 1):
            if a.affiliation:
                af = doc.add_paragraph()
                af.alignment = WD_ALIGN_PARAGRAPH.CENTER
                afr = af.add_run(f"{i}. {a.affiliation}, {a.country}".rstrip(", "))
                afr.italic = True
                afr.font.size = Pt(9)

    # Abstract
    if article.abstract.english:
        _h(doc, "Abstract", size=12)
        _p(doc, article.abstract.english)

    if article.keywords:
        kp = doc.add_paragraph()
        kr = kp.add_run("Keywords: ")
        kr.bold = True
        kp.add_run(", ".join(article.keywords))

    # Indonesian abstract
    if article.abstract.indonesian:
        _h(doc, "Abstrak", size=12)
        _p(doc, article.abstract.indonesian)

    # Sections (IMRAD)
    sec_map = [
        ("Introduction", article.sections.introduction),
        ("Methods", article.sections.methods),
        ("Results", article.sections.results),
        ("Discussion", article.sections.discussion),
        ("Conclusion", article.sections.conclusion),
    ]
    for title, body in sec_map:
        if body and body.strip():
            _h(doc, title, size=13)
            _p(doc, body)

    # Back matter
    back_map = [
        ("Acknowledgements", article.sections.acknowledgement),
        ("Funding", article.sections.funding),
        ("Conflict of Interest", article.sections.conflict_of_interest),
        ("Data Availability", article.sections.data_availability),
        ("Author Contributions", article.sections.author_contributions),
        ("Ethical Approval", article.sections.ethical_approval),
    ]
    for title, body in back_map:
        if body and body.strip():
            _h(doc, title, size=12)
            _p(doc, body)

    # References
    if article.references:
        _h(doc, "References", size=13)
        formatted = format_references(article.references, citation_style)
        for idx, line in enumerate(formatted, 1):
            doc.add_paragraph(line, style=None)

    buf = BytesIO()
    doc.save(buf)
    return buf.getvalue()
