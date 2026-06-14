import React from "react";
import { X, Upload } from "lucide-react";
import { toast } from "sonner";

export function FigureInsertModal({ open, onClose, onInsert, figures, onFiguresChange }) {
  const [dataUrl, setDataUrl] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [caption, setCaption] = React.useState("");
  const [width, setWidth] = React.useState("full");

  React.useEffect(() => {
    if (open) {
      setDataUrl("");
      setLabel(`Figure ${(figures?.length || 0) + 1}`);
      setCaption("");
      setWidth("full");
    }
  }, [open, figures]);

  if (!open) return null;

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_500_000) {
      toast.error("Image too large (max 2.5 MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setDataUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const insert = () => {
    if (!dataUrl) {
      toast.error("Upload an image first");
      return;
    }
    const id = (crypto.randomUUID ? crypto.randomUUID() : `fig-${Date.now()}`);
    const fig = { id, label, caption, data_url: dataUrl, width };
    onFiguresChange([...(figures || []), fig]);
    onInsert(`\n\n[Figure:${id}]\n\n`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose} data-testid="figure-modal">
      <div className="bg-card border border-border rounded-sm w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-medium">Insert Figure</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="figure-modal-close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">
          <label className="block border-2 border-dashed border-border rounded-sm hover:border-primary/50 cursor-pointer p-6 text-center">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFile}
              className="hidden"
              data-testid="figure-file-input"
            />
            {dataUrl ? (
              <div>
                <img src={dataUrl} alt="preview" className="mx-auto max-h-48 object-contain mb-2" data-testid="figure-preview" />
                <span className="text-xs text-muted-foreground">Click to replace</span>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
                <p className="text-sm">Click to upload image</p>
                <p className="text-[10px] text-muted-foreground mt-1">PNG / JPG / WebP / SVG · max 2.5 MB</p>
              </div>
            )}
          </label>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Label</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} placeholder="Figure 1" data-testid="figure-label" />
            </div>
            <div className="col-span-2">
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Width</label>
              <select value={width} onChange={(e) => setWidth(e.target.value)} className={inputCls} data-testid="figure-width">
                <option value="full">Full Width</option>
                <option value="half">Half Width</option>
                <option value="third">One Third</option>
              </select>
            </div>
            <div className="col-span-3">
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Caption</label>
              <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} className={inputCls} placeholder="Describe the figure..." data-testid="figure-caption" />
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="text-xs px-3 py-1.5 border border-border rounded-sm hover:bg-secondary">Cancel</button>
          <button onClick={insert} data-testid="figure-insert-btn" className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90">Insert Figure</button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full bg-background border border-border rounded-sm px-2 py-1.5 text-sm focus:border-primary";
