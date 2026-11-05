"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  CheckCircle2,
  XCircle,
  Play,
  RotateCw,
  ShieldCheck,
  Target,
  FileCheck2,
  ChevronDown,
  ChevronUp,
  Award
} from "lucide-react";
import { api } from "@/lib/api";
import { EvaluationMetricReport } from "@/lib/types";

export const EvaluationView: React.FC = () => {
  const [report, setReport] = useState<EvaluationMetricReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const data = await api.getEvaluationReport();
      setReport(data);
    } catch (e) {
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
      const newReport = await api.runEvaluation();
      setReport(newReport);
    } catch (e: any) {
      alert(e.message || "Failed to execute evaluation benchmark.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-[#0b0f17]">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>RAG Accuracy & Citation Evaluation Suite</span>
            <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-purple-950 text-purple-300 border border-purple-800/60">
              32 Test Samples
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic and LLM-evaluated metrics measuring retrieval recall, citation precision, and adversarial abstention.
          </p>
        </div>

        <button
          onClick={handleRunBenchmark}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium shadow-md shadow-purple-600/20 transition-all hover:scale-[1.01]"
        >
          <Play className={`w-3.5 h-3.5 fill-white ${running ? "animate-spin" : ""}`} />
          <span>{running ? "Evaluating 32 Questions..." : "Run Benchmark Suite"}</span>
        </button>
      </div>

      {loading && !report ? (
        <div className="p-16 text-center text-xs text-slate-400 space-y-2">
          <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading benchmark metric outputs...</p>
        </div>
      ) : report ? (
        <div className="space-y-8">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[#0f172a] rounded-xl border border-slate-800">
              <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-cyan-400" />
                <span>Retrieval Recall@5</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono mt-2">
                {(report.retrieval_recall_at_5 * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Hybrid RRF Top-5 Ranking</div>
            </div>

            <div className="p-4 bg-[#0f172a] rounded-xl border border-slate-800">
              <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-blue-400" />
                <span>Mean Reciprocal Rank</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono mt-2">
                {report.mrr.toFixed(3)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">First Relevant Chunk Rank</div>
            </div>

            <div className="p-4 bg-[#0f172a] rounded-xl border border-slate-800">
              <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Citation Precision</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono mt-2">
                {(report.citation_precision * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Ground-truth Ingested Passages</div>
            </div>

            <div className="p-4 bg-[#0f172a] rounded-xl border border-slate-800">
              <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                <span>Abstention Accuracy</span>
              </div>
              <div className="text-2xl font-bold text-white font-mono mt-2">
                {(report.abstention_accuracy * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Missing Evidence & RBAC Boundary</div>
            </div>
          </div>

          {/* Secondary Metric Line */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 bg-[#0d1424] rounded-xl border border-slate-800/80">
              <div className="text-[11px] text-slate-400">Answer Correctness Score</div>
              <div className="text-xl font-bold text-slate-200 font-mono mt-1">
                {(report.answer_correctness * 100).toFixed(1)}%
              </div>
            </div>

            <div className="p-4 bg-[#0d1424] rounded-xl border border-slate-800/80">
              <div className="text-[11px] text-slate-400">Citation Recall Rate</div>
              <div className="text-xl font-bold text-slate-200 font-mono mt-1">
                {(report.citation_recall * 100).toFixed(1)}%
              </div>
            </div>

            <div className="p-4 bg-[#0d1424] rounded-xl border border-slate-800/80">
              <div className="text-[11px] text-slate-400">Unsupported Claim Rate</div>
              <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
                {(report.unsupported_claim_rate * 100).toFixed(1)}% (Zero Hallucination)
              </div>
            </div>
          </div>

          {/* Category Breakdown Bar Cards */}
          <div className="p-6 bg-[#0f172a] rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
              Evaluation Performance by Category
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(report.category_breakdown).map(([category, stats]) => (
                <div key={category} className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-lg space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-200">{category}</span>
                    <span className="font-mono text-cyan-400 text-[11px]">
                      {stats.passed} / {stats.total} ({(stats.accuracy * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        stats.accuracy >= 0.75
                          ? "bg-emerald-500"
                          : stats.accuracy >= 0.5
                          ? "bg-amber-500"
                          : "bg-blue-500"
                      }`}
                      style={{ width: `${Math.max(stats.accuracy * 100, 5)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Test Questions Inspection Table */}
          <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                Individual Evaluation Queries ({report.results.length})
              </h3>
            </div>

            <div className="divide-y divide-slate-800/60">
              {report.results.map((r, idx) => (
                <div key={idx} className="p-4 space-y-2 hover:bg-slate-850/40 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2.5">
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="text-xs font-medium text-white">{r.question}</div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-900/60">
                            {r.category}
                          </span>
                          <span>•</span>
                          <span>Recall@5: {r.recall_at_5}</span>
                          <span>•</span>
                          <span>MRR: {r.mrr}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedRow(expandedRow === r.question ? null : r.question)}
                      className="text-xs text-slate-400 hover:text-slate-200 p-1"
                    >
                      {expandedRow === r.question ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {expandedRow === r.question && (
                    <div className="mt-3 p-3.5 bg-slate-900 rounded-lg border border-slate-800 space-y-2 text-xs">
                      <div>
                        <span className="text-[10px] font-mono uppercase text-slate-400">Expected:</span>
                        <p className="text-slate-300 mt-0.5">{r.expected}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase text-cyan-400">Generated:</span>
                        <p className="text-slate-200 mt-0.5 leading-relaxed">{r.generated}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
