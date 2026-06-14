import React from "react";
import { Heading1, Heading2, Type, Table as TableIcon, Image, Sigma, AsteriskSquare, Quote } from "lucide-react";

const SECTIONS = [
  { key: "introduction", label: "Introduction" },
  { key: "methods", label: "Methods" },
  { key: "results", label: "Results" },
  { key: "discussion", label: "Discussion" },
  { key: "conclusion", label: "Conclusion" },
  { key: "acknowledgement", label: "Acknowledgement" },
  { key: "funding", label: "Funding Statement" },
  { key: "conflict_of_interest", label: "Conflict of Interest" },
  { key: "data_availability", label: "Data Availability Statement" },
  { key: "author_contributions", label: "Author Contributions" },
  { key: "ethical_approval", label: "Ethical Approval" },
];

const TOOLS = [
  { tag: "## ", icon: Heading1, label: "Heading", testId: "tool-heading" },
  { tag: "### ", icon: Heading2, label: "Subheading", testId: "tool-subheading" },
  { tag: '\n\n| Col1 | Col2 |\n|------|------|\n| a | b |\n', icon: TableIcon, label: "Table", testId: "tool-table" },
  { tag: '\n\n[Figure: caption]\n', icon: Image, label: "Figure Caption", testId: "tool-figure" },
  { tag: '$$ E = mc^2 $$', icon: Sigma, label: "Formula", testId: "tool-formula" },
  { tag: '[^footnote: ]', icon: AsteriskSquare, label: "Footnote", testId: "tool-footnote" },
  { tag: '[@cite-key]', icon: Quote, label: "Citation", testId: "tool-citation" },
];

export function IMRADEditor({ sections, onChange }) {
  const [active, setActive] = React.useState("introduction");
  const textareaRefs = React.useRef({});

  const set = (key, value) => onChange({ ...sections, [key]: value });

  const insertTool = (text) => {
    const ta = textareaRefs.current[active];
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const cur = sections[active] || "";
    const next = cur.slice(0, start) + text + cur.slice(end);
    set(active, next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const wordCount = (sections[active] || "").trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex h-full">
      {/* Section list */}
      <aside className="w-56 border-r border-border bg-card overflow-y-auto shrink-0">
        <div className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-border">
          Article Structure
        </div>
        <nav className="py-1">
          {SECTIONS.map((s) => {
            const hasContent = (sections[s.key] || "").trim().length > 0;
            return (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                data-testid={`section-tab-${s.key}`}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${
                  active === s.key ? "bg-secondary text-foreground border-l-2 border-primary" : "text-muted-foreground hover:bg-secondary/50"
                }`}
              >
                <span>{s.label}</span>
                {hasContent && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-3 py-2 flex items-center gap-1 bg-card shrink-0">
          {TOOLS.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => insertTool(t.tag)}
              data-testid={t.testId}
              title={t.label}
              className="h-7 w-7 flex items-center justify-center rounded-sm hover:bg-secondary text-muted-foreground hover:text-foreground"
            >
              <t.icon className="h-3.5 w-3.5" />
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span>{wordCount} words</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-background p-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-lg font-semibold mb-1">{SECTIONS.find((s) => s.key === active)?.label}</h2>
            <p className="text-xs text-muted-foreground mb-4">Markdown supported. Use the toolbar to insert headings, tables, formulas, citations.</p>
            <textarea
              ref={(el) => (textareaRefs.current[active] = el)}
              value={sections[active] || ""}
              onChange={(e) => set(active, e.target.value)}
              data-testid={`textarea-${active}`}
              placeholder={`Write your ${SECTIONS.find((s) => s.key === active)?.label.toLowerCase()} here...`}
              className="w-full min-h-[60vh] bg-card border border-border rounded-sm px-4 py-3 editor-area font-serif-editor focus:border-primary"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
