"use client";

import React, { useEffect, useState } from "react";
import {
  FileText,
  Layers,
  Sparkles,
  Search,
  Upload,
  BarChart3,
  CheckCircle,
  Database,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  FolderGit2
} from "lucide-react";
import { api } from "@/lib/api";
import { DocumentItem } from "@/lib/types";

interface DashboardViewProps {
  onNavigate: (view: "chat" | "search" | "documents" | "evaluation") => void;
  onSelectDocument: (docId: string) => void;
  activeUser: { email: string; role: "admin" | "member"; name: string };
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onSelectDocument,
  activeUser,
}) => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [activeUser]);

  const handleSeed = async () => {
    try {
      setSeeding(true);
      const res = await api.seedDemoData();
      setSeedMessage(res.message);
      await fetchDashboardData();
      setTimeout(() => setSeedMessage(null), 5000);
    } catch (e: any) {
      setSeedMessage(e.message || "Failed to seed demo data");
    } finally {
      setSeeding(false);
    }
  };

  const indexedCount = documents.filter((d) => d.status === "indexed").length;
  const totalChunksEst = indexedCount * 8; // average ~8 chunks per standard doc

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#0b0f17]">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <span>Enterprise Knowledge Intelligence</span>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
              v1.0.0
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Permission-enforced semantic retrieval, verifiable citations, and multi-document synthesis.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeUser.role === "admin" && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${seeding ? "animate-spin" : ""}`} />
              <span>{seeding ? "Indexing..." : "Seed 5 Demo Docs"}</span>
            </button>
          )}

          <button
            onClick={() => onNavigate("chat")}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium shadow-md shadow-blue-600/20 transition-all hover:scale-[1.01]"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask Knowledge Assistant</span>
          </button>
        </div>
      </div>

      {seedMessage && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{seedMessage}</span>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 bg-[#0f172a] rounded-xl border border-slate-800/80 shadow-sm relative overflow-hidden">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Authorized Documents</div>
          <div className="text-2xl font-bold text-white mt-2 font-mono">{documents.length}</div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{indexedCount} indexed & ready</span>
          </div>
          <FileText className="w-16 h-16 text-slate-800/30 absolute -right-2 -bottom-2 pointer-events-none" />
        </div>

        <div className="p-5 bg-[#0f172a] rounded-xl border border-slate-800/80 shadow-sm relative overflow-hidden">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Knowledge Chunks</div>
          <div className="text-2xl font-bold text-white mt-2 font-mono">~{totalChunksEst}</div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-cyan-400">
            <Layers className="w-3.5 h-3.5" />
            <span>700 tokens avg / 120 overlap</span>
          </div>
          <Layers className="w-16 h-16 text-slate-800/30 absolute -right-2 -bottom-2 pointer-events-none" />
        </div>

        <div className="p-5 bg-[#0f172a] rounded-xl border border-slate-800/80 shadow-sm relative overflow-hidden">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Vector Search Engine</div>
          <div className="text-2xl font-bold text-white mt-2 font-mono">pgvector</div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-blue-400">
            <Database className="w-3.5 h-3.5" />
            <span>768-dim Normalized Space</span>
          </div>
          <Database className="w-16 h-16 text-slate-800/30 absolute -right-2 -bottom-2 pointer-events-none" />
        </div>

        <div className="p-5 bg-[#0f172a] rounded-xl border border-slate-800/80 shadow-sm relative overflow-hidden">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active RBAC Policy</div>
          <div className="text-2xl font-bold text-white mt-2 uppercase text-sm">
            {activeUser.role === "admin" ? "Admin (Global)" : "Member (Restricted)"}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-purple-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Pre-retrieval SQL Enforcement</span>
          </div>
          <ShieldCheck className="w-16 h-16 text-slate-800/30 absolute -right-2 -bottom-2 pointer-events-none" />
        </div>
      </div>

      {/* Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => onNavigate("chat")}
          className="p-5 bg-[#10192b] hover:bg-[#142036] border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400 mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
              Conversational Knowledge Assistant
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Ask natural language questions with strict inline citations and zero unsupported hallucinations.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-blue-400 font-medium group-hover:translate-x-1 transition-transform">
            <span>Start Conversation</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>

        <button
          onClick={() => onNavigate("search")}
          className="p-5 bg-[#10192b] hover:bg-[#142036] border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-800/60 flex items-center justify-center text-cyan-400 mb-3">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
              Hybrid Search Explorer
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Query organizational documents using Reciprocal Rank Fusion combining pgvector cosine distance and keyword scores.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-cyan-400 font-medium group-hover:translate-x-1 transition-transform">
            <span>Explore Documents</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>

        <button
          onClick={() => onNavigate("evaluation")}
          className="p-5 bg-[#10192b] hover:bg-[#142036] border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400 mb-3">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-white group-hover:text-cyan-300 transition-colors">
              Evaluation Benchmark
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Verify Recall@5, MRR, citation precision, and adversarial abstention against 32 ground-truth test cases.
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-purple-400 font-medium group-hover:translate-x-1 transition-transform">
            <span>Inspect Benchmark</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>

      {/* Accessible Documents Table Preview */}
      <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Accessible Knowledge Documents ({documents.length})
            </h3>
          </div>
          <button
            onClick={() => onNavigate("documents")}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
          >
            <span>Manage All Documents</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading authorized documents...</div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 space-y-2">
            <p>No documents found for this account.</p>
            {activeUser.role === "admin" && (
              <button
                onClick={handleSeed}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium"
              >
                Seed 5 Demonstration Enterprise Documents
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {documents.slice(0, 5).map((doc) => (
              <div
                key={doc.id}
                onClick={() => {
                  onSelectDocument(doc.id);
                  onNavigate("documents");
                }}
                className="p-4 flex items-center justify-between hover:bg-slate-800/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700/60 flex items-center justify-center text-slate-300 font-mono text-[10px] uppercase font-bold">
                    {doc.file_type}
                  </div>
                  <div>
                    <div className="text-xs font-medium text-white truncate max-w-md">{doc.title}</div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                      <span>•</span>
                      <span className="capitalize">{doc.access_level}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                      doc.status === "indexed"
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
                        : "bg-amber-950 text-amber-400 border border-amber-800/50"
                    }`}
                  >
                    {doc.status}
                  </span>
                  <span className="text-xs text-slate-400">Inspect &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
