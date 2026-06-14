import React from "react";
import { Plus, Trash2, Search, Upload, FileDown, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { PasteReferencesModal } from "./PasteReferencesModal";

export function ReferencesManager({ references, onChange }) {
  const [style, setStyle] = React.useState("apa");
  const [formatted, setFormatted] = React.useState([]);
  const [importOpen, setImportOpen] = React.useState(false);
  const [importFormat, setImportFormat] = React.useState("ris");
  const [importText, setImportText] = React.useState("");
  const [pasteOpen, setPasteOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (!references.length) {
      setFormatted([]);
      return;
    }
    api.formatReferences(references, style).then((d) => {
      if (!cancelled) setFormatted(d.formatted);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [references, style]);

  const addRef = () => {
    onChange([...references, { id: crypto.randomUUID(), type: "journal", authors: [], title: "", journal: "", year: "", volume: "", issue: "", pages: "", doi: "", url: "" }]);
  };

  const update = (idx, key, value) => {
    const next = [...references];
    next[idx] = { ...next[idx], [key]: value };
    onChange(next);
  };

  const remove = (idx) => onChange(references.filter((_, i) => i !== idx));

  const lookupDOI = async (idx) => {
    const doi = references[idx].doi;
    if (!doi) return toast.error("Enter DOI first");
    try {
      const data = await api.crossrefLookup(doi);
      const next = [...references];
      next[idx] = { ...next[idx], ...data, id: next[idx].id };
      onChange(next);
      toast.success("Reference filled from Crossref");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Crossref lookup failed");
    }
  };

  const handleImport = async () => {
    if (!importText.trim()) return toast.error("Paste content first");
    try {
      const { references: imported } = await api.importReferences(importFormat, importText);
      onChange([...references, ...imported]);
      toast.success(`Imported ${imported.length} references`);
      setImportOpen(false);
      setImportText("");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Import failed");
    }
  };

  const handleExport = async (fmt) => {
    try {
      const blob = await api.exportReferences(fmt, references);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `references.${fmt === "bibtex" ? "bib" : "ris"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Export failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Citation Style</span>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            data-testid="citation-style-select"
            className="bg-background border border-border rounded-sm px-2 py-1 text-xs"
          >
            <option value="apa">APA 7th</option>
            <option value="harvard">Harvard</option>
            <option value="vancouver">Vancouver</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setPasteOpen(true)} data-testid="paste-refs-btn" className="text-xs flex items-center gap-1 px-2 py-1 border border-primary/40 text-primary rounded-sm hover:bg-primary/10">
            <Sparkles className="h-3 w-3" /> Paste &amp; Parse
          </button>
          <button onClick={() => setImportOpen(true)} data-testid="import-refs-btn" className="text-xs flex items-center gap-1 px-2 py-1 border border-border rounded-sm hover:bg-secondary">
            <Upload className="h-3 w-3" /> Import
          </button>
          <button onClick={() => handleExport("bibtex")} data-testid="export-bibtex-btn" className="text-xs flex items-center gap-1 px-2 py-1 border border-border rounded-sm hover:bg-secondary">
            <FileDown className="h-3 w-3" /> BibTeX
          </button>
          <button onClick={() => handleExport("ris")} data-testid="export-ris-btn" className="text-xs flex items-center gap-1 px-2 py-1 border border-border rounded-sm hover:bg-secondary">
            <FileDown className="h-3 w-3" /> RIS
          </button>
          <button onClick={addRef} data-testid="add-ref-btn" className="text-xs flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90">
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
      </div>

      {importOpen && (
        <div className="border border-primary/40 bg-primary/5 rounded-sm p-3 space-y-2" data-testid="import-panel">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Format:</span>
            <select value={importFormat} onChange={(e) => setImportFormat(e.target.value)} className="bg-background border border-border rounded-sm px-2 py-1 text-xs" data-testid="import-format-select">
              <option value="ris">RIS</option>
              <option value="bibtex">BibTeX</option>
              <option value="endnote">EndNote XML</option>
            </select>
          </div>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={`Paste ${importFormat.toUpperCase()} content...`}
            rows={8}
            data-testid="import-text"
            className="w-full bg-background border border-border rounded-sm px-2 py-2 text-xs font-mono"
          />
          <div className="flex gap-2">
            <button onClick={handleImport} data-testid="import-confirm-btn" className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90">
              Import
            </button>
            <button onClick={() => setImportOpen(false)} className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {references.length === 0 ? (
        <div className="text-sm text-muted-foreground italic text-center py-8 border border-dashed border-border rounded-sm" data-testid="empty-refs">
          No references yet. Add manually, lookup by DOI, or import.
        </div>
      ) : (
        <ol className="space-y-2" data-testid="refs-list">
          {references.map((r, idx) => (
            <li key={r.id || idx} data-testid={`ref-item-${idx}`} className="border border-border rounded-sm p-3 bg-card">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-[10px] font-mono text-muted-foreground mt-1">[{idx + 1}]</span>
                <div className="flex-1 font-serif-editor text-sm leading-relaxed">
                  {formatted[idx] || <em className="text-muted-foreground">(incomplete reference)</em>}
                </div>
                <button onClick={() => remove(idx)} data-testid={`ref-remove-${idx}`} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-6 gap-2">
                <div className="col-span-3">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Title</label>
                  <input value={r.title || ""} onChange={(e) => update(idx, "title", e.target.value)} className={inputClsSm} data-testid={`ref-title-${idx}`} />
                </div>
                <div className="col-span-3">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Authors (semicolon ;)</label>
                  <input
                    value={(r.authors || []).join("; ")}
                    onChange={(e) => update(idx, "authors", e.target.value.split(";").map((a) => a.trim()).filter(Boolean))}
                    className={inputClsSm}
                    data-testid={`ref-authors-${idx}`}
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Journal / Publisher</label>
                  <input value={r.journal || ""} onChange={(e) => update(idx, "journal", e.target.value)} className={inputClsSm} data-testid={`ref-journal-${idx}`} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Year</label>
                  <input value={r.year || ""} onChange={(e) => update(idx, "year", e.target.value)} className={inputClsSm} data-testid={`ref-year-${idx}`} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Vol</label>
                  <input value={r.volume || ""} onChange={(e) => update(idx, "volume", e.target.value)} className={inputClsSm} data-testid={`ref-volume-${idx}`} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Issue</label>
                  <input value={r.issue || ""} onChange={(e) => update(idx, "issue", e.target.value)} className={inputClsSm} data-testid={`ref-issue-${idx}`} />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Pages</label>
                  <input value={r.pages || ""} onChange={(e) => update(idx, "pages", e.target.value)} className={inputClsSm} data-testid={`ref-pages-${idx}`} placeholder="1-10" />
                </div>
                <div className="col-span-5">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">DOI</label>
                  <div className="flex gap-1">
                    <input value={r.doi || ""} onChange={(e) => update(idx, "doi", e.target.value)} className={inputClsSm} data-testid={`ref-doi-${idx}`} />
                    <button onClick={() => lookupDOI(idx)} data-testid={`ref-doi-lookup-${idx}`} className="px-2 border border-border rounded-sm text-xs hover:bg-secondary">
                      <Search className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">URL</label>
                  <input value={r.url || ""} onChange={(e) => update(idx, "url", e.target.value)} className={inputClsSm} data-testid={`ref-url-${idx}`} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <PasteReferencesModal
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onAppend={(parsed) => onChange([...(references || []), ...parsed])}
      />
    </div>
  );
}

const inputClsSm = "w-full bg-background border border-border rounded-sm px-2 py-1 text-xs focus:border-primary";
