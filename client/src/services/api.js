/**
 * Centralized API client.
 *
 * Single source of truth for the backend base URL and every endpoint the app
 * calls. Previously the `VITE_API_URL || localhost:5000` literal and ad-hoc
 * fetch boilerplate were duplicated ~18 times across hooks/components, which is
 * error-prone (and was the breeding ground for copy-paste bugs). Everything now
 * funnels through here, so headers, auth tokens, JSON encoding, and error
 * handling are consistent — and changing the base URL is a one-line edit.
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/** Error carrying the backend's message and HTTP status, so callers can branch on it. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Low-level fetch wrapper. Adds the auth token + JSON/form headers and returns
 * the raw Response so per-endpoint helpers can read it however they need.
 */
async function rawRequest(path, { method = 'GET', body, token, headers = {} } = {}) {
  const finalHeaders = { ...headers };
  if (token) finalHeaders['Authorization'] = `Bearer ${token}`;

  const isForm = body instanceof FormData;
  if (body !== undefined && body !== null && !isForm) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  return fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: isForm ? body : body !== undefined && body !== null ? JSON.stringify(body) : undefined,
  });
}

/** JSON helper: parses the body and throws an {@link ApiError} on a non-2xx response. */
async function requestJson(path, opts) {
  const res = await rawRequest(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  }
  return data;
}

/**
 * Direct URL to a repo file, for cases where the browser fetches it itself
 * (e.g. an <img src> for a binary image). For text content use `api.getFileContent`.
 */
export const fileContentUrl = (projectId, path) =>
  `${API_BASE_URL}/api/projects/${projectId}/github/file?path=${encodeURIComponent(path)}`;

export const api = {
  // --- Open (student) endpoints -------------------------------------------
  uploadProject: (formData) => requestJson('/api/projects/upload', { method: 'POST', body: formData }),
  getProject: (id) => requestJson(`/api/projects/${id}`),
  updateProject: (id, data) => requestJson(`/api/projects/${id}`, { method: 'PATCH', body: data }),
  getTree: (id) => requestJson(`/api/projects/${id}/github/tree`),
  getMessages: (id) => requestJson(`/api/projects/${id}/messages`),
  saveMessage: (id, message) => requestJson(`/api/projects/${id}/messages`, { method: 'POST', body: message }),
  sendChat: (id, payload) => requestJson(`/api/projects/${id}/chat`, { method: 'POST', body: payload }),
  analyze: (id) => requestJson(`/api/projects/${id}/analyze`, { method: 'POST' }),
  checkRequirements: (id) => requestJson(`/api/projects/${id}/check-requirements`, { method: 'POST' }),

  /**
   * Fetches a file's text. "Not found" is a normal outcome here (the AI may cite
   * a path that doesn't exist), so this resolves to { ok, content } instead of
   * throwing, letting the caller show a tailored message.
   */
  getFileContent: async (id, path) => {
    const res = await rawRequest(`/api/projects/${id}/github/file?path=${encodeURIComponent(path)}`);
    if (!res.ok) return { ok: false, content: null };
    return { ok: true, content: await res.text() };
  },

  // --- Lecturer-only endpoints (require a Clerk token) --------------------
  listProjects: (token) => requestJson('/api/projects', { token }),
  deleteProject: (id, token) => requestJson(`/api/projects/${id}`, { method: 'DELETE', token }),
  inviteLecturer: (email, token) => requestJson('/api/lecturers', { method: 'POST', token, body: { email } }),
};
