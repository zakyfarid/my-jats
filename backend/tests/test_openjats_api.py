"""Backend API tests for OpenJATS Editor.

Covers: articles CRUD, validation, XML/JATS/PKP/Crossref/DOCX export,
reference import/export/format, templates CRUD, and external lookup
endpoints (Crossref/ORCID, best-effort).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://jats-xml-studio.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

RIS_SAMPLE = """TY  - JOUR
AU  - Smith, John
AU  - Doe, Jane
TI  - A study of machine learning
JO  - Journal of AI
PY  - 2023
VL  - 10
IS  - 2
SP  - 100
EP  - 120
DO  - 10.1234/jai.2023.001
ER  - 
"""

BIBTEX_SAMPLE = """@article{smith2023,
  author = {Smith, John and Doe, Jane},
  title = {Machine learning study},
  journal = {Journal of AI},
  year = {2023},
  volume = {10},
  number = {2},
  pages = {100--120},
  doi = {10.1234/jai.2023.001}
}
"""

ENDNOTE_SAMPLE = """<?xml version="1.0" encoding="UTF-8"?>
<xml><records><record>
<contributors><authors><author>Smith, J.</author><author>Doe, J.</author></authors></contributors>
<titles><title>EndNote sample title</title><secondary-title>Journal of Tests</secondary-title></titles>
<dates><year>2022</year></dates>
<volume>3</volume><number>1</number><pages>1-10</pages>
<electronic-resource-num>10.1234/en.2022.001</electronic-resource-num>
</record></records></xml>
"""


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created_article(session):
    payload = {"title": "TEST_Article from pytest", "status": "draft"}
    r = session.post(f"{API}/articles", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    yield data
    # cleanup
    session.delete(f"{API}/articles/{data['id']}")


# ---------- Health ----------
def test_root_health(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    body = r.json()
    assert body.get("app") == "OpenJATS Editor"


# ---------- Articles CRUD ----------
def test_create_article(session):
    r = session.post(f"{API}/articles", json={"title": "TEST_create"})
    assert r.status_code == 200
    a = r.json()
    assert a["title"] == "TEST_create"
    assert "id" in a
    session.delete(f"{API}/articles/{a['id']}")


def test_get_article(session, created_article):
    r = session.get(f"{API}/articles/{created_article['id']}")
    assert r.status_code == 200
    assert r.json()["id"] == created_article["id"]


def test_list_articles(session, created_article):
    r = session.get(f"{API}/articles")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    ids = [a["id"] for a in r.json()]
    assert created_article["id"] in ids


def test_list_articles_filters(session):
    # journal.volume / issue / year / status filters should not error
    r = session.get(f"{API}/articles", params={"status": "draft", "year": "2026", "q": "TEST"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_update_article(session, created_article):
    body = dict(created_article)
    body["title"] = "TEST_updated"
    body.setdefault("journal", {})["volume"] = "12"
    r = session.put(f"{API}/articles/{created_article['id']}", json=body)
    assert r.status_code == 200, r.text
    assert r.json()["title"] == "TEST_updated"
    # GET verifies persistence
    g = session.get(f"{API}/articles/{created_article['id']}").json()
    assert g["title"] == "TEST_updated"
    assert g["journal"]["volume"] == "12"


def test_delete_article(session):
    r = session.post(f"{API}/articles", json={"title": "TEST_del"})
    aid = r.json()["id"]
    d = session.delete(f"{API}/articles/{aid}")
    assert d.status_code == 200
    g = session.get(f"{API}/articles/{aid}")
    assert g.status_code == 404


def test_get_missing_article(session):
    r = session.get(f"{API}/articles/nonexistent-id-xyz")
    assert r.status_code == 404


# ---------- Validation ----------
def test_validate_inline(session):
    article = {
        "title": "",
        "abstract": {"english": "", "indonesian": ""},
        "authors": [{"email": "not-an-email", "orcid": "bad"}],
        "doi": "not-a-doi",
        "references": [],
    }
    r = session.post(f"{API}/validate/article", json=article)
    assert r.status_code == 200
    data = r.json()
    assert "errors" in data and "warnings" in data
    # missing title should be an error
    err_texts = " ".join(str(e) for e in data["errors"])
    assert "title" in err_texts.lower()


def test_validate_by_id(session, created_article):
    r = session.post(f"{API}/articles/{created_article['id']}/validate")
    assert r.status_code == 200
    data = r.json()
    assert "errors" in data and "warnings" in data


# ---------- XML / Export ----------
def test_get_jats(session, created_article):
    r = session.get(f"{API}/articles/{created_article['id']}/jats")
    assert r.status_code == 200
    assert "xml" in r.headers.get("content-type", "")
    assert r.text.lstrip().startswith("<?xml") or "<article" in r.text


def test_get_pkp(session, created_article):
    r = session.get(f"{API}/articles/{created_article['id']}/pkp")
    assert r.status_code == 200
    assert "xml" in r.headers.get("content-type", "")


def test_get_crossref_xml(session, created_article):
    r = session.get(f"{API}/articles/{created_article['id']}/crossref")
    assert r.status_code == 200
    assert "xml" in r.headers.get("content-type", "")


def test_jats_download_disposition(session, created_article):
    r = session.get(f"{API}/articles/{created_article['id']}/jats", params={"download": "true"})
    assert r.status_code == 200
    assert "attachment" in r.headers.get("content-disposition", "")


def test_get_docx(session, created_article):
    r = session.get(f"{API}/articles/{created_article['id']}/docx")
    assert r.status_code == 200
    ct = r.headers.get("content-type", "")
    assert "wordprocessingml" in ct
    # DOCX files start with PK (zip)
    assert r.content[:2] == b"PK"


# ---------- References ----------
def test_import_ris(session):
    r = session.post(f"{API}/references/import", json={"format": "ris", "content": RIS_SAMPLE})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["count"] >= 1
    ref = data["references"][0]
    assert "machine learning" in ref["title"].lower()
    assert ref["year"] == "2023"
    assert ref["doi"] == "10.1234/jai.2023.001"


def test_import_bibtex(session):
    r = session.post(f"{API}/references/import", json={"format": "bibtex", "content": BIBTEX_SAMPLE})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["count"] >= 1
    ref = data["references"][0]
    assert "machine learning" in ref["title"].lower()


def test_import_endnote(session):
    r = session.post(f"{API}/references/import", json={"format": "endnote", "content": ENDNOTE_SAMPLE})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["count"] >= 1


def test_import_bad_format(session):
    r = session.post(f"{API}/references/import", json={"format": "unknown", "content": "x"})
    assert r.status_code == 400


def test_export_bibtex(session):
    refs = [{"title": "TEST", "authors": ["Doe, J."], "year": "2024", "journal": "J"}]
    r = session.post(f"{API}/references/export", json={"format": "bibtex", "references": refs})
    assert r.status_code == 200
    assert "bibtex" in r.headers.get("content-type", "")
    assert "@" in r.text


def test_export_ris(session):
    refs = [{"title": "TEST", "authors": ["Doe, J."], "year": "2024", "journal": "J"}]
    r = session.post(f"{API}/references/export", json={"format": "ris", "references": refs})
    assert r.status_code == 200
    assert "research-info-systems" in r.headers.get("content-type", "")
    assert "TY  -" in r.text


def test_format_refs_apa(session):
    refs = [{"title": "Test Paper", "authors": ["Smith, J.", "Doe, J."], "year": "2023",
             "journal": "J. AI", "volume": "1", "issue": "2", "pages": "10-20",
             "doi": "10.1/abc"}]
    r = session.post(f"{API}/references/format", json={"style": "apa", "references": refs})
    assert r.status_code == 200
    data = r.json()
    assert data["style"] == "apa"
    assert len(data["formatted"]) == 1


def test_format_refs_vancouver(session):
    refs = [{"title": "T", "authors": ["A"], "year": "2024", "journal": "J"}]
    r = session.post(f"{API}/references/format", json={"style": "vancouver", "references": refs})
    assert r.status_code == 200
    assert r.json()["style"] == "vancouver"


# ---------- Templates ----------
def test_template_crud(session):
    # create
    body = {"name": "TEST_template", "journal": {"title": "J", "issn": "1234-5678"},
            "license": "CC-BY 4.0", "copyright_statement": "(c) 2026"}
    r = session.post(f"{API}/templates", json=body)
    assert r.status_code == 200
    tpl = r.json()
    tid = tpl["id"]

    # list
    lst = session.get(f"{API}/templates").json()
    assert any(t["id"] == tid for t in lst)

    # get
    g = session.get(f"{API}/templates/{tid}")
    assert g.status_code == 200
    assert g.json()["name"] == "TEST_template"

    # update
    upd = dict(tpl)
    upd["name"] = "TEST_template_v2"
    u = session.put(f"{API}/templates/{tid}", json=upd)
    assert u.status_code == 200
    assert u.json()["name"] == "TEST_template_v2"

    # delete
    d = session.delete(f"{API}/templates/{tid}")
    assert d.status_code == 200
    assert session.get(f"{API}/templates/{tid}").status_code == 404


# ---------- External lookups (best-effort) ----------
def test_lookup_crossref():
    r = requests.get(f"{API}/lookup/crossref", params={"doi": "10.1038/nature12373"}, timeout=20)
    if r.status_code in (502, 504):
        pytest.skip(f"Crossref network unavailable: {r.status_code}")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "title" in data
    assert isinstance(data.get("authors", []), list)


def test_lookup_crossref_missing_doi():
    r = requests.get(f"{API}/lookup/crossref", timeout=10)
    # missing query param should be 422 from FastAPI or 400 from our handler
    assert r.status_code in (400, 422)


def test_lookup_orcid():
    r = requests.get(f"{API}/lookup/orcid", params={"orcid": "0000-0002-1825-0097"}, timeout=20)
    if r.status_code in (502, 504):
        pytest.skip(f"ORCID network unavailable: {r.status_code}")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "given_name" in data or "family_name" in data
