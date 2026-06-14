import React, { useEffect, useState } from "react";
import { AppHeader } from "../components/AppHeader";
import { api } from "../lib/api";
import { Plus, Trash2, BookOpen, Save } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_LICENSES = ["CC-BY 4.0", "CC-BY-SA 4.0", "CC-BY-NC 4.0", "CC-BY-NC-SA 4.0", "All rights reserved"];

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.listTemplates();
      setTemplates(data);
    } catch {
      toast.error("Failed to load templates");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createNew = () => {
    setEditing({
      name: "",
      journal: { title: "", issn: "", eissn: "", publisher: "", volume: "", issue: "", year: String(new Date().getFullYear()), doi_prefix: "" },
      copyright_statement: "© Author(s). Published under license.",
      license: "CC-BY 4.0",
      publisher_info: "",
    });
  };

  const save = async () => {
    try {
      if (!editing.name?.trim()) return toast.error("Template name required");
      if (editing.id) {
        await api.updateTemplate(editing.id, editing);
        toast.success("Template updated");
      } else {
        await api.createTemplate(editing);
        toast.success("Template created");
      }
      setEditing(null);
      load();
    } catch {
      toast.error("Save failed");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this template?")) return;
    try {
      await api.deleteTemplate(id);
      toast.success("Template deleted");
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  const setField = (path, value) => {
    const next = { ...editing };
    const keys = path.split(".");
    let cur = next;
    for (let i = 0; i < keys.length - 1; i++) {
      cur[keys[i]] = { ...(cur[keys[i]] || {}) };
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
    setEditing(next);
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <AppHeader />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Library</div>
              <h1 className="text-2xl font-semibold tracking-tight" data-testid="templates-title">Templates</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Reusable journal metadata, copyright statements, and licensing.
              </p>
            </div>
            <button
              onClick={createNew}
              data-testid="new-template-btn"
              className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 text-sm rounded-sm hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> New Template
            </button>
          </div>

          {editing && (
            <div className="border border-primary/40 bg-card rounded-sm p-6 mb-8 space-y-4" data-testid="template-editor">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">{editing.id ? "Edit Template" : "New Template"}</h2>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(null)} className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-secondary">Cancel</button>
                  <button onClick={save} data-testid="save-template-btn" className="text-xs flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90">
                    <Save className="h-3 w-3" /> Save
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TplField label="Template Name" colSpan={2}>
                  <input value={editing.name || ""} onChange={(e) => setField("name", e.target.value)} className={inputCls} data-testid="template-name" placeholder="e.g. Journal of Biomedical Sciences (Vol 12)" />
                </TplField>
                <TplField label="Journal Title">
                  <input value={editing.journal.title} onChange={(e) => setField("journal.title", e.target.value)} className={inputCls} data-testid="tpl-journal-title" />
                </TplField>
                <TplField label="Publisher">
                  <input value={editing.journal.publisher} onChange={(e) => setField("journal.publisher", e.target.value)} className={inputCls} data-testid="tpl-publisher" />
                </TplField>
                <TplField label="ISSN">
                  <input value={editing.journal.issn} onChange={(e) => setField("journal.issn", e.target.value)} className={inputCls} data-testid="tpl-issn" />
                </TplField>
                <TplField label="E-ISSN">
                  <input value={editing.journal.eissn} onChange={(e) => setField("journal.eissn", e.target.value)} className={inputCls} data-testid="tpl-eissn" />
                </TplField>
                <TplField label="Volume">
                  <input value={editing.journal.volume} onChange={(e) => setField("journal.volume", e.target.value)} className={inputCls} data-testid="tpl-volume" />
                </TplField>
                <TplField label="Year">
                  <input value={editing.journal.year} onChange={(e) => setField("journal.year", e.target.value)} className={inputCls} data-testid="tpl-year" />
                </TplField>
                <TplField label="DOI Prefix">
                  <input value={editing.journal.doi_prefix} onChange={(e) => setField("journal.doi_prefix", e.target.value)} className={inputCls} data-testid="tpl-doi-prefix" />
                </TplField>
                <TplField label="License">
                  <select value={editing.license} onChange={(e) => setField("license", e.target.value)} className={inputCls} data-testid="tpl-license">
                    {DEFAULT_LICENSES.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </TplField>
                <TplField label="Copyright Statement" colSpan={2}>
                  <textarea value={editing.copyright_statement} onChange={(e) => setField("copyright_statement", e.target.value)} rows={2} className={inputCls} data-testid="tpl-copyright" />
                </TplField>
                <TplField label="Publisher Info" colSpan={2}>
                  <textarea value={editing.publisher_info} onChange={(e) => setField("publisher_info", e.target.value)} rows={2} className={inputCls} data-testid="tpl-publisher-info" />
                </TplField>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-sm text-muted-foreground p-8 text-center">Loading...</div>
          ) : templates.length === 0 ? (
            <div className="border border-dashed border-border rounded-sm p-12 text-center" data-testid="templates-empty">
              <BookOpen className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No templates yet. Create one to standardize your journal metadata.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="templates-grid">
              {templates.map((t) => (
                <div key={t.id} data-testid={`template-card-${t.id}`} className="border border-border rounded-sm bg-card p-4 hover:border-primary/40 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-sm">{t.name || "(Unnamed)"}</h3>
                    <button onClick={() => remove(t.id)} data-testid={`template-delete-${t.id}`} className="text-destructive hover:text-destructive/80">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <div>{t.journal?.title || "—"}</div>
                    <div className="font-mono">ISSN: {t.journal?.issn || "—"} · {t.license}</div>
                    <div className="font-mono">Year: {t.journal?.year || "—"} · Vol: {t.journal?.volume || "—"}</div>
                  </div>
                  <button onClick={() => setEditing(t)} data-testid={`template-edit-${t.id}`} className="mt-3 w-full text-xs px-2 py-1 border border-border rounded-sm hover:bg-secondary">
                    Edit
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const inputCls = "w-full bg-background border border-border rounded-sm px-2.5 py-1.5 text-sm focus:border-primary";

function TplField({ label, children, colSpan = 1 }) {
  return (
    <div className={colSpan === 2 ? "col-span-2" : ""}>
      <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}
