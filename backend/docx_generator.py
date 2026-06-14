"""Generate DOCX file from an Article — with figures, tables, and proper formatting."""
import re
import base64
from io import BytesIO
from docx import Document
from docx.shared import Pt, Inches, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from models import Article, Figure
from citation_formatter import format_references


def _set_margins(doc: Document):
    for section in doc.sections:
        section.top_margin = Cm(2.5)
        section.bottom_margin = Cm(2.5)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)


def _heading(doc: Document, text: str, level: int = 1):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = True
    if level == 1:
        run.font.size = Pt(13)
    elif level == 2:
        run.font.size = Pt(12)
    else:
        run.font.size = Pt(11)
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.keep_with_next = True
    return p


def _set_justify(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    # Disable automatic hyphenation
    p_pr = paragraph.paragraph_format.element.get_or_add_pPr()
    sup = OxmlElement("w:suppressAutoHyphens")
    sup.set(qn("w:val"), "true")
    p_pr.append(sup)


def _add_paragraph(doc: Document, text: str, indent: bool = True):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.font.size = Pt(11)
    _set_justify(p)
    if indent:
        p.paragraph_format.first_line_indent = Cm(0.5)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.15
    return p


def _add_page_break(doc: Document):
    p = doc.add_paragraph()
    run = p.add_run()
    run.add_break(WD_BREAK.PAGE)


def _figure_bytes(fig: Figure) -> bytes:
    """Decode base64 data URL to image bytes."""
    if not fig.data_url:
        return b""
    data = fig.data_url
    if "," in data:
        data = data.split(",", 1)[1]
    try:
        return base64.b64decode(data)
    except Exception:
        return b""


def _add_figure(doc: Document, fig: Figure):
    img_bytes = _figure_bytes(fig)
    if not img_bytes:
        return
    # SVG not directly supported by python-docx; embed only raster
    if "svg" in (fig.data_url or "").lower():
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(f"[{fig.label}: SVG image — see digital version]")
        run.italic = True
        run.font.size = Pt(10)
    else:
        width = Cm(14) if fig.width == "full" else Cm(8) if fig.width == "half" else Cm(5)
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        try:
            doc.add_picture(BytesIO(img_bytes), width=width)
        except Exception:
            run = p.add_run(f"[{fig.label}: image could not be embedded]")
            run.italic = True
    # caption
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    label_run = cap.add_run(f"{fig.label}. ")
    label_run.bold = True
    label_run.font.size = Pt(10)
    cap_run = cap.add_run(fig.caption)
    cap_run.font.size = Pt(10)
    cap_run.italic = True
    cap.paragraph_format.space_after = Pt(8)


def _shade_cell(cell, color_hex: str = "E2E8F0"):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), color_hex)
    tc_pr.append(shd)


def _add_table(doc: Document, label: str, caption: str, rows: list):
    """rows: list of list[str], first row = header."""
    if not rows or not rows[0]:
        return
    # Caption above table
    if label or caption:
        cap = doc.add_paragraph()
        cap.alignment = WD_ALIGN_PARAGRAPH.LEFT
        if label:
            r = cap.add_run(f"{label}. ")
            r.bold = True
            r.font.size = Pt(10)
        r2 = cap.add_run(caption)
        r2.font.size = Pt(10)
        cap.paragraph_format.keep_with_next = True

    cols = len(rows[0])
    table = doc.add_table(rows=len(rows), cols=cols)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for r_idx, row_cells in enumerate(rows):
        for c_idx in range(cols):
            value = row_cells[c_idx] if c_idx < len(row_cells) else ""
            cell = table.rows[r_idx].cells[c_idx]
            cell.text = ""
            p = cell.paragraphs[0]
            run = p.add_run(value)
            run.font.size = Pt(10)
            if r_idx == 0:
                run.bold = True
                _shade_cell(cell, "E2E8F0")
    # spacing after table
    doc.add_paragraph().paragraph_format.space_after = Pt(8)


def _parse_table_rows(lines: list) -> list:
    """Parse markdown-table lines into list-of-lists, skipping the separator row."""
    rows = []
    for ln in lines:
        if not ln.strip().startswith("|"):
            continue
        stripped = ln.strip()
        if re.match(r"^\|\s*-+\s*(\|\s*-+\s*)*\|?$", stripped):
            continue
        cells = stripped.strip("|").split("|")
        rows.append([c.strip() for c in cells])
    return rows


def _render_body(doc: Document, body: str, figures_map: dict):
    """Render a section body line by line, dispatching to figure / table / page break / paragraph."""
    if not body or not body.strip():
        return
    lines = body.split("\n")
    i = 0
    para_buf = []

    def flush_para():
        if not para_buf:
            return
        text = " ".join(para_buf).strip()
        para_buf.clear()
        if text:
            _add_paragraph(doc, text)

    while i < len(lines):
        ln = lines[i]
        stripped = ln.strip()

        # Page break
        if re.match(r"^\[PAGE\s*BREAK\]$", stripped, re.IGNORECASE):
            flush_para()
            _add_page_break(doc)
            i += 1
            continue

        # Figure reference
        m_fig = re.match(r"^\[Figure:([^\]]+)\]\s*$", stripped)
        if m_fig:
            flush_para()
            fig = figures_map.get(m_fig.group(1).strip())
            if fig:
                _add_figure(doc, fig)
            i += 1
            continue

        # Table block
        m_tbl = re.match(r"^\[Table:([^\]]+)\]\s*(.*)?$", stripped)
        if m_tbl or stripped.startswith("|"):
            flush_para()
            label = ""
            caption = ""
            if m_tbl:
                label = m_tbl.group(1).strip()
                caption = (m_tbl.group(2) or "").strip()
                i += 1
            # Collect contiguous table rows
            tbl_lines = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                tbl_lines.append(lines[i])
                i += 1
            parsed = _parse_table_rows(tbl_lines)
            if parsed:
                _add_table(doc, label, caption, parsed)
            continue

        # Heading
        if stripped.startswith("### "):
            flush_para()
            _heading(doc, stripped[4:].strip(), level=3)
            i += 1
            continue
        if stripped.startswith("## "):
            flush_para()
            _heading(doc, stripped[3:].strip(), level=2)
            i += 1
            continue

        # Formula (inline display)
        if stripped.startswith("$$") and stripped.endswith("$$") and len(stripped) >= 4:
            flush_para()
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            run = p.add_run(stripped[2:-2].strip())
            run.font.name = "Cambria Math"
            run.font.size = Pt(11)
            i += 1
            continue

        # Blank line
        if not stripped:
            flush_para()
            i += 1
            continue

        para_buf.append(stripped)
        i += 1

    flush_para()


def generate_docx(article: Article, citation_style: str = "apa") -> bytes:
    doc = Document()
    _set_margins(doc)

    style = doc.styles["Normal"]
    style.font.name = "Times New Roman"
    style.font.size = Pt(11)

    # Custom header with journal info
    j = article.journal
    if j.title:
        head = doc.add_paragraph()
        head.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = head.add_run(j.title)
        r.bold = True
        r.font.size = Pt(11)
        if j.custom_header:
            head.add_run("\n")
            run2 = head.add_run(j.custom_header)
            run2.italic = True
            run2.font.size = Pt(9)
        meta = doc.add_paragraph()
        meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
        meta_run = meta.add_run(
            f"Vol. {j.volume or '—'}, No. {j.issue or '—'} ({j.year or '—'})  ·  ISSN: {j.issn or '—'}  ·  e-ISSN: {j.eissn or '—'}"
        )
        meta_run.font.size = Pt(9)
        meta_run.font.color.rgb = RGBColor(0x47, 0x55, 0x69)

    # Embed journal logo (if raster)
    if j.logo and "svg" not in (j.logo or "").lower():
        try:
            data = j.logo.split(",", 1)[1] if "," in j.logo else j.logo
            img_bytes = base64.b64decode(data)
            logo_p = doc.add_paragraph()
            logo_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            doc.add_picture(BytesIO(img_bytes), height=Cm(2.0))
        except Exception:
            pass

    # Title
    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    tr = t.add_run(article.title or "Untitled")
    tr.bold = True
    tr.font.size = Pt(16)
    t.paragraph_format.space_before = Pt(12)
    t.paragraph_format.space_after = Pt(4)

    if article.subtitle:
        sub = doc.add_paragraph()
        sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
        sr = sub.add_run(article.subtitle)
        sr.italic = True
        sr.font.size = Pt(12)

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
        names_run = ap.add_run(", ".join(names))
        names_run.font.size = Pt(11)

        for i, a in enumerate(article.authors, 1):
            if a.affiliation:
                af = doc.add_paragraph()
                af.alignment = WD_ALIGN_PARAGRAPH.CENTER
                afr = af.add_run(f"{i}. {a.affiliation}{(', ' + a.country) if a.country else ''}")
                afr.italic = True
                afr.font.size = Pt(9)

    figures_map = {f.id: f for f in (article.figures or [])}

    # Abstract
    if article.abstract.english:
        _heading(doc, "Abstract", level=2)
        _add_paragraph(doc, article.abstract.english, indent=False)

    if article.keywords:
        kp = doc.add_paragraph()
        kr = kp.add_run("Keywords: ")
        kr.bold = True
        kr.font.size = Pt(10)
        kr2 = kp.add_run(", ".join(article.keywords))
        kr2.font.size = Pt(10)
        kr2.italic = True

    # History dates
    history_bits = []
    if article.received_date:
        history_bits.append(f"Received: {article.received_date}")
    if article.revised_date:
        history_bits.append(f"Revised: {article.revised_date}")
    if article.accepted_date:
        history_bits.append(f"Accepted: {article.accepted_date}")
    if history_bits:
        hp = doc.add_paragraph()
        hp.alignment = WD_ALIGN_PARAGRAPH.LEFT
        hr = hp.add_run(" · ".join(history_bits))
        hr.italic = True
        hr.font.size = Pt(9)

    # Indonesian abstract
    if article.abstract.indonesian:
        _heading(doc, "Abstrak", level=2)
        _add_paragraph(doc, article.abstract.indonesian, indent=False)

    # IMRAD sections (with rich rendering)
    sec_map = [
        ("Introduction", article.sections.introduction),
        ("Methods", article.sections.methods),
        ("Results", article.sections.results),
        ("Discussion", article.sections.discussion),
        ("Conclusion", article.sections.conclusion),
    ]
    for title, body in sec_map:
        if body and body.strip():
            _heading(doc, title, level=1)
            _render_body(doc, body, figures_map)

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
            _heading(doc, title, level=2)
            _add_paragraph(doc, body, indent=False)

    # References (with hanging indent)
    if article.references:
        _heading(doc, "References", level=1)
        formatted = format_references(article.references, citation_style)
        for line in formatted:
            p = doc.add_paragraph()
            run = p.add_run(line)
            run.font.size = Pt(10)
            p.paragraph_format.left_indent = Cm(0.7)
            p.paragraph_format.first_line_indent = Cm(-0.7)
            p.paragraph_format.space_after = Pt(3)
            p.paragraph_format.line_spacing = 1.15
            _set_justify(p)

    buf = BytesIO()
    doc.save(buf)
    return buf.getvalue()
