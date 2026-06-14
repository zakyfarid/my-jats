import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const client = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

export const api = {
  listArticles: (params = {}) => client.get("/articles", { params }).then((r) => r.data),
  getArticle: (id) => client.get(`/articles/${id}`).then((r) => r.data),
  createArticle: (data) => client.post("/articles", data).then((r) => r.data),
  updateArticle: (id, data) => client.put(`/articles/${id}`, data).then((r) => r.data),
  deleteArticle: (id) => client.delete(`/articles/${id}`).then((r) => r.data),

  validateInline: (article) => client.post("/validate/article", article).then((r) => r.data),

  getJATS: (id) => client.get(`/articles/${id}/jats`, { responseType: "text" }).then((r) => r.data),
  getPKP: (id) => client.get(`/articles/${id}/pkp`, { responseType: "text" }).then((r) => r.data),
  getCrossref: (id) => client.get(`/articles/${id}/crossref`, { responseType: "text" }).then((r) => r.data),

  downloadXML: (id, kind) => `${API_BASE}/articles/${id}/${kind}?download=true`,
  downloadDOCX: (id, style = "apa") => `${API_BASE}/articles/${id}/docx?style=${style}`,

  importReferences: (format, content) =>
    client.post("/references/import", { format, content }).then((r) => r.data),
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
};
