export type UserRole = "admin" | "member";

export interface User {
  id: string;
  clerk_user_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export type DocumentStatus = "uploaded" | "processing" | "indexed" | "failed";
export type AccessLevel = "private" | "shared" | "organization";

export interface DocumentItem {
  id: string;
  title: string;
  filename: string;
  file_type: "pdf" | "docx" | "txt";
  file_size: number;
  owner_id: string;
  collection_id?: string | null;
  status: DocumentStatus;
  access_level: AccessLevel;
  error_message?: string | null;
  extracted_text_preview?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunkItem {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  page_number?: number | null;
  section_title?: string | null;
  token_count?: number | null;
}

export interface Citation {
  citation_number: number;
  document_id: string;
  document_title: string;
  page_number?: number | null;
  section_title?: string | null;
  chunk_id: string;
  exact_passage: string;
}

export interface MessageItem {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[] | null;
  confidence_score?: number | null;
  abstained?: boolean;
  created_at: string;
}

export interface ConversationItem {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: MessageItem[];
}

export interface SearchResultItem {
  chunk_id: string;
  document_id: string;
  document_title: string;
  page_number?: number | null;
  section_title?: string | null;
  content: string;
  similarity_score: number;
  keyword_score: number;
  combined_rrf_score: number;
  access_level: AccessLevel;
}

export interface EvaluationItem {
  id: string;
  category: string;
  question: string;
  expected_answer: string;
  should_abstain: boolean;
  target_user_role?: string;
}

export interface EvaluationMetricReport {
  total_evaluated: number;
  retrieval_recall_at_5: number;
  retrieval_precision_at_5: number;
  mrr: number;
  answer_correctness: number;
  citation_precision: number;
  citation_recall: number;
  unsupported_claim_rate: number;
  abstention_accuracy: number;
  category_breakdown: Record<string, {
    total: number;
    passed: number;
    accuracy: number;
    abstention_rate?: number;
  }>;
  results: {
    question: string;
    category: string;
    expected: string;
    generated: string;
    passed: boolean;
    citations: Citation[];
    recall_at_5?: number;
    mrr?: number;
    correctness?: number;
    notes?: string;
  }[];
}
