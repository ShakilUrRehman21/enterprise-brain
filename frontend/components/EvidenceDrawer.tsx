"use client";

import { Check, Copy, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import type { Citation } from "@/lib/types";
import { href } from "./App";
import { Highlighted, IconButton } from "./ui";

export function EvidenceDrawer({ citation, onClose }: { citation: Citation; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    bodyRef.current?.querySelector("[data-cited]")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [citation.chunk_id, citation.quote]);

  const copy = async () => {
    await navigator.clipboard.writeText(`“${citation.quote || citation.passage}” (${citation.document_title})`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const location = [citation.section_title, citation.page_number ? `Page ${citation.page_number}` : null].filter(Boolean);

  return (
    <aside
      aria-label={`Source ${citation.number}`}
      className="animate-drawer fixed inset-0 z-30 flex flex-col bg-surface lg:static lg:inset-auto lg:z-auto lg:w-[26rem] lg:shrink-0 lg:border-l lg:border-rule lg:shadow-drawer"
    >
      <header className="flex items-start gap-3 border-b border-rule px-5 py-4">
        <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-sm bg-teal px-1.5 text-xs font-semibold text-white dark:text-paper">
          {citation.number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold leading-snug">{citation.document_title}</h2>
          {location.length > 0 && <p className="mt-0.5 text-sm text-graphite">{location.join(", ")}</p>}
        </div>
        <IconButton label="Close source" onClick={onClose}>
          <X className="h-4 w-4" />
        </IconButton>
      </header>

      <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-5 scroll-thin">
        <p className="whitespace-pre-line font-serif text-lg leading-relaxed text-graphite [&_mark]:text-ink">
          <Highlighted text={citation.passage} quote={citation.quote} />
        </p>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-rule px-5 py-3 text-sm">
        <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 text-graphite hover:text-ink">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy quote"}
        </button>
        <a
          href={href({ view: "documents", id: citation.document_id, chunk: citation.chunk_id })}
          className="font-medium text-teal hover:underline"
        >
          Open document
        </a>
      </footer>
    </aside>
  );
}
