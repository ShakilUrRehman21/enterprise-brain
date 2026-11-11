import type {
  AccessLevel,
  ChatResponse,
  Conversation,
  ConversationSummary,
  DirectoryEntry,
  DocumentDetail,
  DocumentItem,
  EvaluationRun,
  PublicInfo,
  Role,
  SearchMode,
  SearchResponse,
  SystemStatus,
  TokenResponse,
  User,
} from "./types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");
const TOKEN_KEY = "eb.token";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export const session = {
  get token() {
    return readToken();
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable: session lasts for this page only */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

/** Fired when the server rejects our token, so the app can show sign-in. */
export const SESSION_EXPIRED_EVENT = "eb:session-expired";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = readToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check that the backend is running, then try again.");
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    if (res.status === 401 && token) {
      session.clear();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    const detail = typeof body?.detail === "string" ? body.detail : null;
    // A 5xx without our JSON error body comes from the proxy, not the API:
    // the backend is down, restarting, or took too long to respond.
    const fallback =
      res.status >= 500
        ? body === null
          ? "The backend didn't respond. Check that it's running (and its terminal for errors), then try again."
          : "The server hit an error. Try again in a moment."
        : `Request failed (${res.status}).`;
    throw new ApiError(res.status, detail || fallback);
  }
  return body as T;
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
});

export const api = {
  info: () => request<PublicInfo>("/system/info"),
  status: () => request<SystemStatus>("/system/status"),

  login: (email: string, password: string) => request<TokenResponse>("/auth/login", json("POST", { email, password })),
  register: (email: string, full_name: string, password: string) =>
    request<TokenResponse>("/auth/register", json("POST", { email, full_name, password })),
  me: () => request<User>("/auth/me"),
  changePassword: (current_password: string, new_password: string) =>
    request<void>("/auth/password", json("POST", { current_password, new_password })),

  directory: () => request<DirectoryEntry[]>("/users/directory"),
  users: () => request<User[]>("/users"),
  updateUser: (id: string, data: { role?: Role; is_active?: boolean }) => request<User>(`/users/${id}`, json("PATCH", data)),

  documents: () => request<DocumentItem[]>("/documents"),
  document: (id: string) => request<DocumentDetail>(`/documents/${id}`),
  upload: (file: File, opts: { title?: string; access_level: AccessLevel; user_ids?: string[] }) => {
    const form = new FormData();
    form.append("file", file);
    if (opts.title) form.append("title", opts.title);
    form.append("access_level", opts.access_level);
    (opts.user_ids || []).forEach((id) => form.append("user_ids", id));
    return request<DocumentItem>("/documents", { method: "POST", body: form });
  },
  setAccess: (id: string, access_level: AccessLevel, user_ids: string[]) =>
    request<DocumentItem>(`/documents/${id}/access`, json("PUT", { access_level, user_ids })),
  reprocess: (id: string) => request<DocumentItem>(`/documents/${id}/reprocess`, { method: "POST" }),
  deleteDocument: (id: string) => request<void>(`/documents/${id}`, { method: "DELETE" }),
  downloadDocument: async (doc: DocumentItem) => {
    const token = readToken();
    const res = await fetch(`${API_BASE}/documents/${doc.id}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new ApiError(res.status, "Couldn't download the file.");
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: doc.filename });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  addSamples: () => request<{ added: string[] }>("/system/sample-documents", { method: "POST" }),
  reindex: () => request<{ chunks_updated: number }>("/system/reindex", { method: "POST" }),

  search: (query: string, mode: SearchMode, limit = 12) =>
    request<SearchResponse>("/search", json("POST", { query, mode, limit })),

  conversations: () => request<ConversationSummary[]>("/conversations"),
  conversation: (id: string) => request<Conversation>(`/conversations/${id}`),
  deleteConversation: (id: string) => request<void>(`/conversations/${id}`, { method: "DELETE" }),
  ask: (message: string, conversation_id?: string | null) =>
    request<ChatResponse>("/chat", json("POST", { message, conversation_id: conversation_id || null })),

  latestEvaluation: () => request<EvaluationRun | null>("/evaluation/latest"),
  runEvaluation: () => request<EvaluationRun>("/evaluation/run", { method: "POST" }),
};
