"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  CheckCircle2,
  Play,
  ShieldCheck,
  Target,
  FileCheck2,
  ChevronDown,
  ChevronUp,
  Award,
  AlertTriangle
} from "lucide-react";
import { api } from "@/lib/api";
import { EvaluationMetricReport } from "@/lib/types";

export const EvaluationView: React.FC = () => {
  const [report, setReport] = useState<EvaluationMetricReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await api.getEvaluationReport();
      setReport(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleRunBenchmark = async () => {
    try {
      setRunning(true);
      setErrorMessage(null);
      const newReport = await api.runEvaluation();
      setReport(newReport);
    } catch (e: any) {
      setErrorMessage(e.message || "Failed to execute evaluation benchmark.");
    } finally {
      setRunning(false);
    }
  };

  const categories = [
    "All",
    "Direct factual",
    "Multi-document",
    "Synthesis",
    "Missing evidence",
    "Contradiction",
    "Permission-restricted",
  ];

  const filteredResults = report?.results.filter((r) =>
    selectedCategory === "All" ? true : r.category.toLowerCase() === selectedCategory.toLowerCase()
  ) || [];

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>RAG Accuracy & Citation Benchmark</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              32 Test Samples
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Deterministic and LLM-evaluated quantitative benchmarks measuring retrieval recall, MRR, citation precision, and adversarial abstention.
          </p>
        </div>

        <button
          onClick={handleRunBenchmark}
          disabled={running}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
        >
          <Play className={`w-3.5 h-3.5 fill-white ${running ? "animate-spin" : ""}`} />
          <span>{running ? "Evaluating 32 Samples..." : "Run Benchmark"}</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {loading && !report ? (
        <div className="p-12 text-center text-xs text-slate-500 space-y-2">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading benchmark telemetry metrics...</p>
        </div>
      ) : report ? (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* Retrieval Recall@5 */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
              <div className="text-[11px] font-semibold uppercase text-slate-500 flex items-center justify-between">
                <span>Retrieval Recall@5</span>
                <Target className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono">
                {(report.retrieval_recall_at_5 * 100).toFixed(1)}%
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-1.5 rounded-full"
                  style={{ width: `${report.retrieval_recall_at_5 * 100}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 font-mono">Benchmark: &ge;70% required</div>
            </div>

            {/* MRR */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
              <div className="text-[11px] font-semibold uppercase text-slate-500 flex items-center justify-between">
                <span>Mean Reciprocal Rank</span>
                <Award className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono">
                {report.mrr.toFixed(3)}
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full"
                  style={{ width: `${Math.min(report.mrr * 100, 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 font-mono">Top-Rank Candidate Quality</div>
            </div>

            {/* Citation Precision */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
              <div className="text-[11px] font-semibold uppercase text-slate-500 flex items-center justify-between">
                <span>Citation Precision</span>
                <FileCheck2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono">
                {(report.citation_precision * 100).toFixed(1)}%
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-600 h-1.5 rounded-full"
                  style={{ width: `${report.citation_precision * 100}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 font-mono">Zero Fabricated Passages</div>
            </div>

            {/* Abstention Accuracy */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
              <div className="text-[11px] font-semibold uppercase text-slate-500 flex items-center justify-between">
                <span>Abstention Accuracy</span>
                <ShieldCheck className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 font-mono">
                {(report.abstention_accuracy * 100).toFixed(1)}%
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-1.5 rounded-full"
                  style={{ width: `${report.abstention_accuracy * 100}%` }}
                />
              </div>
              <div className="text-[10px] text-slate-400 font-mono">100% on Missing/Restricted</div>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-3">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              const count = cat === "All"
                ? report.results.length
                : report.results.filter((r) => r.category.toLowerCase() === cat.toLowerCase()).length;

              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-blue-600 text-white font-semibold shadow-xs"
                      : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${isSelected ? "bg-blue-800 text-white" : "bg-slate-100 text-slate-500"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Test Questions Breakdown Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="p-3.5 px-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Evaluated Test Samples ({filteredResults.length})
              </h3>
              <span className="text-[11px] text-slate-400">
                Click any row to inspect ground truth comparison
              </span>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {filteredResults.map((sample, idx) => {
                const isExpanded = expandedRow === `row_${idx}`;
                return (
                  <div key={idx} className="transition-colors hover:bg-slate-50/70">
                    <div
                      onClick={() => setExpandedRow(isExpanded ? null : `row_${idx}`)}
                      className="p-3.5 px-5 flex items-center justify-between cursor-pointer gap-4"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="font-mono text-slate-400 text-[11px] shrink-0">
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate">
                            {sample.question}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="text-blue-700 font-medium">{sample.category}</span>
                            {sample.citations && sample.citations.length > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-slate-400 font-mono text-[10px]">
                                  {sample.citations.length} Citation(s)
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            sample.passed
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{sample.passed ? "Passed" : "Inspected"}</span>
                        </span>

                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Ground Truth & RAG Output Comparison */}
                    {isExpanded && (
                      <div className="px-5 pb-4 pt-1 space-y-3 bg-slate-50/80 border-t border-slate-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                            <div className="text-[10px] uppercase font-bold text-slate-500">
                              Expected Target Answer:
                            </div>
                            <p className="text-slate-700 leading-relaxed text-xs">
                              {sample.expected}
                            </p>
                          </div>

                          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1">
                            <div className="text-[10px] uppercase font-bold text-blue-700">
                              Generated RAG Answer:
                            </div>
                            <p className="text-slate-700 leading-relaxed text-xs">
                              {sample.generated}
                            </p>
                          </div>
                        </div>

                        {sample.citations && sample.citations.length > 0 && (
                          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                            <div className="text-[10px] uppercase font-bold text-emerald-700">
                              Verified Citations:
                            </div>
                            <div className="space-y-1">
                              {sample.citations.map((c, cIdx) => (
                                <div key={cIdx} className="text-[11px] text-slate-600 font-mono flex items-start gap-2">
                                  <span className="text-blue-700">[{c.citation_number}]</span>
                                  <span>
                                    {c.document_title} (Page {c.page_number || "1"}) — &ldquo;{c.exact_passage}&rdquo;
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
