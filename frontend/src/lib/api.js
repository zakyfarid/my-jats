import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const client = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor — always attach latest token from localStorage
client.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("ojats-auth-token") : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — on 401, clear token + redirect to login
client.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      const path = window.location.pathname;
      if (!path.startsWith("/login") && !path.startsWith("/print")) {
        localStorage.removeItem("ojats-auth-token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

export const api = {
  listArticles: (params = {}) => client.get("/articles", { params }).then((r) => r.data),
  getArticle: (id) => client.get(`/articles/${id}`).then((r) => r.data),
  getIssueInfo: (id) => client.get(`/articles/${id}/issue-info`).then((r) => r.data),
  createArticle: (data) => client.post("/articles", data).then((r) => r.data),
  updateArticle: (id, data) => client.put(`/articles/${id}`, data).then((r) => r.data),
  deleteArticle: (id) => client.delete(`/articles/${id}`).then((r) => r.data),

  validateInline: (article) => client.post("/validate/article", article).then((r) => r.data),

  getJATS: (id) => client.get(`/articles/${id}/jats`, { responseType: "text" }).then((r) => r.data),
  getPKP: (id) => client.get(`/articles/${id}/pkp`, { responseType: "text" }).then((r) => r.data),
  getCrossref: (id) => client.get(`/articles/${id}/crossref`, { responseType: "text" }).then((r) => r.data),

  downloadXML: (id, kind) => `${API_BASE}/articles/${id}/${kind}?download=true`,
  downloadDOCX: (id, style = "apa") => `${API_BASE}/articles/${id}/docx?style=${style}`,
  downloadPDF: (id) => `${API_BASE}/articles/${id}/pdf`,

  importReferences: (format, content) =>
    client.post("/references/import", { format, content }).then((r) => r.data),
  parseReferencesText: (text) =>
    client.post("/references/parse-text", { text }).then((r) => r.data),
  exportReferences: (format, references) =>
    client.post("/references/export", { format, references }, { responseType: "blob" }).then((r) => r.data),
  formatReferences: (references, style) =>
    client.post("/references/format", { references, style }).then((r) => r.data),

  crossrefLookup: (doi) => client.get("/lookup/crossref", { params: { doi } }).then((r) => r.data),
  orcidLookup: (orcid) => client.get("/lookup/orcid", { params: { orcid } }).then((r) => r.data),

  listTemplates: () => client.get("/templates").then((r) => r.data),
  createTemplate: (data) => client.post("/templates", data).then((r) => r.data),
  updateTemplate: (id, data) => client.put(`/templates/${id}`, data).then((r) => r.data),
  deleteTemplate: (id) => client.delete(`/templates/${id}`).then((r) => r.data),

  // Admin management
  listAdmins: () => client.get("/admins").then((r) => r.data),
  createAdmin: (data) => client.post("/admins", data).then((r) => r.data),
  deleteAdmin: (id) => client.delete(`/admins/${id}`).then((r) => r.data),

  // DOCX upload (auto-detect title + IMRAD)
  uploadDocx: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return client.post("/articles/upload-docx", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data);
  },
};

// Attach default Authorization header from localStorage on import
// (Interceptor above handles this dynamically per-request)
const _ignored = null;
