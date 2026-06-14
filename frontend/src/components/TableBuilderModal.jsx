import React from "react";
import { X, Plus, Trash2 } from "lucide-react";

export function TableBuilderModal({ open, onClose, onInsert }) {
  const [rows, setRows] = React.useState(3);
  const [cols, setCols] = React.useState(3);
  const [caption, setCaption] = React.useState("");
  const [label, setLabel] = React.useState("Table 1");
  const [cells, setCells] = React.useState(() => Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => "")));

  React.useEffect(() => {
    setCells((prev) => {
      const next = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (prev[r] && prev[r][c]) || "")
      );
      return next;
    });
  }, [rows, cols]);

  if (!open) return null;

  const updateCell = (r, c, value) => {
    const next = cells.map((row) => row.slice());
    next[r][c] = value;
    setCells(next);
  };

  const insert = () => {
    // header row = first row
    const header = cells[0].map((h) => h || " ").join(" | ");
    const sep = cells[0].map(() => "---").join(" | ");
    const bodyRows = cells.slice(1).map((row) => row.map((c) => c || " ").join(" | "));
    const markdown = [
      `[Table:${label}] ${caption}`,
      `| ${header} |`,
      `| ${sep} |`,
      ...bodyRows.map((r) => `| ${r} |`),
    ].join("\n");
    onInsert("\n\n" + markdown + "\n\n");
    onClose();
    setCaption("");
    setLabel("Table 1");
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose} data-testid="table-modal">
      <div className="bg-card border border-border rounded-sm w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium">Insert Table</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="table-modal-close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Label</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} data-testid="table-label" />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Caption</label>
              <input value={caption} onChange={(e) => setCaption(e.target.value)} className={inputCls} placeholder="Descriptive caption..." data-testid="table-caption" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Rows</label>
                <div className="flex items-center border border-border rounded-sm">
                  <button onClick={() => setRows((r) => Math.max(2, r - 1))} className="px-2 py-1 hover:bg-secondary text-sm" data-testid="table-rows-dec">−</button>
                  <span className="flex-1 text-center text-sm" data-testid="table-rows-value">{rows}</span>
                  <button onClick={() => setRows((r) => Math.min(20, r + 1))} className="px-2 py-1 hover:bg-secondary text-sm" data-testid="table-rows-inc">+</button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Cols</label>
                <div className="flex items-center border border-border rounded-sm">
                  <button onClick={() => setCols((c) => Math.max(2, c - 1))} className="px-2 py-1 hover:bg-secondary text-sm" data-testid="table-cols-dec">−</button>
                  <span className="flex-1 text-center text-sm" data-testid="table-cols-value">{cols}</span>
                  <button onClick={() => setCols((c) => Math.min(10, c + 1))} className="px-2 py-1 hover:bg-secondary text-sm" data-testid="table-cols-inc">+</button>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-border rounded-sm overflow-auto">
            <table className="w-full">
              <tbody>
                {cells.map((row, r) => (
                  <tr key={r} className={r === 0 ? "bg-secondary/40" : ""}>
                    {row.map((cell, c) => (
                      <td key={c} className="border border-border p-0">
                        <input
                          value={cell}
                          onChange={(e) => updateCell(r, c, e.target.value)}
                          placeholder={r === 0 ? `H${c + 1}` : ""}
                          className={`w-full px-2 py-1.5 text-sm bg-background focus:bg-secondary/30 ${r === 0 ? "font-semibold" : ""}`}
                          data-testid={`table-cell-${r}-${c}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground">First row = header. Edit cells directly above.</p>
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-secondary">Cancel</button>
          <button onClick={insert} data-testid="table-insert-btn" className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90">Insert Table</button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full bg-background border border-border rounded-sm px-2 py-1.5 text-sm focus:border-primary";
