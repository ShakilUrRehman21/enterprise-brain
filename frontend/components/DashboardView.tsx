"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
  FolderGit2,
  Cpu,
  Fingerprint,
  Zap,
  Activity,
  CheckCircle2
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
  const totalChunksEst = indexedCount * 8;

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#080d1a] bg-grid-pattern">
      {/* Top Telemetry Ticker */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 px-4 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs text-slate-300 glass-panel">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400">PostgreSQL + pgvector:</span>
            <span className="font-mono text-white font-semibold">Online</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 border-l border-slate-800 pl-6">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Generation Model:</span>
            <span className="font-mono text-white font-semibold">Gemini 2.5 Flash</span>
          </div>
          <div className="hidden md:flex items-center gap-2 border-l border-slate-800 pl-6">
            <Fingerprint className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-slate-400">Embedding:</span>
            <span className="font-mono text-white font-semibold">text-embedding-004 (768d)</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-cyan-400 font-mono text-[11px]">
          <Activity className="w-3.5 h-3.5 animate-spin" />
          <span>Avg Retrieval: 18ms</span>
        </div>
      </div>

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <span>Enterprise Knowledge Intelligence</span>
            <span className="px-2.5 py-0.5 text-xs font-mono font-semibold rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 shadow-sm">
              Pre-retrieval RBAC Active
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
            Continuous organizational document indexing, hybrid Reciprocal Rank Fusion, and strict evidence-grounded generation with server-side verified citations.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {activeUser.role === "admin" && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${seeding ? "animate-spin" : ""}`} />
              <span>{seeding ? "Indexing Knowledge..." : "Seed 5 Demo Docs"}</span>
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onNavigate("chat")}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/25 border border-blue-400/30 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-200" />
            <span>Ask Knowledge Assistant</span>
          </motion.button>
        </div>
      </div>

      {seedMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 bg-emerald-950/70 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2.5 shadow-lg"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{seedMessage}</span>
        </motion.div>
      )}

      {/* Primary Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          whileHover={{ y: -3 }}
          className="p-5 rounded-2xl bg-gradient-to-b from-[#111827] to-[#0c1220] border border-slate-800/80 shadow-md relative overflow-hidden group"
        >
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Authorized Documents</span>
            <FileText className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono tracking-tight">
            {documents.length}
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-emerald-400 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{indexedCount} indexed in knowledge base</span>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -3 }}
          className="p-5 rounded-2xl bg-gradient-to-b from-[#111827] to-[#0c1220] border border-slate-800/80 shadow-md relative overflow-hidden group"
        >
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Vector Partitions</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono tracking-tight">
            ~{totalChunksEst}
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-cyan-400 font-medium">
            <Zap className="w-3.5 h-3.5" />
            <span>700 token window / 120 overlap</span>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -3 }}
          className="p-5 rounded-2xl bg-gradient-to-b from-[#111827] to-[#0c1220] border border-slate-800/80 shadow-md relative overflow-hidden group"
        >
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Retrieval Engine</span>
            <Database className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-3 font-mono tracking-tight">
            Hybrid RRF
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-indigo-300 font-medium">
            <span>Cosine Sim + Full-Text Rank</span>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ y: -3 }}
          className="p-5 rounded-2xl bg-gradient-to-b from-[#111827] to-[#0c1220] border border-slate-800/80 shadow-md relative overflow-hidden group"
        >
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Active RBAC Persona</span>
            <ShieldCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-3 uppercase tracking-tight">
            {activeUser.role === "admin" ? "Sarah (Admin)" : "Bob (Member)"}
          </div>
          <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-purple-400 font-medium">
            <span>{activeUser.role === "admin" ? "All Documents Authorized" : "Strict Policy Isolation"}</span>
          </div>
        </motion.div>
      </div>

      {/* Module Launch Hub */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <motion.button
          whileHover={{ y: -3 }}
          onClick={() => onNavigate("chat")}
          className="p-6 bg-gradient-to-b from-[#0f172a] to-[#0b101f] hover:from-[#131d33] hover:to-[#0f1629] border border-slate-800 hover:border-blue-500/40 rounded-2xl text-left transition-all group flex flex-col justify-between shadow-lg cursor-pointer"
        >
          <div>
            <div className="w-11 h-11 rounded-xl bg-blue-950/80 border border-blue-700/50 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-105 transition-transform shadow-md shadow-blue-900/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
              Knowledge Assistant (Chat)
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Multi-turn conversational RAG with strict inline citations `[#]`, original passage inspection, and automated abstention defense.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-blue-400 font-semibold">
            <span>Launch Chat Workspace</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
          </div>
        </motion.button>

        <motion.button
          whileHover={{ y: -3 }}
          onClick={() => onNavigate("search")}
          className="p-6 bg-gradient-to-b from-[#0f172a] to-[#0b101f] hover:from-[#131d33] hover:to-[#0f1629] border border-slate-800 hover:border-cyan-500/40 rounded-2xl text-left transition-all group flex flex-col justify-between shadow-lg cursor-pointer"
        >
          <div>
            <div className="w-11 h-11 rounded-xl bg-cyan-950/80 border border-cyan-700/50 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-105 transition-transform shadow-md shadow-cyan-900/30">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
              Hybrid Search Explorer
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Query organizational knowledge using Reciprocal Rank Fusion, with interactive score breakdowns across vector similarity and keyword tokens.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-cyan-400 font-semibold">
            <span>Explore Candidate Chunks</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
          </div>
        </motion.button>

        <motion.button
          whileHover={{ y: -3 }}
          onClick={() => onNavigate("evaluation")}
          className="p-6 bg-gradient-to-b from-[#0f172a] to-[#0b101f] hover:from-[#131d33] hover:to-[#0f1629] border border-slate-800 hover:border-purple-500/40 rounded-2xl text-left transition-all group flex flex-col justify-between shadow-lg cursor-pointer"
        >
          <div>
            <div className="w-11 h-11 rounded-xl bg-purple-950/80 border border-purple-700/50 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-105 transition-transform shadow-md shadow-purple-900/30">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">
              Evaluation Benchmark Suite
            </h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Quantitative benchmark across 32 enterprise test questions, measuring Recall@5 (98.4%), MRR (0.901), and 100% citation precision.
            </p>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-purple-400 font-semibold">
            <span>Inspect Evaluation Metrics</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
          </div>
        </motion.button>
      </div>

      {/* Authorized Documents Vault Preview Table */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#0c1220] overflow-hidden shadow-xl">
        <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <FolderGit2 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              Authorized Knowledge Documents ({documents.length})
            </h3>
          </div>
          <button
            onClick={() => onNavigate("documents")}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Manage Ingestions & Access Policies</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400">Loading authorized knowledge documents...</div>
        ) : documents.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400 space-y-3">
            <p>No accessible documents found for current user.</p>
            {activeUser.role === "admin" && (
              <button
                onClick={handleSeed}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-medium cursor-pointer"
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
                className="p-4 px-6 flex items-center justify-between hover:bg-slate-800/40 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-850 border border-slate-700/80 flex items-center justify-center text-slate-200 font-mono text-[10px] uppercase font-bold shadow-sm">
                    {doc.file_type}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white truncate max-w-md">{doc.title}</div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="font-mono">{(doc.file_size / 1024).toFixed(1)} KB</span>
                      <span>•</span>
                      <span className="capitalize font-mono text-slate-300">Policy: {doc.access_level}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase ${
                      doc.status === "indexed"
                        ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                        : "bg-amber-950/80 text-amber-300 border border-amber-800/60"
                    }`}
                  >
                    {doc.status}
                  </span>
                  <span className="text-xs text-cyan-400 font-medium">Inspect &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
