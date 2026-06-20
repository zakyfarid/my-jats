import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader";
import { api } from "../lib/api";
import { Plus, Search, FileText, Calendar, Hash, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "review", label: "Review" },
  { value: "layout", label: "Layout" },
  { value: "published", label: "Published" },
];

function StatusBadge({ status }) {
  return (
    <span
      data-testid={`status-${status}`}
      className={`inline-flex items-center text-[10px] uppercase tracking-wider border px-2 py-0.5 rounded-sm status-${status}`}
    >
      {status}
    </span>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [volume, setVolume] = useState("");
  const [issue, setIssue] = useState("");
  const [year, setYear] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (status) params.status = status;
      if (volume) params.volume = volume;
      if (issue) params.issue = issue;
      if (year) params.year = year;
      const data = await api.listArticles(params);
      setArticles(data);
    } catch (e) {
      toast.error("Failed to load articles");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, volume, issue, year]);

  const handleSearch = (e) => {
    e.preventDefault();
    load();
  };

  const createNew = async () => {
    try {
      const newArt = await api.createArticle({
        title: "Untitled Article",
        status: "draft",
        journal: { year: String(new Date().getFullYear()) },
      });
      toast.success("Article created");
      navigate(`/editor/${newArt.id}`);
    } catch (e) {
      toast.error("Failed to create article");
    }
  };

  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const art = await api.uploadDocx(file);
      toast.success(`Imported "${art.title?.slice(0, 50) || 'article'}"`);
      navigate(`/editor/${art.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete article "${title}"? This cannot be undone.`)) return;
    try {
      await api.deleteArticle(id);
      toast.success("Article deleted");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Delete failed");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                Workspace
              </div>
              <h1 className="text-2xl font-semibold tracking-tight" data-testid="dashboard-title">
                Articles
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Layout, validate, and export scholarly articles to JATS, PKP, Crossref XML.
              </p>
            </div>
            <div className="flex items-center gap-2">
            <button
              data-testid="new-article-btn"
              onClick={createNew}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 text-sm rounded-sm hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Article
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleUpload}
              className="hidden"
              data-testid="upload-docx-input"
            />
            <button
              data-testid="upload-docx-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 border border-border px-3 py-2 text-sm rounded-sm hover:bg-secondary disabled:opacity-50"
              title="Upload DOCX — auto-detect title & IMRAD sections"
            >
              <Upload className="h-4 w-4" />
              {uploading ? "Uploading…" : "Upload DOCX"}
            </button>
            </div>
          </div>

          {/* Filters bar */}
          <form
            onSubmit={handleSearch}
            className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-6 border border-border rounded-sm bg-card p-3"
          >
            <div className="md:col-span-2 relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                data-testid="search-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search title, DOI, keywords..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-background border border-border rounded-sm focus:border-primary"
              />
            </div>
            <select
              data-testid="status-filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-background border border-border rounded-sm px-2 py-2 text-sm focus:border-primary"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              data-testid="volume-filter"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="Volume"
              className="bg-background border border-border rounded-sm px-2 py-2 text-sm focus:border-primary"
            />
            <input
              data-testid="issue-filter"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="Issue"
              className="bg-background border border-border rounded-sm px-2 py-2 text-sm focus:border-primary"
            />
            <input
              data-testid="year-filter"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="Year"
              className="bg-background border border-border rounded-sm px-2 py-2 text-sm focus:border-primary"
            />
          </form>

          {/* Articles table */}
          <div className="border border-border rounded-sm bg-card overflow-hidden">
              <div className="grid grid-cols-12 gap-4 px-4 py-2.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground border-b border-border bg-secondary/30">
              <div className="col-span-4">Title</div>
              <div className="col-span-2">Authors</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1">Vol</div>
              <div className="col-span-1">Issue</div>
              <div className="col-span-1">Year</div>
              <div className="col-span-1">Updated</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm" data-testid="loading-state">
                Loading articles...
              </div>
            ) : articles.length === 0 ? (
              <div className="p-12 text-center" data-testid="empty-state">
                <FileText className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No articles yet. Create one to begin.</p>
              </div>
            ) : (
              <div data-testid="articles-list">
                {articles.map((a) => (
                  <div
                    key={a.id}
                    data-testid={`article-row-${a.id}`}
                    className="grid grid-cols-12 gap-4 px-4 py-3 text-sm border-b border-border last:border-0 hover:bg-secondary/30 transition-colors items-center"
                  >
                    <Link to={`/editor/${a.id}`} className="col-span-4 min-w-0">
                      <div className="font-medium truncate" data-testid={`article-title-${a.id}`}>
                        {a.title}
                      </div>
                      {a.journal_title && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{a.journal_title}</div>
                      )}
                    </Link>
                    <div className="col-span-2 text-xs text-muted-foreground truncate">
                      {a.authors.length ? a.authors.slice(0, 2).join(", ") + (a.authors.length > 2 ? ` +${a.authors.length - 2}` : "") : "—"}
                    </div>
                    <div className="col-span-1">
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="col-span-1 font-mono text-xs">{a.volume || "—"}</div>
                    <div className="col-span-1 font-mono text-xs">{a.issue || "—"}</div>
                    <div className="col-span-1 font-mono text-xs">{a.year || "—"}</div>
                    <div className="col-span-1 text-xs text-muted-foreground">
                      {a.updated_at ? new Date(a.updated_at).toLocaleDateString() : "—"}
                    </div>
                    <div className="col-span-1 text-right">
                      <button
                        onClick={() => handleDelete(a.id, a.title)}
                        data-testid={`delete-article-${a.id}`}
                        className="text-destructive hover:text-destructive/80 p-1"
                        title="Delete article"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 text-xs text-muted-foreground flex items-center gap-4">
            <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> {articles.length} article{articles.length !== 1 ? "s" : ""}</span>
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Updated {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
