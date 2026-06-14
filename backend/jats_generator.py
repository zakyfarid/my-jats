"""JATS Publishing 1.3 XML generator for OpenJATS Editor."""
from xml.sax.saxutils import escape
from typing import List
from models import Article, Author, Reference


def _esc(s) -> str:
    if s is None:
        return ""
    return escape(str(s), {'"': "&quot;", "'": "&apos;"})


def _author_xml(author: Author, idx: int, aff_map: dict) -> str:
    aff_id = aff_map.get(author.affiliation, "")
    contrib_type = ' corresp="yes"' if author.corresponding else ""
    name = f"""    <contrib contrib-type="author"{contrib_type}>
      <contrib-id contrib-id-type="orcid">{_esc(author.orcid)}</contrib-id>
      <name>
        <surname>{_esc(author.family_name)}</surname>
        <given-names>{_esc(author.given_name)}</given-names>
      </name>
      <xref ref-type="aff" rid="{aff_id}"/>
      <email>{_esc(author.email)}</email>
    </contrib>"""
    return name


def _references_xml(refs: List[Reference]) -> str:
    if not refs:
        return ""
    items = []
    for i, ref in enumerate(refs, start=1):
        authors_xml = "".join(
            f"<string-name>{_esc(a)}</string-name>" for a in ref.authors
        )
        ref_xml = f"""      <ref id="ref-{i}">
        <element-citation publication-type="{_esc(ref.type)}">
          <person-group person-group-type="author">{authors_xml}</person-group>
          <article-title>{_esc(ref.title)}</article-title>
          <source>{_esc(ref.journal or ref.publisher)}</source>
          <year>{_esc(ref.year)}</year>
          <volume>{_esc(ref.volume)}</volume>
          <issue>{_esc(ref.issue)}</issue>
          <fpage>{_esc(ref.pages.split('-')[0] if '-' in ref.pages else ref.pages)}</fpage>
          <lpage>{_esc(ref.pages.split('-')[1] if '-' in ref.pages else '')}</lpage>
          <pub-id pub-id-type="doi">{_esc(ref.doi)}</pub-id>
          <ext-link ext-link-type="uri" xlink:href="{_esc(ref.url)}">{_esc(ref.url)}</ext-link>
        </element-citation>
      </ref>"""
        items.append(ref_xml)
    return "\n".join(items)


def _section(tag_id: str, title: str, body: str) -> str:
    if not body or not body.strip():
        return ""
    paragraphs = [f"<p>{_esc(p)}</p>" for p in body.split("\n\n") if p.strip()]
    body_xml = "\n        ".join(paragraphs)
    return f"""    <sec id="{tag_id}" sec-type="{tag_id}">
      <title>{_esc(title)}</title>
        {body_xml}
    </sec>"""


def generate_jats(article: Article) -> str:
    """Generate JATS Publishing 1.3 compliant XML."""
    j = article.journal
    # Build affiliation map (unique affiliations)
    aff_map = {}
    affs_xml = []
    for author in article.authors:
        if author.affiliation and author.affiliation not in aff_map:
            aff_id = f"aff{len(aff_map) + 1}"
            aff_map[author.affiliation] = aff_id
            affs_xml.append(
                f"""    <aff id="{aff_id}">
      <institution-wrap>
        <institution content-type="dept">{_esc(author.department)}</institution>
        <institution>{_esc(author.institution or author.affiliation)}</institution>
      </institution-wrap>
      <country>{_esc(author.country)}</country>
    </aff>"""
            )

    contribs_xml = "\n".join(_author_xml(a, i, aff_map) for i, a in enumerate(article.authors))
    affs_block = "\n".join(affs_xml)

    sections_xml_parts = [
        _section("intro", "Introduction", article.sections.introduction),
        _section("methods", "Methods", article.sections.methods),
        _section("results", "Results", article.sections.results),
        _section("discussion", "Discussion", article.sections.discussion),
        _section("conclusion", "Conclusion", article.sections.conclusion),
    ]
    sections_xml = "\n".join(p for p in sections_xml_parts if p)

    back_parts = []
    if article.sections.acknowledgement:
        back_parts.append(f"""    <ack>
      <title>Acknowledgements</title>
      <p>{_esc(article.sections.acknowledgement)}</p>
    </ack>""")
    if article.sections.funding:
        back_parts.append(f"""    <funding-group>
      <funding-statement>{_esc(article.sections.funding)}</funding-statement>
    </funding-group>""")
    if article.sections.conflict_of_interest:
        back_parts.append(f"""    <fn-group>
      <fn fn-type="coi-statement"><p>{_esc(article.sections.conflict_of_interest)}</p></fn>
    </fn-group>""")
    refs_xml = _references_xml(article.references)
    if refs_xml:
        back_parts.append(f"""    <ref-list>
      <title>References</title>
{refs_xml}
    </ref-list>""")

    abstract_kw = "".join(
        f"<kwd>{_esc(k)}</kwd>" for k in (article.keywords or article.abstract.keywords)
    )

    # build keyword section
    kwd_group = ""
    if article.keywords or article.abstract.keywords:
        kwd_group = f"""      <kwd-group kwd-group-type="author">{abstract_kw}</kwd-group>"""

    # build history block (received/revised/accepted)
    def _date_xml(label: str, iso: str) -> str:
        if not iso:
            return ""
        parts = iso.split("-")
        if len(parts) < 3:
            return ""
        y, m, d = parts[0], parts[1], parts[2]
        return f"""        <date date-type="{label}"><day>{d}</day><month>{m}</month><year>{y}</year></date>"""

    history_dates = [
        _date_xml("received", article.received_date),
        _date_xml("rev-recd", article.revised_date),
        _date_xml("accepted", article.accepted_date),
    ]
    history_dates = [d for d in history_dates if d]
    history_block = ""
    if history_dates:
        history_block = "      <history>\n" + "\n".join(history_dates) + "\n      </history>"

    abstract_id_block = ""
    if article.abstract.indonesian:
        abstract_id_block = f"""      <trans-abstract xml:lang="id"><p>{_esc(article.abstract.indonesian)}</p></trans-abstract>"""

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE article PUBLIC "-//NLM//DTD JATS (Z39.96) Journal Publishing DTD v1.3 20210610//EN" "JATS-journalpublishing1.dtd">
<article xmlns:xlink="http://www.w3.org/1999/xlink" article-type="{_esc(article.article_type)}" xml:lang="{_esc(article.language)}" dtd-version="1.3">
  <front>
    <journal-meta>
      <journal-id journal-id-type="publisher-id">{_esc(j.title)}</journal-id>
      <journal-title-group>
        <journal-title>{_esc(j.title)}</journal-title>
      </journal-title-group>
      <issn pub-type="ppub">{_esc(j.issn)}</issn>
      <issn pub-type="epub">{_esc(j.eissn)}</issn>
      <publisher>
        <publisher-name>{_esc(j.publisher)}</publisher-name>
      </publisher>
    </journal-meta>
    <article-meta>
      <article-id pub-id-type="doi">{_esc(article.doi)}</article-id>
      <article-categories>
        <subj-group subj-group-type="heading">
          <subject>{_esc(article.article_type)}</subject>
        </subj-group>
      </article-categories>
      <title-group>
        <article-title>{_esc(article.title)}</article-title>
        <subtitle>{_esc(article.subtitle)}</subtitle>
        <alt-title alt-title-type="running-head">{_esc(article.running_title)}</alt-title>
      </title-group>
      <contrib-group>
{contribs_xml}
      </contrib-group>
{affs_block}
      <pub-date pub-type="epub">
        <year>{_esc(j.year)}</year>
      </pub-date>
      <volume>{_esc(j.volume)}</volume>
      <issue>{_esc(j.issue)}</issue>
{history_block}
      <abstract>
        <p>{_esc(article.abstract.english)}</p>
      </abstract>
{abstract_id_block}
{kwd_group}
    </article-meta>
  </front>
  <body>
{sections_xml}
  </body>
  <back>
{chr(10).join(back_parts)}
  </back>
</article>
"""
    return xml


def generate_pkp_native(article: Article) -> str:
    """PKP Native XML for OJS import."""
    j = article.journal
    authors_xml = ""
    for i, a in enumerate(article.authors, 1):
        primary = ' primary_contact="true"' if a.corresponding else ""
        authors_xml += f"""      <author{primary} user_group_ref="Author" seq="{i}">
        <givenname>{_esc(a.given_name)}</givenname>
        <familyname>{_esc(a.family_name)}</familyname>
        <affiliation>{_esc(a.affiliation)}</affiliation>
        <country>{_esc(a.country)}</country>
        <email>{_esc(a.email)}</email>
        <orcid>{_esc(a.orcid)}</orcid>
      </author>
"""
    keywords_xml = "".join(f"<keyword>{_esc(k)}</keyword>" for k in article.keywords)
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<article xmlns="http://pkp.sfu.ca" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" locale="{_esc(article.language)}" date_submitted="{_esc(article.created_at[:10])}" status="3" submission_progress="" current_publication_id="1" stage="production">
  <id type="internal" advice="ignore">1</id>
  <title locale="{_esc(article.language)}">{_esc(article.title)}</title>
  <subtitle locale="{_esc(article.language)}">{_esc(article.subtitle)}</subtitle>
  <abstract locale="{_esc(article.language)}">{_esc(article.abstract.english)}</abstract>
  <keywords locale="{_esc(article.language)}">{keywords_xml}</keywords>
  <authors xmlns="http://pkp.sfu.ca">
{authors_xml}  </authors>
  <article_galley>
    <id type="internal" advice="ignore">1</id>
    <name locale="{_esc(article.language)}">PDF</name>
    <seq>0</seq>
  </article_galley>
  <issue_identification>
    <volume>{_esc(j.volume)}</volume>
    <number>{_esc(j.issue)}</number>
    <year>{_esc(j.year)}</year>
  </issue_identification>
  <pages>1-12</pages>
  <article_identification>
    <doi>{_esc(article.doi)}</doi>
  </article_identification>
</article>
"""


def generate_crossref(article: Article) -> str:
    """Crossref deposit XML."""
    j = article.journal
    contribs = []
    for i, a in enumerate(article.authors):
        seq = "first" if i == 0 else "additional"
        contribs.append(f"""        <person_name sequence="{seq}" contributor_role="author">
          <given_name>{_esc(a.given_name)}</given_name>
          <surname>{_esc(a.family_name)}</surname>
          <affiliation>{_esc(a.affiliation)}</affiliation>
          <ORCID>{_esc(a.orcid)}</ORCID>
        </person_name>""")
    contributors = "\n".join(contribs)
    citations = ""
    for i, r in enumerate(article.references, 1):
        citations += f"""        <citation key="ref-{i}">
          <article_title>{_esc(r.title)}</article_title>
          <journal_title>{_esc(r.journal)}</journal_title>
          <author>{_esc(r.authors[0] if r.authors else '')}</author>
          <volume>{_esc(r.volume)}</volume>
          <first_page>{_esc(r.pages)}</first_page>
          <cYear>{_esc(r.year)}</cYear>
          <doi>{_esc(r.doi)}</doi>
        </citation>
"""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<doi_batch version="5.3.1" xmlns="http://www.crossref.org/schema/5.3.1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.crossref.org/schema/5.3.1 https://www.crossref.org/schemas/crossref5.3.1.xsd">
  <head>
    <doi_batch_id>OPENJATS-{_esc(article.id)}</doi_batch_id>
    <timestamp>{_esc(article.updated_at)}</timestamp>
    <depositor>
      <depositor_name>OpenJATS Editor</depositor_name>
      <email_address>noreply@openjats.local</email_address>
    </depositor>
    <registrant>{_esc(j.publisher)}</registrant>
  </head>
  <body>
    <journal>
      <journal_metadata>
        <full_title>{_esc(j.title)}</full_title>
        <issn media_type="print">{_esc(j.issn)}</issn>
        <issn media_type="electronic">{_esc(j.eissn)}</issn>
      </journal_metadata>
      <journal_issue>
        <publication_date media_type="online"><year>{_esc(j.year)}</year></publication_date>
        <journal_volume><volume>{_esc(j.volume)}</volume></journal_volume>
        <issue>{_esc(j.issue)}</issue>
      </journal_issue>
      <journal_article publication_type="full_text">
        <titles>
          <title>{_esc(article.title)}</title>
          <subtitle>{_esc(article.subtitle)}</subtitle>
        </titles>
        <contributors>
{contributors}
        </contributors>
        <abstract><p>{_esc(article.abstract.english)}</p></abstract>
        <publication_date media_type="online"><year>{_esc(j.year)}</year></publication_date>
        <doi_data>
          <doi>{_esc(article.doi)}</doi>
          <resource>https://doi.org/{_esc(article.doi)}</resource>
        </doi_data>
        <citation_list>
{citations}
        </citation_list>
      </journal_article>
    </journal>
  </body>
</doi_batch>
"""
