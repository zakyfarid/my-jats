import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { MetadataForm } from "../components/MetadataForm";
import { IMRADEditor } from "../components/IMRADEditor";
import { ReferencesManager } from "../components/ReferencesManager";
import { ValidationPanel } from "../components/ValidationPanel";
import { XMLPreview } from "../components/XMLPreview";
import { PDFPreview } from "../components/PDFPreview";
import { api } from "../lib/api";
import { toast } from "sonner";
import { ArrowLeft, Download, Save, FileText, ListChecks, BookText, FileCode, Eye, ChevronDown } from "lucide-react";

const TABS = [
  { id: "metadata", label: "Metadata", icon: ListChecks },
  { id: "structure", label: "IMRAD Editor", icon: BookText },
  { id: "references", label: "References", icon: FileText },
  { id: "xml", label: "JATS XML", icon: FileCode },
  { id: "pkp", label: "PKP XML", icon: FileCode },
  { id: "crossref", label: "Crossref", icon: FileCode },
  { id: "pdf", label: "PDF Preview", icon: Eye },
];

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("metadata");
  const [xml, setXml] = useState({ jats: "", pkp: "", crossref: "" });
  const [validation, setValidation] = useState({ errors: [], warnings: [], valid: true });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [formattedRefs, setFormattedRefs] = useState([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [issueInfo, setIssueInfo] = useState(null);

  const citationStyle = article?.citation_style || "apa";
  const referencesCount = article?.references?.length || 0;
  const articleRef = useRef(null);
  const validationTimer = useRef(null);
  const autosaveTimer = useRef(null);

  useEffect(() => {
    if (!article) return;
    articleRef.current = article;
    clearTimeout(validationTimer.current);
    validationTimer.current = setTimeout(() => {
      api.validateInline(article).then(setValidation).catch(() => {});
    }, 500);

    // Regenerate XML if currently viewing a preview tab
    if (["xml", "pkp", "crossref"].includes(tab)) {
      refreshXML(tab);
    }
    if (tab === "pdf") {
      api.formatReferences(article.references || [], citationStyle).then((d) => setFormattedRefs(d.formatted)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article]);

  // Re-format references when references list OR citation style changes
  useEffect(() => {  if (!article) return;  const style = article.citation_style || "apa";  api.formatReferences(article.references || [], style)
    .then((d) => setFormattedRefs(d.formatted))
    .catch(() => {});}, [article]);
  useEffect(() => {
    if (!article) return;
    clearInterval(autosaveTimer.current);
    autosaveTimer.current = setInterval(() => {
      if (dirty && articleRef.current) {
        doSave(true);
      }
    }, 30000);
    return () => clearInterval(autosaveTimer.current);
  }, [article, dirty]); // eslint-disable-line

  const refreshXML = async (which) => {
    if (!article) return;
    try {
      // Save first to ensure backend XML reflects latest
      let curr = article;
      if (dirty) {
        curr = await api.updateArticle(id, articleRef.current || article);
        setArticle(curr);
        articleRef.current = curr;
        setDirty(false);
        setSavedAt(new Date());
      }
      const map = { xml: "jats", pkp: "pkp", crossref: "crossref" };
      const key = map[which] || which;
      const fn = key === "pkp" ? api.getPKP : key === "crossref" ? api.getCrossref : api.getJATS;
      const data = await fn(id);
      setXml((x) => ({ ...x, [key]: data }));
    } catch (e) {
      toast.error("XML generation failed");
    }
  };

  const onChange = (next) => {
    articleRef.current = next;
    setArticle(next);
    setDirty(true);
  };

  const doSave = useCallback(async (silent = false) => {
    if (!articleRef.current) return;
    setSaving(true);
    try {
      const updated = await api.updateArticle(id, articleRef.current);
      setArticle(updated);
      articleRef.current = updated;
      setDirty(false);
      setSavedAt(new Date());
      if (!silent) toast.success("Saved");
    } catch (e) {
      toast.error("Save failed");
    }
    setSaving(false);
  }, [id]);

  const onTabChange = (newTab) => {
    setTab(newTab);
    if (["xml", "pkp", "crossref"].includes(newTab)) {
      refreshXML(newTab);
    }
    if (newTab === "pdf" && article) {
      api.formatReferences(article.references || [], citationStyle).then((d) => setFormattedRefs(d.formatted)).catch(() => {});
      api.getIssueInfo(id).then(setIssueInfo).catch(() => setIssueInfo(null));
    }
  };

  const applyTemplate = async (templateId) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    const merged = {
      ...article,
      journal: { ...article.journal, ...tpl.journal },
    };
    articleRef.current = merged;
    setArticle(merged);
    setDirty(true);
    toast.success(`Template "${tpl.name}" applied`);
  };

  const onJumpToField = (field) => {
    // Switch to appropriate tab
    if (field.startsWith("title") || field.startsWith("doi") || field.startsWith("authors") || field.startsWith("abstract")) {
      setTab("metadata");
      setTimeout(() => {
        const root = field.split(".")[0].replace(/\[\d+\]/g, "");
        const el = document.querySelector(`[data-testid="input-${root}"], [data-testid^="author-card-"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } else if (field.startsWith("sections")) {
      setTab("structure");
      const key = field.split(".")[1];
      setTimeout(() => {
        const btn = document.querySelector(`[data-testid="section-tab-${key}"]`);
        if (btn) btn.click();
      }, 100);
    } else if (field.startsWith("references")) {
      setTab("references");
    }
  };

  if (loading || !article) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground" data-testid="editor-loading">Loading editor...</div>
      </div>
    );
  }

  const downloadXMLLink = (kind) => api.downloadXML(id, kind);
  const docxLink = api.downloadDOCX(id, article.citation_style || "apa");

  const headerRight = (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground font-mono" data-testid="autosave-indicator">
        {saving ? "Saving…" : dirty ? "● Unsaved" : savedAt ? `Saved ${savedAt.toLocaleTimeString()}` : "Saved"}
      </span>
      <button
        onClick={() => doSave(false)}
        data-testid="save-btn"
        className="text-xs flex items-center gap-1 px-2 py-1.5 border border-border rounded-sm hover:bg-secondary"
      >
        <Save className="h-3 w-3" /> Save
      </button>
      <div className="relative">
        <button
          onClick={() => setExportOpen((o) => !o)}
          data-testid="export-menu-btn"
          className="text-xs flex items-center gap-1 px-2 py-1.5 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90"
        >
          <Download className="h-3 w-3" /> Export <ChevronDown className="h-3 w-3" />
        </button>
        {exportOpen && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-sm z-50" data-testid="export-menu" onMouseLeave={() => setExportOpen(false)}>
            <a href={downloadXMLLink("jats")} data-testid="export-jats" className="block px-3 py-2 text-xs hover:bg-secondary">JATS XML (1.3)</a>
            <a href={downloadXMLLink("pkp")} data-testid="export-pkp" className="block px-3 py-2 text-xs hover:bg-secondary">PKP Native XML</a>
            <a href={downloadXMLLink("crossref")} data-testid="export-crossref" className="block px-3 py-2 text-xs hover:bg-secondary">Crossref Deposit XML</a>
            <a href={docxLink} data-testid="export-docx" className="block px-3 py-2 text-xs hover:bg-secondary border-t border-border">DOCX (Word)</a>
            <a href={api.downloadPDF(id)} data-testid="export-pdf" className="block px-3 py-2 text-xs hover:bg-secondary">PDF (Server-rendered)</a>
            <button onClick={() => { setTab("pdf"); setExportOpen(false); setTimeout(() => window.print(), 200); }} data-testid="export-pdf-browser" className="w-full text-left block px-3 py-2 text-xs hover:bg-secondary border-t border-border">PDF via Browser Print</button>
          </div>
        )}
      </div>
    </div>
  );

  const breadcrumb = (
    <>
      <Link to="/" className="hover:text-foreground flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> Articles
      </Link>
      <span>/</span>
      <span className="text-foreground truncate max-w-[300px]" data-testid="editor-breadcrumb-title">{article.title || "(Untitled)"}</span>
    </>
  );

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <AppHeader right={headerRight} breadcrumb={breadcrumb} />

      {/* Tabs */}
      <div className="border-b border-border bg-card px-3 flex items-center shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            data-testid={`tab-${t.id}`}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs uppercase tracking-wider transition-colors relative ${
              tab === t.id
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
            {tab === t.id && <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary" />}
          </button>
        ))}
      </div>

      {/* Main content + validation panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto" data-testid="editor-content">
          {tab === "metadata" && (
            <div className="max-w-5xl mx-auto p-6">
              <MetadataForm
                article={article}
                onChange={onChange}
                templates={templates}
                onApplyTemplate={applyTemplate}
              />
            </div>
          )}
          {tab === "structure" && (
            <IMRADEditor
              sections={article.sections || {}}
              onChange={(sections) => onChange({ ...article, sections })}
              figures={article.figures || []}
              onFiguresChange={(figures) => onChange({ ...article, figures })}
            />
          )}
          {tab === "references" && (
            <div className="max-w-5xl mx-auto p-6">
              <ReferencesManager
                references={article.references || []}
                onChange={(refs) => onChange({ ...article, references: refs })}
                citationStyle={article.citation_style || "apa"}
                onCitationStyleChange={(s) => onChange({ ...article, citation_style: s })}
              />
            </div>
          )}
          {tab === "xml" && (
            <XMLPreview xml={xml.jats} kind="JATS 1.3" articleId={id} downloadUrl={downloadXMLLink("jats")} />
          )}
          {tab === "pkp" && (
            <XMLPreview xml={xml.pkp} kind="PKP Native" articleId={id} downloadUrl={downloadXMLLink("pkp")} />
          )}
          {tab === "crossref" && (
            <XMLPreview xml={xml.crossref} kind="Crossref" articleId={id} downloadUrl={downloadXMLLink("crossref")} />
          )}
          {tab === "pdf" && (
            <PDFPreview article={article} formattedRefs={formattedRefs} issueInfo={issueInfo} />
          )}
        </div>

        {/* Validation sidebar */}
        <aside className="w-80 border-l border-border bg-card shrink-0">
          <ValidationPanel result={validation} onJump={onJumpToField} />
        </aside>
      </div>
    </div>
  );
}
