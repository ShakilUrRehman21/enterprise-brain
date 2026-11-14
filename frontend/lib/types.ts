export type Role = "admin" | "member";
export type AccessLevel = "private" | "shared" | "organization";
export type DocStatus = "processing" | "indexed" | "failed";
export type SearchMode = "hybrid" | "vector" | "keyword";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface DirectoryEntry {
  id: string;
  full_name: string;
  email: string;
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  user: User;
}

export interface DocumentItem {
  id: string;
  title: string;
  filename: string;
  file_type: string;
  file_size: number;
  owner_id: string;
  owner_name: string | null;
  status: DocStatus;
  access_level: AccessLevel;
  error_message: string | null;
  page_count: number | null;
  chunk_count: number;
  is_sample: boolean;
  can_manage: boolean;
  shared_with: string[];
  created_at: string;
  updated_at: string;
}

export interface Chunk {
  id: string;
  chunk_index: number;
  content: string;
  page_number: number | null;
  section_title: string | null;
  word_count: number;
}

export interface DocumentDetail extends DocumentItem {
  chunks: Chunk[];
}

export interface Citation {
  number: number;
  chunk_id: string;
  document_id: string;
  document_title: string;
  page_number: number | null;
  section_title: string | null;
  passage: string;
  quote: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  abstained: boolean;
  confidence: number | null;
  engine: string | null;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation extends ConversationSummary {
  messages: Message[];
}

export interface ChatResponse {
  conversation: ConversationSummary;
  user_message: Message;
  message: Message;
}

export interface SearchHit {
  chunk_id: string;
  document_id: string;
  document_title: string;
  page_number: number | null;
  section_title: string | null;
  content: string;
  score: number;
  vector_score: number;
  keyword_score: number;
  access_level: AccessLevel;
}

export interface SearchResponse {
  query: string;
  mode: SearchMode;
  vector_available: boolean;
  results: SearchHit[];
}

export interface PublicInfo {
  name: string;
  version: string;
  registration_open: boolean;
  needs_first_admin: boolean;
}

export interface SystemStatus {
  version: string;
  ai_engine: "gemini" | "local";
  generation_model: string | null;
  embedding_model: string;
  database: string;
  registration_open: boolean;
  documents_indexed: number;
  stale_chunks: number;
  last_ai_error: string | null;
}

export interface EvaluationRow {
  id: string;
  category: string;
  question: string;
  as_role: Role;
  should_abstain: boolean;
  abstained: boolean;
  answer: string;
  citations: { number: number; document_title: string }[];
  retrieved: string[];
  recall_at_5: number | null;
  mrr: number | null;
  fact_recall: number | null;
  citation_precision: number | null;
  citation_recall: number | null;
  leaked: boolean;
  passed: boolean;
}

export interface EvaluationSummary {
  total: number;
  passed: number;
  pass_rate: number | null;
  recall_at_5: number | null;
  mrr: number | null;
  fact_recall: number | null;
  citation_precision: number | null;
  citation_recall: number | null;
  abstention_accuracy: number | null;
  false_abstention_rate: number | null;
  leaks: number;
  categories: Record<string, { total: number; passed: number }>;
}

export interface EvaluationRun {
  id: string;
  engine: string;
  summary: EvaluationSummary;
  results: EvaluationRow[];
  created_at: string;
}
