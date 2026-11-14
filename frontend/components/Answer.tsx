"use client";

import { Check, Copy, SearchX } from "lucide-react";
import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Citation, Message } from "@/lib/types";
import { cx } from "./ui";

/** Turn "[2]" markers into links the markdown renderer hands back to us. */
function linkCitations(text: string) {
  return text.replace(/\[(\d+)\](?!\()/g, "[$1](#cite-$1)");
}

export function CitationMark({ citation, active, onClick }: { citation?: Citation; active?: boolean; onClick?: () => void }) {
  if (!citation) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Source ${citation.number}: ${citation.document_title}`}
      title={citation.document_title}
      className={cx(
        "relative -top-[0.45em] mx-[1px] inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-sm px-1 align-baseline font-sans text-[11px] font-semibold leading-none transition-colors",
        active ? "bg-marker text-ink ring-1 ring-teal" : "bg-teal text-white hover:bg-teal-ink dark:text-paper",
      )}
    >
      {citation.number}
    </button>
  );
}

export function Answer({
  message,
  active,
  onCite,
}: {
  message: Message;
  active?: Citation | null;
  onCite: (c: Citation) => void;
}) {
  const [copied, setCopied] = useState(false);
  const byNumber = useMemo(() => new Map(message.citations.map((c) => [c.number, c])), [message.citations]);
  const markdown = useMemo(() => linkCitations(message.content), [message.content]);

  if (message.engine === "system") {
    return <p className="prose-answer">{message.content}</p>;
  }

  if (message.abstained) {
    return (
      <div className="flex gap-3 rounded-md bg-caution-wash px-4 py-3 text-caution">
        <SearchX className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="text-sm">
          <p className="font-medium">Not found in your documents</p>
          <p className="mt-0.5 opacity-90">{message.content}</p>
        </div>
      </div>
    );
  }

  const copy = async () => {
    const plain = message.content.replace(/\[\d+\]/g, "").replace(/\*\*/g, "");
    const sources = message.citations.map((c) => `[${c.number}] ${c.document_title}`).join("\n");
    await navigator.clipboard.writeText(`${plain.trim()}\n\nSources:\n${sources}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div>
      <div className="prose-answer">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ href, children }) => {
              const m = href?.match(/^#cite-(\d+)$/);
              if (m) {
                const c = byNumber.get(Number(m[1]));
                return <CitationMark citation={c} active={!!c && c === active} onClick={() => c && onCite(c)} />;
              }
              return (
                <a href={href} target="_blank" rel="noreferrer" className="text-teal underline underline-offset-2">
                  {children}
                </a>
              );
            },
            h1: ({ children }) => <p className="font-semibold">{children}</p>,
            h2: ({ children }) => <p className="font-semibold">{children}</p>,
            h3: ({ children }) => <p className="font-semibold">{children}</p>,
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>

      {message.citations.length > 0 && (
        <ol className="mt-4 space-y-1 border-l-2 border-rule pl-3" aria-label="Sources">
          {message.citations.map((c) => (
            <li key={c.number}>
              <button
                type="button"
                onClick={() => onCite(c)}
                className={cx(
                  "group flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left text-sm",
                  c === active ? "bg-teal-wash" : "hover:bg-sunk",
                )}
              >
                <span className="w-4 shrink-0 font-semibold tabular-nums text-teal">{c.number}</span>
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-ink">{c.document_title}</span>
                  {(c.section_title || c.page_number) && (
                    <span className="ml-2 text-graphite">
                      {c.section_title}
                      {c.section_title && c.page_number ? ", " : ""}
                      {c.page_number ? `page ${c.page_number}` : ""}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-3 flex items-center gap-3 text-xs text-faint">
        <span>
          {message.engine === "gemini"
            ? "Written by Gemini from the sources"
            : message.engine === "extractive-fallback"
              ? "Gemini didn't respond, so this is quoted directly from the sources"
              : "Quoted directly from the sources"}
        </span>
        <button type="button" onClick={copy} className="inline-flex items-center gap-1 hover:text-ink">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
