import React from "react";
import { Copy, Download } from "lucide-react";
import { toast } from "sonner";

function highlightXML(xml) {
  let s = (xml || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/(&lt;\?xml.*?\?&gt;)/g, '<span class="xml-decl">$1</span>');
  s = s.replace(/(&lt;!--.*?--&gt;)/gs, '<span class="xml-comment">$1</span>');
  s = s.replace(
    /(&lt;\/?)([a-zA-Z][\w:-]*)([^&]*?)(\/?&gt;)/g,
    (m, lt, tag, attrs, gt) => {
      const attrsHl = attrs.replace(
        /([a-zA-Z][\w:-]*)=("[^"]*")/g,
        '<span class="xml-attr">$1</span>=<span class="xml-string">$2</span>'
      );
      return '<span class="xml-tag">' + lt + tag + '</span>' + attrsHl + '<span class="xml-tag">' + gt + '</span>';
    }
  );
  return s;
}

function flattenTree(xml) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");
    const err = doc.querySelector("parsererror");
    if (err) return null;
    const out = [];
    const walk = (node, depth) => {
      if (!node) return;
      const kids = Array.from(node.children || []);
      out.push({
        name: node.nodeName,
        depth,
        hasChildren: kids.length > 0,
        preview: kids.length === 0 ? (node.textContent || "").trim().slice(0, 80) : "",
      });
      kids.forEach((k) => walk(k, depth + 1));
    };
    walk(doc.documentElement, 0);
    return out;
  } catch {
    return null;
  }
}

export function XMLPreview({ xml, kind = "jats", articleId, downloadUrl }) {
  const [view, setView] = React.useState("source");
  const flat = React.useMemo(() => flattenTree(xml || ""), [xml]);

  const copy = () => {
    navigator.clipboard.writeText(xml || "");
    toast.success("XML copied to clipboard");
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border px-3 py-2 flex items-center justify-between gap-2 bg-card shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView("source")}
            data-testid="xml-view-source"
            className={
              "text-xs px-2.5 py-1 rounded-sm " +
              (view === "source" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")
            }
          >
            Source
          </button>
          <button
            onClick={() => setView("tree")}
            data-testid="xml-view-tree"
            className={
              "text-xs px-2.5 py-1 rounded-sm " +
              (view === "tree" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")
            }
          >
            Tree
          </button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-2">{kind} XML</span>
          <button onClick={copy} data-testid="xml-copy-btn" className="text-xs flex items-center gap-1 px-2 py-1 border border-border rounded-sm hover:bg-secondary">
            <Copy className="h-3 w-3" /> Copy
          </button>
          {downloadUrl && (
            <a href={downloadUrl} data-testid="xml-download-btn" className="text-xs flex items-center gap-1 px-2 py-1 border border-border rounded-sm hover:bg-secondary">
              <Download className="h-3 w-3" /> Download
            </a>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto xml-preview" data-testid="xml-preview-content">
        {view === "source" ? (
          <pre
            className="p-4 text-xs font-mono leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: highlightXML(xml || "") }}
          />
        ) : (
          <div className="p-2">
            {flat ? (
              <div>
                {flat.map((n, i) => (
                  <div
                    key={i}
                    className="font-mono text-xs hover:bg-secondary/40 px-1 py-0.5 flex items-start gap-2"
                    style={{ paddingLeft: n.depth * 14 + 4 }}
                  >
                    <span className="xml-tag">{"<" + n.name + ">"}</span>
                    {n.preview && <span className="text-muted-foreground truncate flex-1">{n.preview}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-destructive p-4">XML parse error</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
