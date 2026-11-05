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
  HelpCircle,
  Clock,
  CheckCircle2,
  FileSearch
} from "lucide-react";
import { api } from "@/lib/api";
import { ConversationItem, MessageItem, Citation } from "@/lib/types";

interface ChatViewProps {
  onSelectCitation: (citation: Citation) => void;
  activeUser: { email: string; role: "admin" | "member"; name: string };
  initialConversationId?: string | null;
}

const SUGGESTED_QUERIES = [
  "What is the company's reimbursement deadline?",
  "Compare the security requirements in the architecture guide and compliance policy.",
  "What is the company's annual revenue in 2023? (Tests Abstention)",
  "What is the confidential HR leave policy?",
  "What database and protocol requirements are mandated for microservices?",
];

export const ChatView: React.FC<ChatViewProps> = ({
  onSelectCitation,
  activeUser,
  initialConversationId,
}) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
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
      const res = await api.sendMessage(currentConversation?.id || "", q);
      setMessages((prev) => [...prev, res.message]);
      if (!currentConversation) {
        await fetchConversations();
      }
    } catch (e: any) {
      const errorMsg: MessageItem = {
        id: `err_${Date.now()}`,
        conversation_id: currentConversation?.id || "",
        role: "assistant",
        content: `Error processing query: ${e.message || "Failed to connect to backend."}`,
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

  // Render assistant message with clickable citation badges
  const renderMessageContent = (msg: MessageItem) => {
    if (msg.role === "user") {
      return <div className="text-xs leading-relaxed text-slate-100 whitespace-pre-wrap">{msg.content}</div>;
    }

    const citations = msg.citations || [];
    const text = msg.content;

    // Split text by citations like [1], [2]
    const parts = text.split(/(\[\d+\])/g);

    return (
      <div className="space-y-3">
        <div className="text-xs leading-relaxed text-slate-200 whitespace-pre-wrap">
          {parts.map((part, index) => {
            const match = part.match(/\[(\d+)\]/);
            if (match) {
              const citNum = parseInt(match[1]);
              const matchingCit = citations.find((c) => c.citation_number === citNum);
              return (
                <button
                  key={index}
                  onClick={() => matchingCit && onSelectCitation(matchingCit)}
                  className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-400 border border-cyan-800/80 hover:bg-cyan-900 transition-colors shadow-sm cursor-pointer"
                  title={matchingCit ? `Inspect citation from ${matchingCit.document_title}` : "Citation"}
                >
                  [{citNum}]
                </button>
              );
            }
            return <span key={index}>{part}</span>;
          })}
        </div>

        {/* Citation Sources Footnote Card */}
        {citations.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-800/80">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Bookmark className="w-3 h-3 text-cyan-400" />
              <span>Verified Evidence Passages ({citations.length})</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {citations.map((c) => (
                <button
                  key={c.citation_number}
                  onClick={() => onSelectCitation(c)}
                  className="flex items-start gap-2 p-2 rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition-colors text-xs group"
                >
                  <span className="w-4 h-4 rounded bg-cyan-950 text-cyan-400 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5 border border-cyan-900 font-bold">
                    {c.citation_number}
                  </span>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-200 text-[11px] group-hover:text-cyan-300 transition-colors truncate">
                      {c.document_title}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      Page {c.page_number || "1"} • &ldquo;{c.exact_passage}&rdquo;
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-[#0b0f17]">
      {/* Conversations Sub-Sidebar */}
      <div className="w-64 border-r border-slate-800/80 bg-[#090e18] flex flex-col">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Conversations
          </span>
          <button
            onClick={handleNewChat}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            title="New Chat"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">No previous chats.</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv.id)}
                className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer group transition-colors ${
                  currentConversation?.id === conv.id
                    ? "bg-slate-800 text-cyan-300 font-medium border border-slate-700/60"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
                }`}
              >
                <div className="truncate flex-1 mr-2 text-[11px]">{conv.title}</div>
                <button
                  onClick={(e) => handleDeleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                  title="Delete Conversation"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Flow */}
      <div className="flex-1 flex flex-col h-full bg-[#0b0f17]">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto my-12 text-center space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center mx-auto shadow-xl shadow-blue-500/20">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Enterprise Brain Knowledge Chat</h2>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                  Ask questions across all indexed policies and guidelines. Answers are strictly grounded with real-time citations and abstain when evidence is missing.
                </p>
              </div>

              {/* Suggested Questions */}
              <div className="text-left space-y-2 max-w-lg mx-auto">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <HelpCircle className="w-3 h-3 text-cyan-400" />
                  <span>Suggested Inquiries</span>
                </div>
                <div className="space-y-1.5">
                  {SUGGESTED_QUERIES.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      className="w-full text-left p-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs transition-colors flex items-center justify-between group"
                    >
                      <span className="truncate">{q}</span>
                      <span className="text-[11px] text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Ask &rarr;
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${
                  msg.role === "user" ? "ml-auto justify-end" : "mr-auto"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 mt-0.5 shadow-md shadow-blue-600/30">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}

                <div
                  className={`p-4 rounded-2xl max-w-2xl border ${
                    msg.role === "user"
                      ? "bg-blue-600 border-blue-500/40 text-white rounded-br-none shadow-sm"
                      : "bg-[#0f172a] border-slate-800 text-slate-200 rounded-bl-none shadow-md"
                  }`}
                >
                  {renderMessageContent(msg)}

                  {msg.role === "assistant" && (
                    <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                      {msg.abstained ? (
                        <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                          <ShieldAlert className="w-3 h-3" />
                          <span>ABSTAINED (INSUFFICIENT EVIDENCE)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>GROUNDED EVIDENCE CITATION</span>
                        </span>
                      )}
                      <span>•</span>
                      <span>Verified Server-side</span>
                    </div>
                  )}
                </div>

                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <UserIcon className="w-4 h-4 text-slate-300" />
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (
            <div className="flex gap-3 max-w-xl mr-auto">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 animate-pulse">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 rounded-bl-none flex items-center gap-2 text-xs text-slate-400 font-mono">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>Searching knowledge base & synthesizing grounded response...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Composer Box */}
        <div className="p-4 border-t border-slate-800 bg-[#0c121d]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 max-w-4xl mx-auto"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask anything about enterprise documents, policies, or architecture..."
              className="flex-1 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-4 py-3 text-xs text-white placeholder-slate-400 focus:outline-none transition-colors shadow-inner"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || loading}
              className="p-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl transition-all shadow-md shadow-blue-600/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="text-[10px] text-center text-slate-400 mt-2 font-mono">
            Ground-truth enterprise RAG • Server-side permission filtration active
          </div>
        </div>
      </div>
    </div>
  );
};
