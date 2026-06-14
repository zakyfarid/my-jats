"""FastAPI server for OpenJATS Editor."""
from fastapi import FastAPI, APIRouter, HTTPException, Body
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional
import requests

from models import Article, ArticleSummary, Template, Reference
from jats_generator import generate_jats, generate_pkp_native, generate_crossref
from validators import validate_article
from reference_parsers import parse_ris, parse_bibtex, parse_endnote, to_ris, to_bibtex
from reference_text_parser import parse_references_text
from citation_formatter import format_references
from external_lookup import lookup_crossref, lookup_orcid
from docx_generator import generate_docx
from pdf_generator import generate_pdf_from_url

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="OpenJATS Editor API")
api_router = APIRouter(prefix="/api")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Articles ----------
@api_router.get("/articles", response_model=List[ArticleSummary])
async def list_articles(
    q: Optional[str] = None,
    status: Optional[str] = None,
    volume: Optional[str] = None,
    issue: Optional[str] = None,
    year: Optional[str] = None,
):
    query = {}
    if status:
        query["status"] = status
    if volume:
        query["journal.volume"] = volume
    if issue:
        query["journal.issue"] = issue
    if year:
        query["journal.year"] = year
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"doi": {"$regex": q, "$options": "i"}},
            {"keywords": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.articles.find(query, {"_id": 0}).sort("updated_at", -1).to_list(1000)
    summaries = []
    for d in docs:
        authors = d.get("authors", []) or []
        author_names = [
            a.get("full_name") or f"{a.get('given_name', '')} {a.get('family_name', '')}".strip()
            for a in authors
        ]
        j = d.get("journal", {}) or {}
        summaries.append(ArticleSummary(
            id=d["id"],
            title=d.get("title", "") or "(Untitled)",
            status=d.get("status", "draft"),
            authors=author_names,
            journal_title=j.get("title", ""),
            volume=j.get("volume", ""),
            issue=j.get("issue", ""),
            year=j.get("year", ""),
            updated_at=d.get("updated_at", ""),
        ))
    return summaries


@api_router.post("/articles", response_model=Article)
async def create_article(article: Article):
    article.created_at = _now_iso()
    article.updated_at = _now_iso()
    await db.articles.insert_one(article.model_dump())
    return article


@api_router.get("/articles/{article_id}", response_model=Article)
async def get_article(article_id: str):
    doc = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")
    return Article(**doc)


@api_router.put("/articles/{article_id}", response_model=Article)
async def update_article(article_id: str, article: Article):
    article.id = article_id
    article.updated_at = _now_iso()
    existing = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Article not found")
    article.created_at = existing.get("created_at", _now_iso())
    await db.articles.replace_one({"id": article_id}, article.model_dump())
    return article


@api_router.delete("/articles/{article_id}")
async def delete_article(article_id: str):
    result = await db.articles.delete_one({"id": article_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Article not found")
    return {"deleted": True}


@api_router.get("/articles/{article_id}/issue-info")
async def article_issue_info(article_id: str):
    doc = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")
    j = doc.get("journal", {}) or {}
    query = {
        "journal.volume": j.get("volume", ""),
        "journal.issue": j.get("issue", ""),
        "journal.year": j.get("year", ""),
    }
    siblings = await db.articles.find(query, {"_id": 0, "id": 1, "title": 1, "created_at": 1}).sort("created_at", 1).to_list(1000)
    article_number = 1
    for idx, s in enumerate(siblings, start=1):
        if s["id"] == article_id:
            article_number = idx
            break
    return {
        "article_number": article_number,
        "total_in_issue": len(siblings),
        "siblings": [{"id": s["id"], "title": s.get("title", ""), "number": i + 1} for i, s in enumerate(siblings)],
        "volume": j.get("volume", ""),
        "issue": j.get("issue", ""),
        "year": j.get("year", ""),
    }


# ---------- Validation ----------
@api_router.post("/articles/{article_id}/validate")
async def validate(article_id: str):
    doc = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")
    article = Article(**doc)
    return validate_article(article)


@api_router.post("/validate/article")
async def validate_inline(article: Article):
    return validate_article(article)


# ---------- XML / Export ----------
def _xml_response(content: str, filename: str) -> Response:
    return Response(
        content=content,
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.get("/articles/{article_id}/jats")
async def get_jats(article_id: str, download: bool = False):
    doc = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")
    article = Article(**doc)
    xml = generate_jats(article)
    if download:
        return _xml_response(xml, f"{article.id}.jats.xml")
    return Response(content=xml, media_type="application/xml")


@api_router.get("/articles/{article_id}/pkp")
async def get_pkp(article_id: str, download: bool = False):
    doc = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")
    article = Article(**doc)
    xml = generate_pkp_native(article)
    if download:
        return _xml_response(xml, f"{article.id}.pkp.xml")
    return Response(content=xml, media_type="application/xml")


@api_router.get("/articles/{article_id}/crossref")
async def get_crossref(article_id: str, download: bool = False):
    doc = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")
    article = Article(**doc)
    xml = generate_crossref(article)
    if download:
        return _xml_response(xml, f"{article.id}.crossref.xml")
    return Response(content=xml, media_type="application/xml")


@api_router.get("/articles/{article_id}/docx")
async def get_docx(article_id: str, style: str = "apa"):
    doc = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")
    article = Article(**doc)
    data = generate_docx(article, style)
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{article.id}.docx"'},
    )


@api_router.get("/articles/{article_id}/pdf")
async def get_pdf(article_id: str):
    doc = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")
    print_url = f"http://localhost:3000/print/{article_id}"
    try:
        data = await generate_pdf_from_url(print_url)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{article_id}.pdf"'},
    )


# ---------- References ----------
@api_router.post("/references/import")
async def import_references(payload: dict = Body(...)):
    fmt = (payload.get("format") or "").lower()
    text = payload.get("content") or ""
    if fmt == "ris":
        refs = parse_ris(text)
    elif fmt == "bibtex":
        refs = parse_bibtex(text)
    elif fmt == "endnote":
        refs = parse_endnote(text)
    elif fmt == "text":
        refs = parse_references_text(text)
    else:
        raise HTTPException(status_code=400, detail="Unknown format. Use 'ris', 'bibtex', 'endnote', or 'text'.")
    return {"references": [r.model_dump() for r in refs], "count": len(refs)}


@api_router.post("/references/parse-text")
async def parse_references_endpoint(payload: dict = Body(...)):
    text = payload.get("text") or payload.get("content") or ""
    if not text.strip():
        raise HTTPException(status_code=400, detail="Empty text")
    refs = parse_references_text(text)
    return {"references": [r.model_dump() for r in refs], "count": len(refs)}


@api_router.post("/references/export")
async def export_references(payload: dict = Body(...)):
    fmt = (payload.get("format") or "").lower()
    refs_data = payload.get("references", [])
    refs = [Reference(**r) for r in refs_data]
    if fmt == "ris":
        return Response(
            content=to_ris(refs),
            media_type="application/x-research-info-systems",
            headers={"Content-Disposition": 'attachment; filename="references.ris"'},
        )
    if fmt == "bibtex":
        return Response(
            content=to_bibtex(refs),
            media_type="application/x-bibtex",
            headers={"Content-Disposition": 'attachment; filename="references.bib"'},
        )
    raise HTTPException(status_code=400, detail="Use 'ris' or 'bibtex'.")


@api_router.post("/references/format")
async def format_refs(payload: dict = Body(...)):
    style = (payload.get("style") or "apa").lower()
    refs = [Reference(**r) for r in payload.get("references", [])]
    return {"formatted": format_references(refs, style), "style": style}


# ---------- External lookups ----------
@api_router.get("/lookup/crossref")
async def crossref_lookup(doi: str):
    if not doi:
        raise HTTPException(status_code=400, detail="DOI required")
    try:
        return lookup_crossref(doi)
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"DOI not found: {doi}")
        raise HTTPException(status_code=502, detail=f"Crossref error: {e}")
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Network error: {e}")


@api_router.get("/lookup/orcid")
async def orcid_lookup(orcid: str):
    if not orcid:
        raise HTTPException(status_code=400, detail="ORCID required")
    try:
        return lookup_orcid(orcid)
    except requests.HTTPError as e:
        if e.response is not None and e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"ORCID not found: {orcid}")
        raise HTTPException(status_code=502, detail=f"ORCID error: {e}")
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Network error: {e}")


# ---------- Templates ----------
@api_router.get("/templates", response_model=List[Template])
async def list_templates():
    docs = await db.templates.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Template(**d) for d in docs]


@api_router.post("/templates", response_model=Template)
async def create_template(template: Template):
    template.created_at = _now_iso()
    await db.templates.insert_one(template.model_dump())
    return template


@api_router.get("/templates/{template_id}", response_model=Template)
async def get_template(template_id: str):
    doc = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Template not found")
    return Template(**doc)


@api_router.put("/templates/{template_id}", response_model=Template)
async def update_template(template_id: str, template: Template):
    template.id = template_id
    existing = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    template.created_at = existing.get("created_at", _now_iso())
    await db.templates.replace_one({"id": template_id}, template.model_dump())
    return template


@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    result = await db.templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"deleted": True}


# ---------- Health ----------
@api_router.get("/")
async def root():
    return {"app": "OpenJATS Editor", "version": "1.0.0"}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
