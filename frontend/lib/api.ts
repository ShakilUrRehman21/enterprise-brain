import { User, DocumentItem, ConversationItem, MessageItem, SearchResultItem, EvaluationMetricReport } from "./types";

const REMOTE_BACKEND = "https://enterprise-brain-k03n.onrender.com/api";
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
    ? REMOTE_BACKEND
    : "/api");

export interface ActiveUserSession {
  email: string;
  role: "admin" | "member";
  name: string;
}

export const DEFAULT_USER: ActiveUserSession = {
  email: "sarah_chen@enterprise.com",
  role: "admin",
  name: "Sarah Chen (Admin)",
};

let activeUser: ActiveUserSession = DEFAULT_USER;

export function setActiveUser(user: ActiveUserSession) {
  activeUser = user;
  if (typeof window !== "undefined") {
    localStorage.setItem("enterprise_brain_user", JSON.stringify(user));
  }
}

export function getActiveUser() {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("enterprise_brain_user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.email) {
          activeUser = parsed;
        }
      } catch (e) {
        // ignore
      }
    }
  }
  return activeUser;
}

export function getGeminiApiKey(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("enterprise_brain_gemini_key") || "";
  }
  return "";
}

export function setGeminiApiKey(key: string) {
  if (typeof window !== "undefined") {
    if (key && key.trim()) {
      localStorage.setItem("enterprise_brain_gemini_key", key.trim());
    } else {
      localStorage.removeItem("enterprise_brain_gemini_key");
    }
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const current = getActiveUser();
  const headers = new Headers(options.headers || {});

  headers.set("X-User-Email", current.email);
  headers.set("X-User-Role", current.role);
  headers.set("X-User-Name", current.name);

  const geminiKey = getGeminiApiKey();
  if (geminiKey) {
    headers.set("X-Gemini-API-Key", geminiKey);
  }

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    throw new Error(
      `Cannot connect to backend server at ${API_BASE}. Please make sure the backend is running with 'python -m uvicorn app.main:app --port 8000'.`
    );
  }

  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { detail: text || `Request failed with status ${response.status}` };
  }

  if (!response.ok) {
    let errorDetail = data.detail || data.error || `Request failed with status ${response.status}`;
    if (Array.isArray(errorDetail)) {
      errorDetail = errorDetail.map((e: any) => e.msg || JSON.stringify(e)).join(", ");
    }
    throw new Error(errorDetail);
  }

  return data as T;
}

export const api = {
  // Auth
  getCurrentUser: () => request<User>("/auth/me"),
  getOrgUsers: () => request<User[]>("/auth/users"),

  // Documents
  getDocuments: () => request<DocumentItem[]>("/documents"),
  getDocument: (id: string) => request<DocumentItem>(`/documents/${id}`),
  getDocumentPreview: (id: string) => request<any>(`/documents/${id}/preview`),
  uploadDocument: (formData: FormData) =>
    request<DocumentItem>("/documents/upload", {
      method: "POST",
      body: formData,
    }),
  deleteDocument: (id: string) =>
    request<{ success: boolean; message: string }>(`/documents/${id}`, {
      method: "DELETE",
    }),
  retryDocument: (id: string) =>
    request<DocumentItem>(`/documents/${id}/retry`, {
      method: "POST",
    }),
  updatePermissions: (id: string, accessLevel: string, userIds?: string[]) =>
    request<{ success: boolean; message: string }>(`/documents/${id}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ access_level: accessLevel, user_ids: userIds || [] }),
    }),

  // Search
  search: (query: string, options: { mode?: "hybrid" | "vector" | "keyword"; limit?: number; collection_id?: string }) =>
    request<{ query: string; total_hits: number; results: SearchResultItem[] }>("/search", {
      method: "POST",
      body: JSON.stringify({ query, ...options }),
    }),

  // Chat
  getConversations: () => request<ConversationItem[]>("/conversations"),
  getConversation: (id: string) => request<ConversationItem>(`/conversations/${id}`),
  createConversation: (title?: string) =>
    request<ConversationItem>("/conversations", {
      method: "POST",
      body: JSON.stringify({ title: title || "New Investigation" }),
    }),
  deleteConversation: (id: string) =>
    request<{ success: boolean }>(`/conversations/${id}`, {
      method: "DELETE",
    }),
  sendMessage: (conversationId?: string | null, message?: string) =>
    request<{ message: MessageItem; conversation_id: string }>("/chat", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: conversationId && !conversationId.startsWith("temp_") ? conversationId : null,
        message: message || "",
      }),
    }),

  // Evaluation
  getEvaluationDataset: () => request<any[]>("/evaluation/dataset"),
  runEvaluation: () => request<EvaluationMetricReport>("/evaluation/run", { method: "POST" }),
  getEvaluationReport: () => request<EvaluationMetricReport>("/evaluation/report"),

  // Seed & Reset Demo Data
  seedDemoData: () => request<{ message: string; documents_created: number }>("/demo/seed", { method: "POST" }),
  resetDemoData: () => request<{ success: boolean; message: string; documents_created: number }>("/demo/reset", { method: "POST" }),
};
