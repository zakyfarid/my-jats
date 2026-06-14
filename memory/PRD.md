# OpenJATS Editor — Product Requirements Document

## Original Problem Statement
Web application "OpenJATS Editor": a JATS XML editor for scholarly journal articles. Helps journal editors lay out and validate article metadata consistently before publishing to OJS, PKP XML, Crossref, DOAJ, Scopus, PubMed. Single-editor mode. Dark mode by default. Professional editor experience comparable to Scopus/PubMed editorial tools.

## Tech Stack
- **Frontend**: React 19, TailwindCSS, React Router 7, sonner (toasts), lucide-react (icons), shadcn primitives
- **Backend**: FastAPI (Python), MongoDB (Motor async), python-docx, bibtexparser
- **External APIs**: Crossref (DOI lookup, public), ORCID Public API (no key)

## User Personas
- **Journal Layout Editor** (primary): prepares articles for publication, validates metadata, generates JATS/PKP/Crossref XML.
- **Production Manager**: imports references in bulk, applies house style (citation format), exports DOCX/PDF for proofing.

## Core Requirements (static)
1. Dashboard with article list, status filters, search.
2. Metadata: Journal info, Article meta, multi-author (with corresponding flag), bilingual abstract.
3. IMRAD structured editor with 11 sections + toolbar (heading, table, formula, citation, footnote).
4. References manager with APA 7th / Harvard / Vancouver formatting; RIS/BibTeX/EndNote import; BibTeX/RIS export.
5. Crossref DOI lookup + ORCID lookup auto-fill.
6. JATS Publishing 1.3 XML generation + PKP Native XML + Crossref deposit XML.
7. Live XML preview with syntax highlight + tree view.
8. PDF preview (two-column journal layout, print-to-PDF).
9. DOCX export.
10. Template management for reusable journal metadata.
11. Auto-validation panel (errors + warnings) with jump-to-field.
12. Autosave every 30 seconds + manual Save.
13. Dark mode default, light mode toggle, persisted to localStorage.

## What's Been Implemented (2026-02)
- ✅ Full Dashboard with filters (status, volume, issue, year), search, status badges, empty state.
- ✅ Article CRUD via REST (`/api/articles`).
- ✅ MetadataForm with all required fields, including ORCID lookup, Crossref DOI lookup.
- ✅ AuthorsManager (add/remove, corresponding flag, full_name auto-derive).
- ✅ Bilingual abstract (English + Bahasa Indonesia).
- ✅ IMRADEditor: 11-section sidebar + toolbar (heading, subheading, table, figure, formula, footnote, citation).
- ✅ ReferencesManager: APA/Harvard/Vancouver live formatting, RIS/BibTeX/EndNote import, BibTeX/RIS export, per-row Crossref DOI lookup.
- ✅ JATS Publishing 1.3 XML generator with affiliation IDs, contrib-group, journal-meta, article-meta, ref-list.
- ✅ PKP Native XML for OJS import.
- ✅ Crossref deposit XML for DOI registration.
- ✅ DOCX export via python-docx (Times New Roman, centered title/authors, sections, references).
- ✅ XML Preview: syntax highlight (source view) + flat tree view + Copy + Download.
- ✅ PDF Preview: two-column journal layout, header with vol/issue/DOI, authors with sup affiliations, abstract block, IMRAD sections (renders markdown headings, formulas, figure captions, citations), references, print button.
- ✅ Validation panel: 8+ rule checks (title, abstract, DOI format, ORCID format, email format, missing affiliation, missing funding, duplicate refs).
- ✅ Templates: full CRUD with reusable Journal info + License + Copyright.
- ✅ Autosave (30s) + manual Save + dirty indicator in header.
- ✅ Dark + Light theme toggle.

## Validation Rules Implemented
- Article title empty → ERROR
- Abstract (EN) empty → ERROR
- Invalid DOI format → ERROR
- No authors → ERROR
- Invalid email/ORCID → ERROR
- Missing affiliation → WARNING
- No corresponding author → WARNING
- Missing introduction/methods/funding → WARNING
- Duplicate references (by DOI or title) → WARNING

## Test Results (2026-02)
- Backend: 27/27 pytest pass (articles CRUD, validation, JATS/PKP/Crossref XML, DOCX, references import/export/format, templates CRUD, external lookups).
- Frontend: ~95% e2e Playwright happy path success (all data-testids resolved).
- Fixed: PDFPreview now parses `## ` markdown headings and `$$ … $$` formulas inserted by IMRAD toolbar.

## Prioritized Backlog
### P1
- Drag-to-reorder for authors and references.
- Bulk article CSV import (one row per submission).
- Convert IMRAD markdown headings to proper JATS `<sec>` sub-sections (currently embedded as paragraph text).

### P2
- Full citation.js integration for advanced CSL styles (currently APA/Harvard/Vancouver manual).
- Inline citation linking (click `[@ref-key]` in IMRAD → jump to references).
- Article version history / diff viewer.
- DOAJ XML export.

### P3
- Multi-user mode with role-based collaboration.
- Real-time co-editing (websocket).
- AI-assisted abstract polishing (LLM integration).
