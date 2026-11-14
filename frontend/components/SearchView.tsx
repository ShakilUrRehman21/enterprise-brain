"use client";

import { Search } from "lucide-react";
import React, { useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { SearchMode, SearchResponse, SystemStatus } from "@/lib/types";
import { href } from "./App";
import { Notice, PageHeader, Spinner, cx } from "./ui";

const MODES: { id: SearchMode; label: string; hint: string }[] = [
  { id: "hybrid", label: "Best match", hint: "Combines exact words and meaning" },
  { id: "keyword", label: "Exact words", hint: "Ranks by the words you typed" },
  { id: "vector", label: "Similar meaning", hint: "Finds related wording" },
];

export function SearchView({ status }: { status: SystemStatus | null }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("hybrid");
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (m: SearchMode = mode) => {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.search(query.trim(), m));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  };

  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        title="Search passages"
        description="Find the exact passages that mention something, across every document you can access. Use Ask when you want an answer instead."
      />

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <label htmlFor="search" className="sr-only">
            Search
          </label>
          <input
            id="search"
            className="field pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. receipts, mTLS, parental leave"
            autoFocus
          />
        </div>
        <button type="submit" className="h-[40px] rounded bg-teal px-4 text-sm font-medium text-white hover:bg-teal-ink dark:text-paper">
          Search
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-1" role="radiogroup" aria-label="Match type">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="radio"
            aria-checked={mode === m.id}
            title={m.hint}
            onClick={() => {
              setMode(m.id);
              if (result) run(m.id);
            }}
            className={cx(
              "rounded px-2.5 py-1 text-sm",
              mode === m.id ? "bg-ink text-paper" : "text-graphite hover:bg-sunk hover:text-ink",
            )}
          >
            {m.label}
          </button>
        ))}
        {status && (
          <span className="ml-auto text-xs text-faint">
            Meaning search uses {status.ai_engine === "gemini" ? "Gemini embeddings" : "local word-similarity"}
          </span>
        )}
      </div>

      {error && <Notice tone="error" className="mt-6">{error}</Notice>}
      {busy && (
        <div className="mt-10 flex justify-center text-graphite">
          <Spinner />
        </div>
      )}

      {!busy && result && (
        <section className="mt-8" aria-live="polite">
          <p className="text-sm text-graphite">
            {result.results.length === 0
              ? "No passages match. Try different words, or Ask a question instead."
              : `${result.results.length} passage${result.results.length === 1 ? "" : "s"}, best match first`}
          </p>
          <ol className="mt-3 divide-y divide-rule border-y border-rule">
            {result.results.map((hit) => (
              <li key={hit.chunk_id} className="py-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <a href={href({ view: "documents", id: hit.document_id, chunk: hit.chunk_id })} className="font-semibold hover:text-teal">
                    {hit.document_title}
                  </a>
                  {hit.section_title && <span className="text-sm text-graphite">{hit.section_title}</span>}
                  {hit.page_number && <span className="text-sm text-graphite">Page {hit.page_number}</span>}
                  {hit.access_level !== "organization" && (
                    <span className="rounded-sm bg-sunk px-1.5 text-xs text-graphite">
                      {hit.access_level === "private" ? "Private" : "Shared"}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 line-clamp-4 whitespace-pre-line font-serif text-base leading-relaxed text-graphite">
                  <TermHighlight text={hit.content} terms={terms} />
                </p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function TermHighlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`\\b(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\w*`, "gi");
  const parts = text.split(re);
  // split with one capture group alternates: text, match-prefix, text...
  const out: React.ReactNode[] = [];
  let last = 0;
  text.replace(re, (m, _g, offset: number) => {
    out.push(text.slice(last, offset));
    out.push(
      <mark key={offset} className="mark text-ink">
        {m}
      </mark>,
    );
    last = offset + m.length;
    return m;
  });
  out.push(text.slice(last));
  return parts.length > 1 ? <>{out}</> : <>{text}</>;
}
