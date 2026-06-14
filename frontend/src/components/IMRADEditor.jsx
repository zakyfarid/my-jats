import React from "react";
import { Heading1, Heading2, Table as TableIcon, Image, Sigma, AsteriskSquare, Quote, FileVolume } from "lucide-react";
import { TableBuilderModal } from "./TableBuilderModal";
import { FigureInsertModal } from "./FigureInsertModal";

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

export function IMRADEditor({ sections, onChange, figures = [], onFiguresChange }) {
  const [active, setActive] = React.useState("introduction");
  const [tableOpen, setTableOpen] = React.useState(false);
  const [figureOpen, setFigureOpen] = React.useState(false);
  const textareaRefs = React.useRef({});

  const set = (key, value) => onChange({ ...sections, [key]: value });

  const insertAtCursor = (text) => {
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

  const TOOLS = [
    { onClick: () => insertAtCursor("## "), icon: Heading1, label: "Heading", testId: "tool-heading" },
    { onClick: () => insertAtCursor("### "), icon: Heading2, label: "Subheading", testId: "tool-subheading" },
    { onClick: () => setTableOpen(true), icon: TableIcon, label: "Insert Table…", testId: "tool-table" },
    { onClick: () => setFigureOpen(true), icon: Image, label: "Insert Figure…", testId: "tool-figure" },
    { onClick: () => insertAtCursor("$$ E = mc^2 $$"), icon: Sigma, label: "Formula", testId: "tool-formula" },
    { onClick: () => insertAtCursor("[^footnote: ]"), icon: AsteriskSquare, label: "Footnote", testId: "tool-footnote" },
    { onClick: () => insertAtCursor("[@cite-key]"), icon: Quote, label: "Citation", testId: "tool-citation" },
    { onClick: () => insertAtCursor("\n\n[PAGE BREAK]\n\n"), icon: FileVolume, label: "Page Break", testId: "tool-page-break" },
  ];

  const wordCount = (sections[active] || "").trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex h-full">
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-3 py-2 flex items-center gap-1 bg-card shrink-0 flex-wrap">
          {TOOLS.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={t.onClick}
              data-testid={t.testId}
              title={t.label}
              className="h-7 px-2 flex items-center gap-1 rounded-sm hover:bg-secondary text-muted-foreground hover:text-foreground text-xs"
            >
              <t.icon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{t.label}</span>
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span data-testid="word-count">{wordCount} words</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto bg-background p-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-lg font-semibold mb-1">{SECTIONS.find((s) => s.key === active)?.label}</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Toolbar inserts heading, table builder, image upload, formulas, citations, and page breaks at cursor.
            </p>
            <textarea
              ref={(el) => (textareaRefs.current[active] = el)}
              value={sections[active] || ""}
              onChange={(e) => set(active, e.target.value)}
              data-testid={`textarea-${active}`}
              placeholder={`Write your ${SECTIONS.find((s) => s.key === active)?.label.toLowerCase()} here...`}
              className="w-full min-h-[60vh] bg-card border border-border rounded-sm px-4 py-3 editor-area font-serif-editor focus:border-primary"
            />
            {figures && figures.length > 0 && (
              <div className="mt-6 border-t border-border pt-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Inserted Figures ({figures.length})</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3" data-testid="figures-bank">
                  {figures.map((fig) => (
                    <div key={fig.id} data-testid={`figure-bank-${fig.id}`} className="border border-border rounded-sm p-2 bg-card">
                      <img src={fig.data_url} alt={fig.caption} className="w-full h-24 object-contain bg-white/5 rounded-sm" />
                      <div className="text-xs font-medium mt-1.5 truncate">{fig.label}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{fig.caption}</div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-1">[Figure:{fig.id.slice(0, 8)}…]</div>
                      <button
                        onClick={() => onFiguresChange(figures.filter((f) => f.id !== fig.id))}
                        className="mt-1 text-[10px] text-destructive hover:underline"
                        data-testid={`figure-bank-remove-${fig.id}`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <TableBuilderModal open={tableOpen} onClose={() => setTableOpen(false)} onInsert={insertAtCursor} />
      <FigureInsertModal
        open={figureOpen}
        onClose={() => setFigureOpen(false)}
        onInsert={insertAtCursor}
        figures={figures}
        onFiguresChange={onFiguresChange}
      />
    </div>
  );
}
