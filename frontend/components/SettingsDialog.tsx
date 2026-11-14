"use client";

import React, { useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { SystemStatus, User } from "@/lib/types";
import { Button, Dialog, Field, Notice } from "./ui";

export function SettingsDialog({
  open,
  onClose,
  user,
  status,
  onStatusChange,
}: {
  open: boolean;
  onClose: () => void;
  user: User;
  status: SystemStatus | null;
  onStatusChange: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [reindexBusy, setReindexBusy] = useState(false);
  const [reindexMsg, setReindexMsg] = useState<string | null>(null);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwBusy(true);
    setPwMsg(null);
    try {
      await api.changePassword(current, next);
      setCurrent("");
      setNext("");
      setPwMsg({ tone: "info", text: "Password changed." });
    } catch (err) {
      setPwMsg({ tone: "error", text: err instanceof ApiError ? err.message : "Couldn't change password." });
    } finally {
      setPwBusy(false);
    }
  };

  const reindex = async () => {
    setReindexBusy(true);
    try {
      const r = await api.reindex();
      setReindexMsg(`Updated ${r.chunks_updated} passages.`);
      onStatusChange();
    } catch (err) {
      setReindexMsg(err instanceof ApiError ? err.message : "Re-indexing failed.");
    } finally {
      setReindexBusy(false);
    }
  };

  return (
    <Dialog open={open} title="Settings" onClose={onClose} width="max-w-lg">
      <section>
        <h3 className="text-sm font-semibold">Your account</h3>
        <p className="mt-1 text-sm text-graphite">
          {user.full_name}, {user.email}
        </p>
        <form onSubmit={changePassword} className="mt-4 space-y-3">
          <Field label="Current password">
            <input className="field" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </Field>
          <Field label="New password" hint="At least 8 characters.">
            <input className="field" type="password" autoComplete="new-password" minLength={8} value={next} onChange={(e) => setNext(e.target.value)} required />
          </Field>
          {pwMsg && <Notice tone={pwMsg.tone}>{pwMsg.text}</Notice>}
          <Button type="submit" busy={pwBusy}>
            Change password
          </Button>
        </form>
      </section>

      {status && (
        <section className="mt-6 border-t border-rule pt-5">
          <h3 className="text-sm font-semibold">How answers are produced</h3>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-graphite">Answers</dt>
            <dd>{status.ai_engine === "gemini" ? `Gemini (${status.generation_model})` : "Quoted from documents (no AI model configured)"}</dd>
            <dt className="text-graphite">Meaning search</dt>
            <dd className="break-all">{status.embedding_model}</dd>
            <dt className="text-graphite">Indexed documents</dt>
            <dd>{status.documents_indexed}</dd>
            <dt className="text-graphite">Version</dt>
            <dd>{status.version}</dd>
          </dl>
          {user.role === "admin" && status.stale_chunks > 0 && (
            <div className="mt-4">
              <Notice tone="caution">
                {status.stale_chunks} passages were indexed with a different search model and only match on exact words. Re-index
                them to restore meaning search.
              </Notice>
              <Button className="mt-3" onClick={reindex} busy={reindexBusy}>
                Re-index passages
              </Button>
            </div>
          )}
          {reindexMsg && <p className="mt-2 text-sm text-graphite">{reindexMsg}</p>}
        </section>
      )}
    </Dialog>
  );
}
