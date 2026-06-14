import React from "react";
import { Plus, Trash2, Search } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

const COUNTRIES = ["Indonesia", "Malaysia", "Singapore", "United States", "United Kingdom", "Australia", "Japan", "Germany", "Netherlands"];

export function MetadataForm({ article, onChange, templates, onApplyTemplate }) {
  const J = article.journal || {};
  const set = (path, value) => {
    const next = { ...article };
    const keys = path.split(".");
    let cur = next;
    for (let i = 0; i < keys.length - 1; i++) {
      cur[keys[i]] = { ...(cur[keys[i]] || {}) };
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    onChange(next);
  };

  return (
    <div className="space-y-6">
      {/* Apply template */}
      {templates && templates.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Apply template:</span>
          <select
            data-testid="apply-template-select"
            onChange={(e) => e.target.value && onApplyTemplate(e.target.value)}
            className="bg-background border border-border rounded-sm px-2 py-1 text-xs"
            defaultValue=""
          >
            <option value="">— Select —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name || "Untitled"}</option>
            ))}
          </select>
        </div>
      )}

      <Section title="Journal Information">
        <Field label="Journal Title" testId="field-journal-title">
          <input value={J.title || ""} onChange={(e) => set("journal.title", e.target.value)} className={inputCls} data-testid="input-journal-title" />
        </Field>
        <Field label="ISSN (Print)" testId="field-issn">
          <input value={J.issn || ""} onChange={(e) => set("journal.issn", e.target.value)} className={inputCls} placeholder="0000-0000" data-testid="input-issn" />
        </Field>
        <Field label="E-ISSN" testId="field-eissn">
          <input value={J.eissn || ""} onChange={(e) => set("journal.eissn", e.target.value)} className={inputCls} placeholder="0000-0000" data-testid="input-eissn" />
        </Field>
        <Field label="Publisher" testId="field-publisher">
          <input value={J.publisher || ""} onChange={(e) => set("journal.publisher", e.target.value)} className={inputCls} data-testid="input-publisher" />
        </Field>
        <Field label="Volume" testId="field-volume">
          <input value={J.volume || ""} onChange={(e) => set("journal.volume", e.target.value)} className={inputCls} data-testid="input-volume" />
        </Field>
        <Field label="Issue" testId="field-issue">
          <input value={J.issue || ""} onChange={(e) => set("journal.issue", e.target.value)} className={inputCls} data-testid="input-issue" />
        </Field>
        <Field label="Year" testId="field-year">
          <input value={J.year || ""} onChange={(e) => set("journal.year", e.target.value)} className={inputCls} data-testid="input-year" />
        </Field>
        <Field label="DOI Prefix" testId="field-doi-prefix">
          <input value={J.doi_prefix || ""} onChange={(e) => set("journal.doi_prefix", e.target.value)} className={inputCls} placeholder="10.1234" data-testid="input-doi-prefix" />
        </Field>
      </Section>

      <Section title="Article Metadata">
        <Field label="Article Title" colSpan={2} testId="field-title">
          <input value={article.title || ""} onChange={(e) => set("title", e.target.value)} className={inputCls} data-testid="input-title" />
        </Field>
        <Field label="Running Title" testId="field-running-title">
          <input value={article.running_title || ""} onChange={(e) => set("running_title", e.target.value)} className={inputCls} data-testid="input-running-title" />
        </Field>
        <Field label="Subtitle" testId="field-subtitle">
          <input value={article.subtitle || ""} onChange={(e) => set("subtitle", e.target.value)} className={inputCls} data-testid="input-subtitle" />
        </Field>
        <Field label="DOI" testId="field-doi">
          <div className="flex gap-1">
            <input value={article.doi || ""} onChange={(e) => set("doi", e.target.value)} className={inputCls} placeholder="10.1234/abc.5678" data-testid="input-doi" />
            <CrossrefLookup doi={article.doi} onResult={(d) => {/* could prefill */}} />
          </div>
        </Field>
        <Field label="Language" testId="field-language">
          <select value={article.language || "en"} onChange={(e) => set("language", e.target.value)} className={inputCls} data-testid="input-language">
            <option value="en">English</option>
            <option value="id">Bahasa Indonesia</option>
            <option value="ms">Bahasa Malaysia</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="zh">中文</option>
          </select>
        </Field>
        <Field label="Article Type" testId="field-article-type">
          <select value={article.article_type || "research-article"} onChange={(e) => set("article_type", e.target.value)} className={inputCls} data-testid="input-article-type">
            <option value="research-article">Research Article</option>
            <option value="review-article">Review Article</option>
            <option value="case-report">Case Report</option>
            <option value="editorial">Editorial</option>
            <option value="letter">Letter</option>
            <option value="brief-report">Brief Report</option>
          </select>
        </Field>
        <Field label="Status" testId="field-status">
          <select value={article.status || "draft"} onChange={(e) => set("status", e.target.value)} className={inputCls} data-testid="input-status">
            <option value="draft">Draft</option>
            <option value="review">Review</option>
            <option value="layout">Layout</option>
            <option value="published">Published</option>
          </select>
        </Field>
        <Field label="Keywords (comma separated)" colSpan={2} testId="field-keywords">
          <input
            value={(article.keywords || []).join(", ")}
            onChange={(e) => set("keywords", e.target.value.split(",").map((k) => k.trim()).filter(Boolean))}
            className={inputCls}
            placeholder="machine learning, neural networks, NLP"
            data-testid="input-keywords"
          />
        </Field>
        <Field label="Received" testId="field-received-date">
          <input
            type="date"
            value={article.received_date || ""}
            onChange={(e) => set("received_date", e.target.value)}
            className={inputCls}
            data-testid="input-received-date"
          />
        </Field>
        <Field label="Revised" testId="field-revised-date">
          <input
            type="date"
            value={article.revised_date || ""}
            onChange={(e) => set("revised_date", e.target.value)}
            className={inputCls}
            data-testid="input-revised-date"
          />
        </Field>
        <Field label="Accepted" testId="field-accepted-date">
          <input
            type="date"
            value={article.accepted_date || ""}
            onChange={(e) => set("accepted_date", e.target.value)}
            className={inputCls}
            data-testid="input-accepted-date"
          />
        </Field>
      </Section>

      <AuthorsManager
        authors={article.authors || []}
        onChange={(authors) => onChange({ ...article, authors })}
      />

      <Section title="Abstract">
        <Field label="Abstract (English)" colSpan={2} testId="field-abstract-en">
          <textarea
            value={article.abstract?.english || ""}
            onChange={(e) => set("abstract.english", e.target.value)}
            className={textareaCls}
            rows={6}
            data-testid="input-abstract-en"
          />
        </Field>
        <Field label="Abstrak (Bahasa Indonesia)" colSpan={2} testId="field-abstract-id">
          <textarea
            value={article.abstract?.indonesian || ""}
            onChange={(e) => set("abstract.indonesian", e.target.value)}
            className={textareaCls}
            rows={6}
            data-testid="input-abstract-id"
          />
        </Field>
      </Section>
    </div>
  );
}

function CrossrefLookup({ doi, onResult }) {
  const [loading, setLoading] = React.useState(false);
  const handle = async () => {
    if (!doi) {
      toast.error("Enter a DOI first");
      return;
    }
    setLoading(true);
    try {
      const data = await api.crossrefLookup(doi);
      toast.success(`Found: ${data.title?.slice(0, 60)}...`);
      onResult(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Lookup failed");
    }
    setLoading(false);
  };
  return (
    <button
      type="button"
      onClick={handle}
      disabled={loading}
      data-testid="crossref-lookup-btn"
      className="shrink-0 px-2 py-1.5 border border-border rounded-sm text-xs hover:bg-secondary disabled:opacity-50"
      title="Lookup via Crossref"
    >
      <Search className="h-3.5 w-3.5" />
    </button>
  );
}

export function AuthorsManager({ authors, onChange }) {
  const addAuthor = () => {
    onChange([...authors, { id: crypto.randomUUID(), given_name: "", family_name: "", full_name: "", orcid: "", email: "", affiliation: "", department: "", institution: "", country: "", corresponding: authors.length === 0 }]);
  };
  const update = (idx, key, value) => {
    const next = [...authors];
    next[idx] = { ...next[idx], [key]: value };
    if (key === "given_name" || key === "family_name") {
      next[idx].full_name = `${next[idx].given_name} ${next[idx].family_name}`.trim();
    }
    onChange(next);
  };
  const remove = (idx) => onChange(authors.filter((_, i) => i !== idx));

  const orcidLookup = async (idx) => {
    const orcid = authors[idx].orcid;
    if (!orcid) return toast.error("Enter ORCID first");
    try {
      const data = await api.orcidLookup(orcid);
      const next = [...authors];
      next[idx] = { ...next[idx], ...data };
      onChange(next);
      toast.success("ORCID data loaded");
    } catch (e) {
      toast.error(e.response?.data?.detail || "ORCID lookup failed");
    }
  };

  return (
    <Section
      title="Authors"
      action={
        <button type="button" onClick={addAuthor} data-testid="add-author-btn" className="text-xs flex items-center gap-1 px-2 py-1 border border-border rounded-sm hover:bg-secondary">
          <Plus className="h-3 w-3" /> Add Author
        </button>
      }
    >
      {authors.length === 0 ? (
        <div className="col-span-2 text-sm text-muted-foreground italic text-center py-4 border border-dashed border-border rounded-sm">
          No authors added yet
        </div>
      ) : (
        authors.map((author, idx) => (
          <div key={author.id || idx} data-testid={`author-card-${idx}`} className="col-span-2 border border-border rounded-sm p-4 bg-secondary/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Author {idx + 1}</div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!author.corresponding}
                    onChange={(e) => update(idx, "corresponding", e.target.checked)}
                    data-testid={`author-corresponding-${idx}`}
                  />
                  Corresponding
                </label>
                <button type="button" onClick={() => remove(idx)} data-testid={`author-remove-${idx}`} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Given Name" sub>
                <input value={author.given_name || ""} onChange={(e) => update(idx, "given_name", e.target.value)} className={inputCls} data-testid={`author-given-${idx}`} />
              </Field>
              <Field label="Family Name" sub>
                <input value={author.family_name || ""} onChange={(e) => update(idx, "family_name", e.target.value)} className={inputCls} data-testid={`author-family-${idx}`} />
              </Field>
              <Field label="Full Name" sub>
                <input value={author.full_name || ""} onChange={(e) => update(idx, "full_name", e.target.value)} className={inputCls} data-testid={`author-fullname-${idx}`} />
              </Field>
              <Field label="ORCID" sub>
                <div className="flex gap-1">
                  <input value={author.orcid || ""} onChange={(e) => update(idx, "orcid", e.target.value)} className={inputCls} placeholder="0000-0000-0000-0000" data-testid={`author-orcid-${idx}`} />
                  <button type="button" onClick={() => orcidLookup(idx)} data-testid={`author-orcid-lookup-${idx}`} className="px-2 border border-border rounded-sm text-xs hover:bg-secondary">
                    <Search className="h-3 w-3" />
                  </button>
                </div>
              </Field>
              <Field label="Email" sub>
                <input value={author.email || ""} onChange={(e) => update(idx, "email", e.target.value)} className={inputCls} type="email" data-testid={`author-email-${idx}`} />
              </Field>
              <Field label="Department" sub>
                <input value={author.department || ""} onChange={(e) => update(idx, "department", e.target.value)} className={inputCls} data-testid={`author-dept-${idx}`} />
              </Field>
              <Field label="Institution" sub>
                <input value={author.institution || ""} onChange={(e) => update(idx, "institution", e.target.value)} className={inputCls} data-testid={`author-institution-${idx}`} />
              </Field>
              <Field label="Affiliation" sub>
                <input value={author.affiliation || ""} onChange={(e) => update(idx, "affiliation", e.target.value)} className={inputCls} data-testid={`author-affiliation-${idx}`} />
              </Field>
              <Field label="Country" sub>
                <input list="ojats-countries" value={author.country || ""} onChange={(e) => update(idx, "country", e.target.value)} className={inputCls} data-testid={`author-country-${idx}`} />
                <datalist id="ojats-countries">
                  {COUNTRIES.map((c) => <option key={c} value={c} />)}
                </datalist>
              </Field>
            </div>
          </div>
        ))
      )}
    </Section>
  );
}

const inputCls = "w-full bg-background border border-border rounded-sm px-2.5 py-1.5 text-sm focus:border-primary";
const textareaCls = "w-full bg-background border border-border rounded-sm px-2.5 py-2 text-sm focus:border-primary editor-area font-serif-editor";

function Section({ title, children, action }) {
  return (
    <div className="border border-border rounded-sm bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h3 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{title}</h3>
        {action}
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

function Field({ label, children, colSpan = 1, sub = false, testId }) {
  return (
    <div className={colSpan === 2 ? "col-span-2" : ""} data-testid={testId}>
      <label className={`block ${sub ? "text-[10px]" : "text-xs"} uppercase tracking-wider text-muted-foreground mb-1`}>
        {label}
      </label>
      {children}
    </div>
  );
}
