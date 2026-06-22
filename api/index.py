"""FastAPI server for OpenJATS Editor."""
from fastapi import FastAPI, APIRouter, HTTPException, Body, Depends, UploadFile, File
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
from docx_parser import parse_docx_template
from pdf_generator import generate_pdf_from_url
from auth import (
    User, UserPublic, LoginRequest, CreateAdminRequest,
    hash_password, verify_password, create_token,
    get_current_user, require_super_admin,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="OpenJATS Editor API")
api_router = APIRouter(prefix="/api")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Auth ----------
@api_router.post("/auth/login")
async def auth_login(payload: LoginRequest):
    email = payload.email.strip().lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], user["email"], user["role"])
    public = {k: user.get(k, "") for k in ("id", "email", "name", "role", "created_at")}
    return {"token": token, "user": public}


@api_router.get("/auth/me", response_model=UserPublic)
async def auth_me(user: dict = Depends(get_current_user)):
    doc = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    if not doc:
        raise HTTPException(status_code=401, detail="User not found")
    return UserPublic(**doc)


# Admin management — super_admin only
@api_router.get("/admins", response_model=List[UserPublic])
async def list_admins(_: dict = Depends(require_super_admin)):
    docs = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return [UserPublic(**d) for d in docs]


@api_router.post("/admins", response_model=UserPublic)
async def create_admin(payload: CreateAdminRequest, _: dict = Depends(require_super_admin)):
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email required")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    new_user = User(
        email=email,
        name=payload.name or "",
        role="admin",
        password_hash=hash_password(payload.password),
    )
    await db.users.insert_one(new_user.model_dump())
    return UserPublic(**new_user.model_dump(exclude={"password_hash"}))


@api_router.delete("/admins/{user_id}")
async def delete_admin(user_id: str, current: dict = Depends(require_super_admin)):
    if user_id == current["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    doc = await db.users.find_one({"id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="User not found")
    if doc.get("role") == "super_admin":
        raise HTTPException(status_code=400, detail="Cannot delete super admin")
    await db.users.delete_one({"id": user_id})
    return {"deleted": True}


# ---------- Articles ----------
@api_router.get("/articles", response_model=List[ArticleSummary])
async def list_articles(
    q: Optional[str] = None,
    status: Optional[str] = None,
    volume: Optional[str] = None,
    issue: Optional[str] = None,
    year: Optional[str] = None,
    _: dict = Depends(get_current_user),
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
async def create_article(article: Article, _: dict = Depends(get_current_user)):
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
async def update_article(article_id: str, article: Article, _: dict = Depends(get_current_user)):
    article.id = article_id
    article.updated_at = _now_iso()
    existing = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Article not found")
    article.created_at = existing.get("created_at", _now_iso())
    await db.articles.replace_one({"id": article_id}, article.model_dump())
    return article


@api_router.delete("/articles/{article_id}")
async def delete_article(article_id: str, _: dict = Depends(get_current_user)):
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


@api_router.post("/articles/upload-docx", response_model=Article)
async def upload_docx_template(file: UploadFile = File(...), _: dict = Depends(get_current_user)):
    """Upload a DOCX file, auto-detect title and IMRAD sections, return new article."""
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx files are supported")
    data = await file.read()
    try:
        parsed = parse_docx_template(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse DOCX: {e}")

    # Build a new article from parsed content
    art = Article(
        title=parsed.get("title", "") or "Untitled (from DOCX)",
        keywords=parsed.get("keywords", []),
        status="draft",
    )
    art.abstract.english = parsed.get("abstract", "")
    for k, v in parsed.get("sections", {}).items():
        if hasattr(art.sections, k):
            setattr(art.sections, k, v or "")

    # Try to parse references from the references_text
    refs_text = parsed.get("references_text", "")
    if refs_text:
        try:
            parsed_refs = parse_references_text(refs_text)
            art.references = parsed_refs
        except Exception:
            pass

    art.created_at = _now_iso()
    art.updated_at = _now_iso()
    await db.articles.insert_one(art.model_dump())
    return art


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
async def get_docx(article_id: str, style: Optional[str] = None):
    doc = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")
    article = Article(**doc)
    effective_style = style or article.citation_style or "apa"
    data = generate_docx(article, effective_style)
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
async def create_template(template: Template, _: dict = Depends(get_current_user)):
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
async def delete_template(template_id: str, _: dict = Depends(get_current_user)):
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


@app.on_event("startup")
async def seed_super_admin():
    email = (os.environ.get("SUPER_ADMIN_EMAIL") or "superadmin@openjats.local").strip().lower()
    password = os.environ.get("SUPER_ADMIN_PASSWORD", "changeme123")
    existing = await db.users.find_one({"email": email})
    if not existing:
        user = User(email=email, name="Super Admin", role="super_admin", password_hash=hash_password(password))
        await db.users.insert_one(user.model_dump())
        logger.info("Seeded super admin %s", email)
    elif not verify_password(password, existing.get("password_hash", "")):
        await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(password)}})
        logger.info("Updated super admin password for %s", email)
    try:
        await db.users.create_index("email", unique=True)
    except Exception:
        pass


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
