import React from "react";
import { X, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

export function PasteReferencesModal({ open, onClose, onAppend }) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState(null);

  if (!open) return null;

  const handleParse = async () => {
    if (!text.trim()) {
      toast.error("Paste reference text first");
      return;
    }
    setBusy(true);
    try {
      const data = await api.parseReferencesText(text);
      setPreview(data.references);
      toast.success(`Parsed ${data.references.length} references`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Parse failed");
    }
    setBusy(false);
  };

  const handleConfirm = () => {
    if (!preview || preview.length === 0) {
      toast.error("Nothing to add");
      return;
    }
    onAppend(preview);
    onClose();
    setText("");
    setPreview(null);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose} data-testid="paste-refs-modal">
      <div className="bg-card border border-border rounded-sm w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Paste &amp; Auto-Parse References
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="paste-refs-close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <p className="text-xs text-muted-foreground">
            Paste a numbered list of references (one per line or per paragraph). The parser detects authors, year, title, journal, volume/issue, pages, and DOI in order.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            data-testid="paste-refs-textarea"
            placeholder={`1. Smith, J., & Doe, A. (2023). Machine learning approaches. Journal of AI, 10(2), 100-115. https://doi.org/10.1234/jai.2023.001\n\n2. Lee, K. (2022). Neural networks revisited. Nature, 600(7889), 45-52.`}
            className="w-full bg-background border border-border rounded-sm px-3 py-2 text-xs font-mono focus:border-primary"
          />
          <div className="flex items-center gap-2">
            <button onClick={handleParse} disabled={busy} data-testid="paste-refs-parse-btn" className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> {busy ? "Parsing…" : "Parse References"}
            </button>
            {preview && (
              <span className="text-xs text-muted-foreground" data-testid="paste-refs-count">{preview.length} detected</span>
            )}
          </div>
          {preview && preview.length > 0 && (
            <div className="border border-border rounded-sm bg-secondary/20 max-h-80 overflow-y-auto" data-testid="paste-refs-preview">
              <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                Preview ({preview.length})
              </div>
              <ol className="divide-y divide-border">
                {preview.map((r, i) => (
                  <li key={i} className="px-3 py-2 text-xs">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-muted-foreground mt-0.5">[{i + 1}]</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{r.title || <span className="text-muted-foreground italic">(no title detected)</span>}</div>
                        <div className="text-muted-foreground mt-0.5 truncate">
                          {(r.authors || []).join("; ") || "—"} · {r.journal || "—"} · {r.year || "—"} {r.volume && `· ${r.volume}${r.issue ? `(${r.issue})` : ""}`} {r.pages && `· ${r.pages}`}
                        </div>
                        {r.doi && <div className="text-primary text-[10px] mt-0.5 font-mono">DOI: {r.doi}</div>}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-secondary">Cancel</button>
          <button onClick={handleConfirm} disabled={!preview || preview.length === 0} data-testid="paste-refs-confirm-btn" className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 disabled:opacity-50">
            Add to References
          </button>
        </div>
      </div>
    </div>
  );
}
