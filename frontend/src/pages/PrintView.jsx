import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { PDFPreview } from "../components/PDFPreview";
import { api } from "../lib/api";

/**
 * Standalone print route — used by server-side Chrome headless to render
 * the same PDFPreview component without any editor chrome. The print CSS in
 * index.css further trims any non-article elements.
 */
export default function PrintView() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [issueInfo, setIssueInfo] = useState(null);
  const [formattedRefs, setFormattedRefs] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    document.documentElement.classList.remove("dark");
    document.documentElement.classList.add("light");

    (async () => {
      try {
        const [art, info] = await Promise.all([api.getArticle(id), api.getIssueInfo(id).catch(() => null)]);
        if (cancelled) return;
        setArticle(art);
        setIssueInfo(info);
        if (art.references?.length) {
          const style = art.citation_style || "apa";
          const f = await api.formatReferences(art.references, style);
          if (!cancelled) setFormattedRefs(f.formatted);
        }
        // Wait one extra tick for fonts & images
        setTimeout(() => {
          if (!cancelled) {
            setReady(true);
            document.title = `print-ready`;
            // marker for chrome headless to detect
            document.body.setAttribute("data-print-ready", "true");
          }
        }, 500);
      } catch (e) {
        document.body.setAttribute("data-print-error", e.message || "error");
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (!article) {
    return <div style={{ padding: 24 }}>Loading article…</div>;
  }

  return (
    <div data-print-ready={ready ? "true" : "false"} style={{ background: "#ffffff", minHeight: "100vh" }}>
      <PDFPreview article={article} formattedRefs={formattedRefs} issueInfo={issueInfo} />
    </div>
  );
}
