"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Sparkles,
  Bot,
  User as UserIcon,
  Plus,
  Trash2,
  Bookmark,
  ShieldAlert,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  ExternalLink,
  MessageSquare,
  FileText
} from "lucide-react";
import { api } from "@/lib/api";
import { ConversationItem, MessageItem, Citation } from "@/lib/types";

interface ChatViewProps {
  onSelectCitation: (citation: Citation) => void;
  activeUser: { email: string; role: "admin" | "member"; name: string };
  initialQuery?: string | null;
  onClearInitialQuery?: () => void;
}

const SUGGESTED_QUERIES = [
  {
    tag: "Expense Policy",
    query: "What is the company's reimbursement deadline for employee expenses?",
  },
  {
    tag: "Architecture",
    query: "What database and protocol requirements are mandated for internal microservices?",
  },
  {
    tag: "Access Control",
    query: "What is the confidential executive leave and compensation policy?",
  },
  {
    tag: "Abstention Check",
    query: "What is the company's annual revenue for fiscal year 2023?",
  },
];

export const ChatView: React.FC<ChatViewProps> = ({
  onSelectCitation,
  activeUser,
  initialQuery,
  onClearInitialQuery,
}) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    try {
      const convs = await api.getConversations();
      setConversations(convs);
      if (convs.length > 0 && !currentConversation) {
        selectConversation(convs[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectConversation = async (convId: string) => {
    try {
      const conv = await api.getConversation(convId);
      setCurrentConversation(conv);
      setMessages(conv.messages || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [activeUser]);

  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      handleSendMessage(initialQuery.trim());
      if (onClearInitialQuery) onClearInitialQuery();
    }
  }, [initialQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const q = (textToSend || inputText).trim();
    if (!q || loading) return;

    setInputText("");
    const tempId = `temp_${Date.now()}`;
    const userMsg: MessageItem = {
      id: tempId,
      conversation_id: currentConversation?.id || "",
      role: "user",
      content: q,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await api.sendMessage(currentConversation?.id || null, q);
      setMessages((prev) => [...prev, res.message]);

      if (!currentConversation) {
        setCurrentConversation({
          id: res.conversation_id,
          user_id: "",
          title: q.slice(0, 32) + (q.length > 32 ? "..." : ""),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        await fetchConversations();
      }
    } catch (e: any) {
      const errorMsg: MessageItem = {
        id: `err_${Date.now()}`,
        conversation_id: currentConversation?.id || "",
        role: "assistant",
        content: `Error: ${e.message || "Failed to connect to backend server."}`,
        abstained: true,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setCurrentConversation(null);
    setMessages([]);
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (currentConversation?.id === convId) {
        handleNewChat();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderFormattedBody = (rawContent: string, citations: Citation[]) => {
    // Strip trailing **Sources:** or SOURCES: text from content since citations are rendered as source pills
    const cleanText = rawContent
      .replace(/\n*\*\*Sources:\*\*[\s\S]*$/i, "")
      .replace(/\n*SOURCES:[\s\S]*$/i, "")
      .trim();
    const lines = cleanText.split("\n");

    const renderTextWithCitations = (textSpan: string) => {
      const parts = textSpan.split(/(\[\d+\])/g);
      return parts.map((part, pIdx) => {
        const match = part.match(/\[(\d+)\]/);
        if (match) {
          const citNum = parseInt(match[1]);
          const matchingCit = citations.find((c) => c.citation_number === citNum);
          return (
            <button
              key={pIdx}
              onClick={() => matchingCit && onSelectCitation(matchingCit)}
              className="inline-flex items-center gap-0.5 px-1.5 py-0.2 mx-0.5 rounded text-[11px] font-mono font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80 transition-all cursor-pointer shadow-2xs align-baseline"
              title={matchingCit ? `Inspect: ${matchingCit.document_title} (Page ${matchingCit.page_number || 1})` : "Citation"}
            >
              [{citNum}]
            </button>
          );
        }

        // Bold parsing for **text**
        const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
        return boldParts.map((bp, bIdx) => {
          if (bp.startsWith("**") && bp.endsWith("**")) {
            return (
              <strong key={bIdx} className="font-semibold text-slate-900">
                {bp.slice(2, -2)}
              </strong>
            );
          }
          return <span key={bIdx}>{bp}</span>;
        });
      });
    };

    return (
      <div className="space-y-2 text-xs md:text-sm text-slate-800 leading-relaxed font-sans">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;

          // Check for section headers (e.g. TECHNICAL SKILLS, PROJECTS, EXPERIENCE, EDUCATION, SUMMARY)
          const isHeader =
            (trimmed === trimmed.toUpperCase() && trimmed.length < 35 && !trimmed.includes(":") && !trimmed.includes(".")) ||
            trimmed.startsWith("###");

          if (isHeader) {
            const headerText = trimmed.replace(/^###\s*/, "");
            return (
              <div
                key={idx}
                className="text-xs font-bold uppercase tracking-wider text-slate-900 pt-3 pb-1 border-b border-slate-100 flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                <span>{headerText}</span>
              </div>
            );
          }

          // Check for category key-values (e.g. Languages:, Backend:, Frontend:, Databases & AI:, Tech:)
          const kvMatch = trimmed.match(/^([A-Za-z\s&/–-]+:)\s*(.*)$/);
          if (kvMatch && kvMatch[1].length < 30) {
            return (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 my-1">
                <span className="font-semibold text-slate-900 shrink-0 text-xs md:text-sm">
                  {kvMatch[1]}
                </span>
                <span className="text-slate-700 text-xs md:text-sm">
                  {renderTextWithCitations(kvMatch[2])}
                </span>
              </div>
            );
          }

          // Check for bullet items
          if (trimmed.startsWith("•") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            const bulletContent = trimmed.replace(/^[•\-*]\s*/, "");
            return (
              <div key={idx} className="flex items-start gap-2.5 my-1 pl-1 text-slate-700 text-xs md:text-sm leading-relaxed">
                <span className="text-blue-500 font-bold mt-1 text-[10px] shrink-0">•</span>
                <div className="flex-1">{renderTextWithCitations(bulletContent)}</div>
              </div>
            );
          }

          // Check for Project Title lines (e.g. RepoLens – AI Code Intelligence Platform Live | GitHub)
          if ((trimmed.includes("–") || trimmed.includes(" - ")) && trimmed.length < 90) {
            return (
              <div key={idx} className="font-semibold text-slate-900 text-xs md:text-sm pt-2.5 pb-0.5 flex items-center gap-2">
                <div className="w-1 h-3 rounded-full bg-blue-500" />
                <span>{renderTextWithCitations(trimmed)}</span>
              </div>
            );
          }

          // Standard paragraph line
          return (
            <p key={idx} className="text-slate-800 text-xs md:text-sm leading-relaxed">
              {renderTextWithCitations(trimmed)}
            </p>
          );
        })}
      </div>
    );
  };

  const renderMessageContent = (msg: MessageItem) => {
    if (msg.role === "user") {
      return (
        <div className="text-xs md:text-sm leading-relaxed font-normal whitespace-pre-wrap">
          {msg.content}
        </div>
      );
    }

    const citations = msg.citations || [];

    return (
      <div className="space-y-3 font-sans">
        {/* Abstention Safe Mode Banner if withheld */}
        {msg.abstained && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <div className="text-xs leading-relaxed">
              <span className="font-semibold block text-amber-800">
                Zero-Hallucination Safe Mode Engaged
              </span>
              Answer was withheld because accessible documents did not provide verifiable evidence.
            </div>
          </div>
        )}

        {/* Beautiful Formatted Body with Citations and Highlighting */}
        {renderFormattedBody(msg.content, citations)}

        {/* Clean Perplexity-Style Source Pills */}
        {citations.length > 0 && (
          <div className="pt-3 mt-3 border-t border-slate-100">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-blue-700">
                <Bookmark className="w-3.5 h-3.5" />
                <span>Verified Sources ({citations.length})</span>
              </span>
              <span className="text-slate-400 text-[10px]">Click source to inspect exact passage</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {citations.map((c) => (
                <button
                  key={c.citation_number}
                  onClick={() => onSelectCitation(c)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200/90 hover:border-blue-300 text-xs text-slate-700 hover:text-blue-700 transition-all cursor-pointer shadow-2xs group"
                >
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white font-mono text-[9px] font-bold flex items-center justify-center shrink-0">
                    {c.citation_number}
                  </span>
                  <span className="font-medium truncate max-w-[180px]">{c.document_title}</span>
                  <span className="text-[10px] text-slate-400 font-mono">P.{c.page_number || 1}</span>
                  <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-blue-600 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-white font-sans">
      {/* Historical Conversations Sub-Sidebar */}
      <div className="w-60 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0">
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <span>Chat Sessions</span>
          </span>
          <button
            onClick={handleNewChat}
            className="p-1 rounded-lg hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            title="Start New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">No previous chats.</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                className={`flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer group transition-all ${
                  currentConversation?.id === conv.id
                    ? "bg-white text-blue-700 font-semibold shadow-xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <div className="truncate flex-1 mr-2 text-xs">{conv.title}</div>
                <button
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-600 transition-opacity cursor-pointer"
                  title="Delete Conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full bg-slate-50 relative">
        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-5">
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto my-12 text-center space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white mx-auto shadow-sm shadow-blue-500/20">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  How can Enterprise Brain help you today?
                </h2>
                <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
                  Ask natural-language questions grounded in accessible company policies. Answers feature verifiable citations and safe abstention.
                </p>
              </div>

              {/* Suggested Questions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left pt-2">
                {SUGGESTED_QUERIES.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(item.query)}
                    className="p-3.5 rounded-xl bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 text-left transition-all group flex flex-col justify-between shadow-xs cursor-pointer"
                  >
                    <div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 uppercase">
                        {item.tag}
                      </span>
                      <p className="text-xs font-medium text-slate-800 mt-2 group-hover:text-blue-700 transition-colors">
                        {item.query}
                      </p>
                    </div>
                    <div className="mt-2.5 flex items-center justify-end text-xs text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="w-full">
                {msg.role === "user" ? (
                  <div className="flex flex-col items-end max-w-xl ml-auto mb-3 group">
                    <div className="px-4 py-2.5 rounded-2xl rounded-tr-xs bg-blue-600 text-white shadow-xs text-xs md:text-sm leading-relaxed font-normal">
                      {msg.content}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 mr-1">
                      <span>{activeUser.name.split("(")[0].trim()}</span>
                      <span>•</span>
                      <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 max-w-3xl mr-auto mb-5 w-full">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-xs">
                      <Sparkles className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0 bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs text-slate-800">
                      {/* Assistant Card Header */}
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 text-[11px] text-slate-400">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 text-xs">
                            Enterprise Brain
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            <span>Verified Grounded</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <button
                            onClick={() => handleCopy(msg.id, msg.content)}
                            className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            title="Copy Answer"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {renderMessageContent(msg)}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-3 max-w-xl mr-auto mb-4">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs text-slate-600 text-xs flex items-center gap-2.5">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>Searching accessible documents and verifying citations...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} className="h-8 shrink-0" />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-slate-200 shrink-0 z-10">
          <div className="max-w-3xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="relative flex items-center bg-white border border-slate-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 rounded-2xl p-1.5 shadow-xs transition-all"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Ask a question grounded in accessible documents as ${activeUser.name.split('(')[0].trim()}...`}
                className="w-full bg-transparent pl-3 pr-10 py-2.5 text-xs md:text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !inputText.trim()}
                className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 px-1">
              <span>All answers require verifiable citations from authorized documents</span>
              <span className="text-blue-600 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-blue-600" />
                Pre-retrieval SQL RBAC Active
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
