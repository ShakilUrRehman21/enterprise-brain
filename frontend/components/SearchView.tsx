"use client";

import React, { useState } from "react";
import { Search, SlidersHorizontal, Database, Type, Layers, ExternalLink, Bookmark } from "lucide-react";
import { api } from "@/lib/api";
import { SearchResultItem, Citation } from "@/lib/types";

interface SearchViewProps {
  onSelectCitation: (citation: Citation) => void;
  activeUser: { email: string; role: "admin" | "member"; name: string };
}

export const SearchView: React.FC<SearchViewProps> = ({
  onSelectCitation,
  activeUser,
}) => {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"hybrid" | "vector" | "keyword">("hybrid");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    try {
      const res = await api.search(query.trim(), { mode, limit: 10 });
      setResults(res.results);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const openCitationForHit = (hit: SearchResultItem, idx: number) => {
    const cit: Citation = {
      citation_number: idx + 1,
      document_id: hit.document_id,
      document_title: hit.document_title,
      page_number: hit.page_number,
      section_title: hit.section_title,
      chunk_id: hit.chunk_id,
      exact_passage: hit.content,
    };
    onSelectCitation(cit);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#0b0f17]">
      {/* Header */}
      <div className="pb-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <span>Hybrid Knowledge Search Explorer</span>
          <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60 uppercase">
            Reciprocal Rank Fusion
          </span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Explore chunk similarity across pgvector vector distances, PostgreSQL full-text keyword scores, and server-side RBAC filters.
        </p>
      </div>

      {/* Search Input Bar & Controls */}
      <div className="p-4 bg-[#0f172a] rounded-2xl border border-slate-800 space-y-4 shadow-lg">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search policies, technical guidelines, or keywords (e.g. 'reimbursement deadline', 'Kubernetes canary', 'MFA')..."
              className="w-full bg-slate-900 border border-slate-700/80 focus:border-cyan-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-xs font-medium transition-colors shadow-md shadow-blue-600/20 shrink-0"
          >
            {loading ? "Searching..." : "Search Knowledge"}
          </button>
        </form>

        {/* Mode Selector */}
        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2 text-slate-400">
            <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-medium">Retrieval Scoring Strategy:</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setMode("hybrid")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                mode === "hybrid"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Hybrid (RRF)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("vector")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                mode === "vector"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Database className="w-3 h-3" />
              <span>Vector Similarity</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("keyword")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                mode === "keyword"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Type className="w-3 h-3" />
              <span>Keyword / FTS</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Searching permission-filtered knowledge base...</p>
          </div>
        ) : searched && results.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-[#0f172a] rounded-xl border border-slate-800">
            No matching document chunks found within accessible documents for your identity ({activeUser.role}).
          </div>
        ) : (
          results.map((hit, idx) => (
            <div
              key={hit.chunk_id}
              className="p-5 bg-[#0f172a] hover:bg-[#131d33] border border-slate-800 rounded-xl transition-colors space-y-3 shadow-sm"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-cyan-950 text-cyan-400 font-mono text-[10px] flex items-center justify-center font-bold border border-cyan-900">
                      #{idx + 1}
                    </span>
                    <h3 className="text-xs font-semibold text-white truncate max-w-lg">
                      {hit.document_title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                    <span>Page {hit.page_number || "1"}</span>
                    {hit.section_title && (
                      <>
                        <span>•</span>
                        <span className="text-slate-300 font-mono text-[10px]">{hit.section_title}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Score Pills */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 flex items-center gap-1">
                    <span className="text-slate-400">RRF:</span>
                    <span className="text-cyan-400 font-bold">{hit.combined_rrf_score.toFixed(4)}</span>
                  </div>
                  <div className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 flex items-center gap-1">
                    <span className="text-slate-400">Sim:</span>
                    <span className="text-emerald-400">{hit.similarity_score.toFixed(3)}</span>
                  </div>
                  <div className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 flex items-center gap-1">
                    <span className="text-slate-400">Kw:</span>
                    <span className="text-blue-400">{hit.keyword_score.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              {/* Chunk Content Snippet */}
              <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                {hit.content}
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                <span className="font-mono text-[10px]">Chunk ID: {hit.chunk_id.slice(0, 16)}...</span>
                <button
                  onClick={() => openCitationForHit(hit, idx)}
                  className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Inspect as Verified Passage</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
