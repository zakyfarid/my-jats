import React from "react";
import { Printer } from "lucide-react";

function renderInline(text) {
  // Citations [@key] => sup-style
  return text
    .replace(/\[@([^\]]+)\]/g, '<sup class="text-blue-700">[$1]</sup>')
    .replace(/\[\^footnote:([^\]]*)\]/g, '<sup class="text-zinc-500">[fn: $1]</sup>');
}

function renderParagraph(line, key) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("### ")) {
    return <h4 key={key} className="font-sans font-semibold text-sm mt-3 mb-1.5">{trimmed.slice(4)}</h4>;
  }
  if (trimmed.startsWith("## ")) {
    return <h3 key={key} className="font-sans font-semibold text-base mt-4 mb-2">{trimmed.slice(3)}</h3>;
  }
  if (trimmed.startsWith("$$") && trimmed.endsWith("$$")) {
    return (
      <div key={key} className="text-center my-3 font-mono text-sm bg-zinc-100 py-2 rounded-sm">
        {trimmed.slice(2, -2).trim()}
      </div>
    );
  }
  if (trimmed.startsWith("[Figure:")) {
    return (
      <div key={key} className="text-xs italic text-zinc-600 text-center my-2">
        <strong>Figure.</strong> {trimmed.slice(8).replace(/\]$/, "").trim()}
      </div>
    );
  }
  // Table markdown (very simple): lines beginning with |
  if (trimmed.startsWith("|")) {
    return (
      <pre key={key} className="text-[10px] bg-zinc-50 p-2 my-2 rounded-sm font-mono whitespace-pre-wrap">{trimmed}</pre>
    );
  }
  return (
    <p key={key} className="mb-2 indent-4" dangerouslySetInnerHTML={{ __html: renderInline(trimmed) }} />
  );
}

function renderBody(body) {
  if (!body) return null;
  // Split into paragraphs and lines for headings
  const paragraphs = body.split(/\n\n+/);
  const out = [];
  paragraphs.forEach((para, i) => {
    // Within paragraph, headings on their own line should still be split
    const lines = para.split("\n");
    const buf = [];
    lines.forEach((ln) => {
      if (ln.trim().startsWith("## ") || ln.trim().startsWith("### ") || ln.trim().startsWith("[Figure:") || (ln.trim().startsWith("$$") && ln.trim().endsWith("$$"))) {
        if (buf.length) {
          out.push(renderParagraph(buf.join(" "), out.length));
          buf.length = 0;
        }
        out.push(renderParagraph(ln, out.length));
      } else {
        buf.push(ln);
      }
    });
    if (buf.length) {
      out.push(renderParagraph(buf.join(" "), out.length));
    }
  });
  return out;
}

export function PDFPreview({ article, formattedRefs = [] }) {
  const j = article.journal || {};
  const handlePrint = () => window.print();

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border px-3 py-2 flex items-center justify-between bg-card shrink-0">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">PDF Layout Preview</div>
        <button onClick={handlePrint} data-testid="print-pdf-btn" className="text-xs flex items-center gap-1 px-2 py-1 border border-border rounded-sm hover:bg-secondary">
          <Printer className="h-3 w-3" /> Print / Save PDF
        </button>
      </div>
      <div className="flex-1 overflow-auto p-8 bg-zinc-800">
        <div className="pdf-preview mx-auto max-w-4xl shadow-xl rounded-sm p-12" data-testid="pdf-content">
          {/* Header */}
          <div className="border-b border-zinc-300 pb-3 mb-6 text-xs flex justify-between text-zinc-600">
            <span>{j.title || "Journal Title"} · Vol. {j.volume || "—"}, No. {j.issue || "—"} ({j.year || "—"})</span>
            <span>doi: {article.doi || "—"}</span>
          </div>

          <h1 className="pdf-title text-3xl mb-2 leading-tight" style={{ color: "#0f172a" }}>
            {article.title || "Untitled Article"}
          </h1>
          {article.subtitle && <p className="text-lg italic text-zinc-600 mb-4">{article.subtitle}</p>}

          {/* Authors */}
          <div className="mb-2 text-sm">
            {(article.authors || []).map((a, i) => (
              <span key={a.id || i}>
                {i > 0 && ", "}
                <strong>{a.full_name || `${a.given_name} ${a.family_name}`.trim()}</strong>
                <sup>{i + 1}</sup>
                {a.corresponding && <sup>*</sup>}
              </span>
            ))}
          </div>
          <div className="text-xs text-zinc-600 italic mb-6 space-y-0.5">
            {(article.authors || []).map((a, i) => (
              a.affiliation ? <div key={`aff-${i}`}><sup>{i + 1}</sup> {a.affiliation}{a.country ? `, ${a.country}` : ""}</div> : null
            ))}
            {(article.authors || []).find((a) => a.corresponding) && (
              <div className="mt-1">* Corresponding author: {(article.authors || []).find((a) => a.corresponding)?.email}</div>
            )}
          </div>

          {/* Abstract */}
          {article.abstract?.english && (
            <div className="bg-zinc-50 border-l-4 border-zinc-400 p-4 mb-6 text-sm">
              <div className="font-sans font-bold uppercase tracking-wider text-xs mb-2">Abstract</div>
              <p className="leading-relaxed">{article.abstract.english}</p>
              {article.keywords?.length > 0 && (
                <div className="mt-3 text-xs">
                  <strong>Keywords:</strong> {article.keywords.join(", ")}
                </div>
              )}
            </div>
          )}

          {/* Two column body */}
          <div className="pdf-cols text-sm leading-relaxed">
            {[
              { t: "Introduction", b: article.sections?.introduction },
              { t: "Methods", b: article.sections?.methods },
              { t: "Results", b: article.sections?.results },
              { t: "Discussion", b: article.sections?.discussion },
              { t: "Conclusion", b: article.sections?.conclusion },
            ].map((s, i) =>
              s.b ? (
                <React.Fragment key={i}>
                  <h2 className="pdf-section font-sans font-semibold text-base mt-4 mb-2 uppercase tracking-wider" style={{ color: "#1e293b" }}>{s.t}</h2>
                  {renderBody(s.b)}
                </React.Fragment>
              ) : null
            )}
          </div>

          {/* Back matter */}
          {article.sections?.acknowledgement && (
            <div className="mt-6 text-sm border-t border-zinc-300 pt-4">
              <strong>Acknowledgements.</strong> {article.sections.acknowledgement}
            </div>
          )}
          {article.sections?.funding && (
            <div className="mt-2 text-sm">
              <strong>Funding.</strong> {article.sections.funding}
            </div>
          )}
          {article.sections?.conflict_of_interest && (
            <div className="mt-2 text-sm">
              <strong>Conflict of Interest.</strong> {article.sections.conflict_of_interest}
            </div>
          )}

          {/* References */}
          {formattedRefs.length > 0 && (
            <div className="mt-6">
              <h2 className="font-sans font-semibold text-base mb-3 uppercase tracking-wider">References</h2>
              <ol className="text-xs space-y-1.5 list-decimal pl-5">
                {formattedRefs.map((r, i) => <li key={i}>{r}</li>)}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
