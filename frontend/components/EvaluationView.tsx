"use client";

import { ChevronDown } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { EvaluationRow, EvaluationRun } from "@/lib/types";
import { Button, Notice, PageHeader, Spinner, cx, relativeTime } from "./ui";

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "n/a" : `${Math.round(v * 100)}%`);

const METRICS: { key: keyof EvaluationRun["summary"]; label: string; help: string; invert?: boolean }[] = [
  { key: "fact_recall", label: "Key facts found", help: "Share of required facts that appear in answers." },
  { key: "citation_precision", label: "Citations on target", help: "Cited documents that are actually relevant." },
  { key: "recall_at_5", label: "Right document retrieved", help: "Relevant documents found in the top 5 results." },
  { key: "abstention_accuracy", label: "Correctly declined", help: "Unanswerable questions the assistant refused." },
  { key: "false_abstention_rate", label: "Wrongly declined", help: "Answerable questions it refused. Lower is better.", invert: true },
];

export function EvaluationView() {
  const [run, setRun] = useState<EvaluationRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("All");
  const [onlyFailures, setOnlyFailures] = useState(false);

  useEffect(() => {
    api
      .latestEvaluation()
      .then(setRun)
      .catch((e: ApiError) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const start = async () => {
    setRunning(true);
    setError(null);
    try {
      setRun(await api.runEvaluation());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The benchmark failed to run.");
    } finally {
      setRunning(false);
    }
  };

  const rows = useMemo(
    () =>
      (run?.results || []).filter((r) => (category === "All" || r.category === category) && (!onlyFailures || !r.passed)),
    [run, category, onlyFailures],
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        title="Answer quality"
        description="A fixed set of questions about the sample documents, including ones that must be declined and ones a member isn't allowed to see. Run it after changing models or settings."
        actions={
          <Button variant="primary" onClick={start} busy={running}>
            {run ? "Run again" : "Run benchmark"}
          </Button>
        }
      />

      {error && <Notice tone="error" className="mt-5">{error}</Notice>}
      {loading && (
        <div className="mt-12 flex justify-center text-graphite">
          <Spinner />
        </div>
      )}
      {!loading && !run && !error && (
        <p className="mt-8 text-graphite">No results yet. Add the sample documents, then run the benchmark.</p>
      )}

      {run && (
        <>
          <section className="mt-8 grid gap-8 md:grid-cols-[minmax(0,15rem)_1fr]">
            <div>
              <p className="text-sm text-graphite">Questions passed</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">
                {run.summary.passed}
                <span className="text-xl text-faint"> / {run.summary.total}</span>
              </p>
              <p className={cx("mt-3 text-sm", run.summary.leaks ? "font-medium text-danger" : "text-ok")}>
                {run.summary.leaks
                  ? `${run.summary.leaks} restricted document leak${run.summary.leaks === 1 ? "" : "s"}`
                  : "No restricted documents leaked"}
              </p>
              <p className="mt-1 text-xs text-faint">
                {run.engine === "gemini" ? "Gemini answers" : "Offline quoted answers"}, {relativeTime(run.created_at)}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
              {METRICS.map((m) => (
                <div key={m.key} className="border-t border-rule pt-2">
                  <dt className="text-sm text-graphite" title={m.help}>
                    {m.label}
                  </dt>
                  <dd className="mt-0.5 text-xl font-semibold tabular-nums">{pct(run.summary[m.key] as number | null)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-10">
            <div className="flex flex-wrap items-center gap-1 border-b border-rule pb-3">
              {["All", ...Object.keys(run.summary.categories)].map((c) => {
                const stats = c === "All" ? null : run.summary.categories[c];
                return (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={cx(
                      "rounded px-2.5 py-1 text-sm",
                      category === c ? "bg-ink text-paper" : "text-graphite hover:bg-sunk hover:text-ink",
                    )}
                  >
                    {c}
                    {stats && <span className="ml-1.5 tabular-nums opacity-70">{stats.passed}/{stats.total}</span>}
                  </button>
                );
              })}
              <label className="ml-auto flex items-center gap-2 text-sm text-graphite">
                <input type="checkbox" className="accent-[var(--teal)]" checked={onlyFailures} onChange={(e) => setOnlyFailures(e.target.checked)} />
                Failures only
              </label>
            </div>
            <ul className="divide-y divide-rule">
              {rows.map((r) => (
                <ResultRow key={r.id} row={r} />
              ))}
              {rows.length === 0 && <li className="py-6 text-sm text-graphite">Nothing to show.</li>}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function ResultRow({ row }: { row: EvaluationRow }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-3 py-3 text-left">
        <span
          className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", row.passed ? "bg-ok" : "bg-danger")}
          aria-label={row.passed ? "Passed" : "Failed"}
        />
        <span className="min-w-0 flex-1">
          <span className="block">{row.question}</span>
          <span className="mt-0.5 block text-sm text-graphite">
            {row.category}
            {row.as_role === "member" && ", asked as a member"}
            {row.should_abstain ? ", should be declined" : ""}
          </span>
        </span>
        <ChevronDown className={cx("mt-1 h-4 w-4 shrink-0 text-faint transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mb-4 ml-5 space-y-3 rounded bg-sunk p-4 text-sm">
          <p className="whitespace-pre-line font-serif text-base">{row.answer}</p>
          {row.citations.length > 0 && <p className="text-graphite">Cited: {row.citations.map((c) => c.document_title).join(", ")}</p>}
          <p className="text-graphite">Top results: {row.retrieved.length ? row.retrieved.join(", ") : "none"}</p>
          {row.fact_recall !== null && <p className="text-graphite">Key facts found: {pct(row.fact_recall)}</p>}
          {row.leaked && <p className="font-medium text-danger">A restricted document appeared in results.</p>}
        </div>
      )}
    </li>
  );
}
