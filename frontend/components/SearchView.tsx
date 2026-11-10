"use client";

import React, { useState } from "react";
import {
  Search,
  SlidersHorizontal,
  Database,
  Type,
  Layers,
  Bookmark,
  Sparkles,
  ShieldCheck,
  Filter
} from "lucide-react";
import { api } from "@/lib/api";
import { SearchResultItem, Citation } from "@/lib/types";

interface SearchViewProps {
  onSelectCitation: (citation: Citation) => void;
  activeUser: { email: string; role: "admin" | "member"; name: string };
  onStartChatWithChunk?: (query: string) => void;
}

const PRESET_QUERIES = [
  { label: "Expense Deadline", query: "reimbursement deadline 30 days" },
  { label: "Kubernetes Canary", query: "Kubernetes automated canary deployments" },
  { label: "AES-256 Encryption", query: "AES-256 encryption at rest TLS 1.3" },
  { label: "Executive Leave (RBAC)", query: "confidential executive sabbatical" },
];

export const SearchView: React.FC<SearchViewProps> = ({
  onSelectCitation,
  activeUser,
  onStartChatWithChunk,
}) => {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"hybrid" | "vector" | "keyword">("hybrid");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedDocFilter, setSelectedDocFilter] = useState<string>("all");

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string) => {
    if (e) e.preventDefault();
    const q = (overrideQuery !== undefined ? overrideQuery : query).trim();
    if (!q) return;

    if (overrideQuery !== undefined) {
      setQuery(overrideQuery);
    }

    setLoading(true);
    setSearched(true);
    try {
      const res = await api.search(q, { mode, limit: 10 });
      setResults(res.results);
    } catch (err: any) {
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

  const documentTitles = Array.from(new Set(results.map((r) => r.document_title)));

  const filteredResults = selectedDocFilter === "all"
    ? results
    : results.filter((r) => r.document_title === selectedDocFilter);

  const renderHighlightedContent = (text: string, currentQuery: string) => {
    const terms = currentQuery
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3);

    if (terms.length === 0) return text;

    const regex = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-100 text-yellow-900 px-0.5 rounded font-medium">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50 font-sans">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Hybrid Knowledge Search</span>
            <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              RRF + pgvector
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Search document passages using dense vector embeddings and full-text keywords filtered server-side by your active identity clearance.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Clearance: </span>
          <span className="font-semibold text-slate-900 capitalize">{activeUser.role}</span>
        </div>
      </div>

      {/* Search Input Bar & Strategy Controls */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3.5 shadow-xs">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search enterprise policies, architecture specs, or roadmap milestones..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all shadow-inner"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold transition-all shadow-xs shrink-0 cursor-pointer"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>Suggested:</span>
          </span>
          {PRESET_QUERIES.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSearch(undefined, p.query)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-700 text-xs transition-colors cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Strategy Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-slate-500">
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
            <span>Strategy:</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setMode("hybrid")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                mode === "hybrid"
                  ? "bg-white text-blue-700 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Hybrid (RRF)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("vector")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                mode === "vector"
                  ? "bg-white text-blue-700 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Vector Semantic</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("keyword")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                mode === "keyword"
                  ? "bg-white text-blue-700 shadow-xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Keyword FTS</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results Header */}
      {searched && results.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="text-slate-500">
            Found <span className="font-semibold text-slate-900">{filteredResults.length}</span> ranked passages
          </div>

          {documentTitles.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedDocFilter}
                onChange={(e) => setSelectedDocFilter(e.target.value)}
                className="bg-white border border-slate-200 text-xs text-slate-700 rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-600"
              >
                <option value="all">All Documents ({results.length})</option>
                {documentTitles.map((t) => (
                  <option key={t} value={t}>
                    {t} ({results.filter((r) => r.document_title === t).length})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Results List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-500 space-y-2">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>Searching authorized knowledge documents...</p>
          </div>
        ) : searched && filteredResults.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500 bg-white rounded-2xl border border-slate-200">
            No matching document passages found within accessible documents for your identity ({activeUser.role}).
          </div>
        ) : (
          filteredResults.map((hit, idx) => (
            <div
              key={hit.chunk_id}
              className="p-4 bg-white hover:bg-slate-50/50 border border-slate-200 rounded-2xl transition-all space-y-3 shadow-xs group"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 font-mono text-[10px] flex items-center justify-center font-bold shrink-0">
                      #{idx + 1}
                    </span>
                    <h3 className="text-xs font-bold text-slate-900 truncate">
                      {hit.document_title}
                    </h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase shrink-0 ${
                        hit.access_level === "private"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {hit.access_level}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-mono">
                    <span>Page {hit.page_number || "1"}</span>
                    {hit.section_title && (
                      <>
                        <span>•</span>
                        <span className="text-blue-700">{hit.section_title}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Score Pill */}
                <div className="flex items-center gap-2 shrink-0 text-xs font-mono">
                  <div className="px-2 py-1 bg-slate-100 rounded-lg text-slate-700">
                    RRF: <span className="font-bold text-blue-700">{hit.combined_rrf_score.toFixed(4)}</span>
                  </div>
                  <div className="px-2 py-1 bg-slate-100 rounded-lg text-slate-700">
                    Sim: <span className="font-bold text-emerald-700">{(hit.similarity_score * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              {/* Snippet */}
              <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                {renderHighlightedContent(hit.content, query)}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                <span>Chunk ID: {hit.chunk_id.slice(0, 16)}...</span>
                <button
                  onClick={() => openCitationForHit(hit, idx)}
                  className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium transition-colors cursor-pointer"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Inspect as Evidence</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
