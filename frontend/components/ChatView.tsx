"use client";

import { ArrowUp } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { Citation, Message, SystemStatus, User } from "@/lib/types";
import { navigate } from "./App";
import { Answer } from "./Answer";
import { Button, Notice, Spinner, cx } from "./ui";

const SAMPLE_QUESTIONS = [
  "How long do I have to submit expense reports?",
  "How many sick days do employees get?",
  "What encryption is required for data at rest?",
  "Summarize the product roadmap",
];

export function ChatView({
  conversationId,
  user,
  status,
  onCite,
  activeCitation,
  onConversationChanged,
}: {
  conversationId?: string;
  user: User;
  status: SystemStatus | null;
  onCite: (c: Citation) => void;
  activeCitation: Citation | null;
  onConversationChanged: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(!!conversationId);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSamples, setHasSamples] = useState(false);
  const [docCount, setDocCount] = useState<number | null>(null);
  const convRef = useRef<string | undefined>(conversationId);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!conversationId) {
      api
        .documents()
        .then((docs) => {
          setDocCount(docs.filter((d) => d.status === "indexed").length);
          setHasSamples(docs.some((d) => d.is_sample && d.status === "indexed"));
        })
        .catch(() => undefined);
      return;
    }
    setLoading(true);
    api
      .conversation(conversationId)
      .then((c) => setMessages(c.messages))
      .catch((e: ApiError) => setError(e.status === 404 ? "This conversation doesn't exist or was deleted." : e.message))
      .finally(() => setLoading(false));
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || pending) return;
    setPending(q);
    setError(null);
    try {
      const res = await api.ask(q, convRef.current);
      setMessages((m) => [...m, res.user_message, res.message]);
      if (!convRef.current) {
        convRef.current = res.conversation.id;
        // Keep this view mounted; just reflect the new conversation in the URL.
        history.replaceState(null, "", `#/ask/${res.conversation.id}`);
      }
      onConversationChanged();
      // On wide screens, open the evidence for the first source straight away.
      if (res.message.citations[0] && window.matchMedia("(min-width: 1024px)").matches) onCite(res.message.citations[0]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't get an answer. Try again.");
      return q;
    } finally {
      setPending(null);
    }
  };

  const empty = !loading && messages.length === 0 && !pending;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[46rem] flex-col px-4 sm:px-8">
      <div className="flex-1 pb-8 pt-8 sm:pt-12">
        {loading && (
          <div className="flex justify-center py-16 text-graphite">
            <Spinner />
          </div>
        )}

        {empty && <EmptyState user={user} docCount={docCount} hasSamples={hasSamples} status={status} onAsk={send} />}

        <div className="space-y-10">
          {pairUp(messages).map(([q, a]) => (
            <article key={q.id}>
              <h2 className="text-lg font-medium leading-snug text-ink">{q.content}</h2>
              {a && (
                <div className="mt-3">
                  <Answer message={a} active={activeCitation} onCite={onCite} />
                </div>
              )}
            </article>
          ))}
          {pending && (
            <article aria-live="polite">
              <h2 className="text-lg font-medium leading-snug">{pending}</h2>
              <div className="mt-3 flex items-center gap-2 text-sm text-graphite">
                <span className="dot-pulse inline-flex gap-1" aria-hidden>
                  <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                  <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                  <span className="h-1.5 w-1.5 rounded-full bg-teal" />
                </span>
                Reading your documents
              </div>
            </article>
          )}
        </div>
        {error && <Notice tone="error" className="mt-6">{error}</Notice>}
        <div ref={endRef} />
      </div>

      <Composer onSend={send} busy={!!pending} autoFocus={!conversationId} />
    </div>
  );
}

function pairUp(messages: Message[]): [Message, Message | undefined][] {
  const out: [Message, Message | undefined][] = [];
  messages.forEach((m, i) => {
    if (m.role === "user") out.push([m, messages[i + 1]?.role === "assistant" ? messages[i + 1] : undefined]);
  });
  return out;
}

function EmptyState({
  user,
  docCount,
  hasSamples,
  status,
  onAsk,
}: {
  user: User;
  docCount: number | null;
  hasSamples: boolean;
  status: SystemStatus | null;
  onAsk: (q: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (docCount === 0) {
    const addSamples = async () => {
      setAdding(true);
      try {
        await api.addSamples();
        window.location.reload();
      } catch (e) {
        setErr(e instanceof ApiError ? e.message : "Couldn't add the sample documents.");
        setAdding(false);
      }
    };
    return (
      <div className="py-10">
        <h1 className="text-2xl font-semibold tracking-tight">There's nothing to search yet</h1>
        <p className="mt-2 max-w-[56ch] text-graphite">
          Upload policies, handbooks or guides and you can ask questions about them here. Every answer links to the passage
          it came from.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => navigate({ view: "documents" })}>
            Upload documents
          </Button>
          {user.role === "admin" && (
            <Button onClick={addSamples} busy={adding}>
              Add sample documents
            </Button>
          )}
        </div>
        {err && <Notice tone="error" className="mt-4">{err}</Notice>}
      </div>
    );
  }

  return (
    <div className="py-10">
      <h1 className="text-2xl font-semibold tracking-tight">What do you need to know?</h1>
      <p className="mt-2 max-w-[56ch] text-graphite">
        Answers come only from documents you have access to
        {docCount ? ` (${docCount} right now)` : ""}. If they don't cover your question, you'll be told so.
      </p>
      {hasSamples && (
        <div className="mt-8">
          <h2 className="text-sm text-graphite">Try one of these</h2>
          <ul className="mt-2 divide-y divide-rule border-y border-rule">
            {SAMPLE_QUESTIONS.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => onAsk(q)}
                  className="w-full py-2.5 text-left font-serif text-lg text-ink hover:text-teal"
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {status?.ai_engine === "local" && (
        <p className="mt-8 text-sm text-faint">
          Running without an AI model, so answers quote the matching sentences directly. Add a Gemini API key on the server
          for written, multi-document answers.
        </p>
      )}
    </div>
  );
}

function Composer({ onSend, busy, autoFocus }: { onSend: (q: string) => Promise<string | void>; busy: boolean; autoFocus: boolean }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const submit = async () => {
    const q = text.trim();
    if (!q || busy) return;
    setText("");
    const failed = await onSend(q);
    if (failed) setText(failed); // give the question back so it can be retried
    ref.current?.focus();
  };

  return (
    <div className="sticky bottom-0 bg-gradient-to-t from-paper from-70% to-transparent pb-4 pt-6 sm:pb-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 rounded-lg border border-rule bg-surface p-2 shadow-lift focus-within:border-teal"
      >
        <label htmlFor="question" className="sr-only">
          Ask a question
        </label>
        <textarea
          id="question"
          ref={ref}
          rows={1}
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Ask about a policy, process or guideline"
          className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-base text-ink placeholder:text-faint focus:outline-none"
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          aria-label="Ask"
          className={cx(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded transition-colors",
            text.trim() && !busy ? "bg-teal text-white hover:bg-teal-ink dark:text-paper" : "bg-sunk text-faint",
          )}
        >
          {busy ? <Spinner className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </form>
      <p className="mt-2 hidden text-center text-xs text-faint sm:block">Enter to ask, Shift + Enter for a new line</p>
    </div>
  );
}
