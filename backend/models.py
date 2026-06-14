"""Pydantic models for OpenJATS Editor."""
from __future__ import annotations
from datetime import datetime, timezone
from typing import List, Optional, Literal
import uuid
from pydantic import BaseModel, Field, ConfigDict


def _new_id() -> str:
    return str(uuid.uuid4())


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Journal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    title: str = ""
    issn: str = ""
    eissn: str = ""
    publisher: str = ""
    volume: str = ""
    issue: str = ""
    year: str = ""
    doi_prefix: str = ""
    logo: str = ""  # base64 data URL of journal logo
    custom_header: str = ""  # free-text header line (e.g. journal tagline / website)


class Author(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_new_id)
    given_name: str = ""
    family_name: str = ""
    full_name: str = ""
    orcid: str = ""
    email: str = ""
    affiliation: str = ""
    department: str = ""
    institution: str = ""
    country: str = ""
    corresponding: bool = False


class Abstract(BaseModel):
    model_config = ConfigDict(extra="ignore")
    english: str = ""
    indonesian: str = ""
    keywords: List[str] = Field(default_factory=list)


class Sections(BaseModel):
    model_config = ConfigDict(extra="ignore")
    introduction: str = ""
    methods: str = ""
    results: str = ""
    discussion: str = ""
    conclusion: str = ""
    acknowledgement: str = ""
    funding: str = ""
    conflict_of_interest: str = ""
    data_availability: str = ""
    author_contributions: str = ""
    ethical_approval: str = ""


class Reference(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_new_id)
    type: str = "journal"  # journal, book, chapter, web
    authors: List[str] = Field(default_factory=list)  # "Family, G." strings
    title: str = ""
    journal: str = ""
    year: str = ""
    volume: str = ""
    issue: str = ""
    pages: str = ""
    doi: str = ""
    url: str = ""
    publisher: str = ""
    raw: str = ""


class Figure(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_new_id)
    label: str = ""  # e.g. "Figure 1"
    caption: str = ""
    data_url: str = ""  # base64 encoded image
    width: str = "full"  # full | half | third


class Article(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_new_id)
    title: str = ""
    running_title: str = ""
    subtitle: str = ""
    doi: str = ""
    keywords: List[str] = Field(default_factory=list)
    language: str = "en"
    article_type: str = "research-article"
    status: Literal["draft", "review", "layout", "published"] = "draft"
    received_date: str = ""
    revised_date: str = ""
    accepted_date: str = ""
    journal: Journal = Field(default_factory=Journal)
    authors: List[Author] = Field(default_factory=list)
    abstract: Abstract = Field(default_factory=Abstract)
    sections: Sections = Field(default_factory=Sections)
    references: List[Reference] = Field(default_factory=list)
    figures: List[Figure] = Field(default_factory=list)
    created_at: str = Field(default_factory=_now_iso)
    updated_at: str = Field(default_factory=_now_iso)


class ArticleSummary(BaseModel):
    id: str
    title: str
    status: str
    authors: List[str] = Field(default_factory=list)
    journal_title: str = ""
    volume: str = ""
    issue: str = ""
    year: str = ""
    updated_at: str = ""


class Template(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=_new_id)
    name: str = ""
    journal: Journal = Field(default_factory=Journal)
    copyright_statement: str = ""
    license: str = "CC-BY 4.0"
    publisher_info: str = ""
    created_at: str = Field(default_factory=_now_iso)
