import React from "react";
import { Printer } from "lucide-react";

function renderInline(text) {
  return text
    .replace(/\[@([^\]]+)\]/g, '<sup class="text-blue-700">[$1]</sup>')
    .replace(/\[\^footnote:([^\]]*)\]/g, '<sup class="text-zinc-500">[fn:$1]</sup>');
}

function renderBlocks(body, figuresMap, keyPrefix = "") {
  if (!body) return [];
  const blocks = [];
  const lines = body.split("\n");
  let i = 0;
  let paraBuf = [];
  const flushPara = () => {
    if (!paraBuf.length) return;
    const text = paraBuf.join(" ").trim();
    paraBuf = [];
    if (!text) return;
    blocks.push(
      <p
        key={`${keyPrefix}p-${blocks.length}`}
        className="mb-2 indent-4"
        dangerouslySetInnerHTML={{ __html: renderInline(text) }}
      />
    );
  };

  while (i < lines.length) {
    const ln = lines[i];
    const trimmed = ln.trim();

    // Page break
    if (/^\[PAGE\s*BREAK\]$/i.test(trimmed)) {
      flushPara();
      blocks.push(
        <div key={`${keyPrefix}pb-${i}`} className="pdf-page-break" data-testid="pdf-page-break">
          — page break —
        </div>
      );
      i++;
      continue;
    }

    // Figure reference
    const figMatch = trimmed.match(/^\[Figure:([^\]]+)\]\s*(.*)?$/);
    if (figMatch) {
      flushPara();
      const figId = figMatch[1].trim();
      const fig = figuresMap[figId];
      if (fig) {
        const widthClass = fig.width === "half" ? "max-w-[60%] mx-auto" : fig.width === "third" ? "max-w-[40%] mx-auto" : "";
        blocks.push(
          <figure key={`${keyPrefix}fig-${i}`} className="pdf-figure" data-testid={`pdf-figure-${figId}`}>
            <img src={fig.data_url} alt={fig.caption} className={widthClass} />
            <figcaption className="pdf-figure-caption">
              <strong>{fig.label}.</strong> {fig.caption}
            </figcaption>
          </figure>
        );
      } else {
        blocks.push(
          <div key={`${keyPrefix}fig-${i}`} className="text-xs italic text-zinc-500 my-2">
            [Figure not found: {figId}]
          </div>
        );
      }
      i++;
      continue;
    }

    // Inline figure caption (legacy)
    if (trimmed.startsWith("[Figure:") && !figMatch) {
      flushPara();
      blocks.push(
        <div key={`${keyPrefix}figcap-${i}`} className="text-xs italic text-zinc-600 text-center my-2">
          <strong>Figure.</strong> {trimmed.slice(8).replace(/\]$/, "").trim()}
        </div>
      );
      i++;
      continue;
    }

    // Table block — starts with [Table:...] or | header |
    const tableLabelMatch = trimmed.match(/^\[Table:([^\]]+)\]\s*(.*)?$/);
    if (tableLabelMatch || trimmed.startsWith("|")) {
      flushPara();
      let label = "";
      let caption = "";
      if (tableLabelMatch) {
        label = tableLabelMatch[1].trim();
        caption = (tableLabelMatch[2] || "").trim();
        i++;
      }
      // Collect contiguous table rows
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(lines[i].trim());
        i++;
      }
      if (rows.length >= 2) {
        const cellsOf = (line) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
        const headerRow = cellsOf(rows[0]);
        const bodyRows = rows
          .slice(1)
          .filter((r) => !/^\|\s*-+\s*(\|\s*-+\s*)*\|?$/.test(r)) // skip separator
          .map(cellsOf);
        blocks.push(
          <div key={`${keyPrefix}tbl-${i}`} data-testid={`pdf-table-${label || blocks.length}`}>
            {(label || caption) && (
              <div className="pdf-table-caption">
                {label && <strong>{label}.</strong>} {caption}
              </div>
            )}
            <table className="pdf-table">
              <thead>
                <tr>
                  {headerRow.map((h, k) => (
                    <th key={k} dangerouslySetInnerHTML={{ __html: renderInline(h) }} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((c, cIdx) => (
                      <td key={cIdx} dangerouslySetInnerHTML={{ __html: renderInline(c) }} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Heading
    if (trimmed.startsWith("### ")) {
      flushPara();
      blocks.push(
        <h4 key={`${keyPrefix}h4-${i}`} className="font-sans font-semibold text-sm mt-3 mb-1.5">
          {trimmed.slice(4)}
        </h4>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushPara();
      blocks.push(
        <h3 key={`${keyPrefix}h3-${i}`} className="font-sans font-semibold text-base mt-4 mb-2">
          {trimmed.slice(3)}
        </h3>
      );
      i++;
      continue;
    }

    // Formula
    if (trimmed.startsWith("$$") && trimmed.endsWith("$$") && trimmed.length >= 4) {
      flushPara();
      blocks.push(
        <div
          key={`${keyPrefix}f-${i}`}
          className="text-center my-3 font-mono text-sm bg-zinc-100 py-2 rounded-sm"
        >
          {trimmed.slice(2, -2).trim()}
        </div>
      );
      i++;
      continue;
    }

    // Blank line → flush paragraph
    if (!trimmed) {
      flushPara();
      i++;
      continue;
    }

    // Normal text line
    paraBuf.push(trimmed);
    i++;
  }
  flushPara();
  return blocks;
}

export function PDFPreview({ article, formattedRefs = [] }) {
  const j = article.journal || {};
  const handlePrint = () => window.print();
  const figuresMap = React.useMemo(() => {
    const m = {};
    for (const f of article.figures || []) m[f.id] = f;
    return m;
  }, [article.figures]);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border px-3 py-2 flex items-center justify-between bg-card shrink-0">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">PDF Layout Preview</div>
        <button
          onClick={handlePrint}
          data-testid="print-pdf-btn"
          className="text-xs flex items-center gap-1 px-2 py-1 border border-border rounded-sm hover:bg-secondary"
        >
          <Printer className="h-3 w-3" /> Print / Save PDF
        </button>
      </div>
      <div className="flex-1 overflow-auto p-8 bg-zinc-800">
        <div className="pdf-preview mx-auto max-w-4xl shadow-xl rounded-sm p-12" data-testid="pdf-content">
          {/* Custom Journal Header with Logo */}
          {(j.logo || j.custom_header || j.title) && (
            <div className="border-b-2 border-zinc-700 pb-4 mb-6 flex items-center gap-4" data-testid="pdf-custom-header">
              {j.logo && (
                <img
                  src={j.logo}
                  alt="Journal logo"
                  className="h-16 w-auto object-contain shrink-0"
                  data-testid="pdf-journal-logo"
                />
              )}
              <div className="flex-1 min-w-0">
                {j.title && (
                  <div className="font-sans font-bold text-lg leading-tight" style={{ color: "#0f172a" }}>
                    {j.title}
                  </div>
                )}
                {j.custom_header && <div className="text-xs text-zinc-600 mt-0.5">{j.custom_header}</div>}
                <div className="text-[11px] text-zinc-500 mt-1 font-mono">
                  {j.issn && <span>ISSN: {j.issn}</span>}
                  {j.eissn && <span> · e-ISSN: {j.eissn}</span>}
                  {j.publisher && <span> · {j.publisher}</span>}
                </div>
              </div>
            </div>
          )}

          {/* Volume / DOI strip */}
          <div className="border-b border-zinc-300 pb-3 mb-6 text-xs flex justify-between text-zinc-600">
            <span>
              Vol. {j.volume || "—"}, No. {j.issue || "—"} ({j.year || "—"})
            </span>
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
            {(article.authors || []).map((a, i) =>
              a.affiliation ? (
                <div key={`aff-${i}`}>
                  <sup>{i + 1}</sup> {a.affiliation}
                  {a.country ? `, ${a.country}` : ""}
                </div>
              ) : null
            )}
            {(article.authors || []).find((a) => a.corresponding) && (
              <div className="mt-1">
                * Corresponding author: {(article.authors || []).find((a) => a.corresponding)?.email}
              </div>
            )}
          </div>

          {/* Abstract (justified, no hyphenation) */}
          {article.abstract?.english && (
            <div className="bg-zinc-50 border-l-4 border-zinc-400 p-4 mb-6 text-sm">
              <div className="font-sans font-bold uppercase tracking-wider text-xs mb-2">Abstract</div>
              <p className="leading-relaxed pdf-abstract">{article.abstract.english}</p>
              {article.keywords?.length > 0 && (
                <div className="mt-3 text-xs">
                  <strong>Keywords:</strong> {article.keywords.join(", ")}
                </div>
              )}
              {(article.received_date || article.revised_date || article.accepted_date) && (
                <div className="mt-2 text-xs text-zinc-600 font-sans" data-testid="pdf-history-dates">
                  {article.received_date && (
                    <span>
                      <strong>Received:</strong> {article.received_date}{" "}
                    </span>
                  )}
                  {article.revised_date && (
                    <span>
                      {" "}
                      · <strong>Revised:</strong> {article.revised_date}{" "}
                    </span>
                  )}
                  {article.accepted_date && (
                    <span>
                      {" "}
                      · <strong>Accepted:</strong> {article.accepted_date}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Single column body */}
          <div className="pdf-body text-sm leading-relaxed">
            {[
              { t: "Introduction", b: article.sections?.introduction },
              { t: "Methods", b: article.sections?.methods },
              { t: "Results", b: article.sections?.results },
              { t: "Discussion", b: article.sections?.discussion },
              { t: "Conclusion", b: article.sections?.conclusion },
            ].map((s, i) =>
              s.b ? (
                <React.Fragment key={i}>
                  <h2
                    className="pdf-section font-sans font-semibold text-base mt-4 mb-2 uppercase tracking-wider"
                    style={{ color: "#1e293b" }}
                  >
                    {s.t}
                  </h2>
                  {renderBlocks(s.b, figuresMap, `${s.t}-`)}
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
                {formattedRefs.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
