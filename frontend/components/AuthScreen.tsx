"use client";

import React, { useEffect, useState } from "react";
import { ApiError, api, session } from "@/lib/api";
import type { PublicInfo, User } from "@/lib/types";
import { Button, Field, Notice } from "./ui";

export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" fill="var(--teal)" />
      <path d="M9 9h14M9 16h9M9 23h14" stroke="#f2dd72" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function AuthScreen({ onSignedIn, notice }: { onSignedIn: (u: User) => void; notice?: string | null }) {
  const [info, setInfo] = useState<PublicInfo | null>(null);
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .info()
      .then((i) => {
        setInfo(i);
        if (i.needs_first_admin) setMode("register");
      })
      .catch((e: ApiError) => setError(e.message));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = mode === "signin" ? await api.login(email, password) : await api.register(email, name, password);
      session.set(res.access_token);
      onSignedIn(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const firstRun = info?.needs_first_admin;
  const canRegister = info?.registration_open;

  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(420px,1fr)_1.1fr]">
      <main className="flex flex-col justify-between px-6 py-8 sm:px-12">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-base font-semibold tracking-tight">Enterprise Brain</span>
        </div>

        <div className="mx-auto w-full max-w-sm py-12">
          <h1 className="text-2xl font-semibold tracking-tight">
            {firstRun ? "Set up your workspace" : mode === "signin" ? "Sign in" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-graphite">
            {firstRun
              ? "You're the first person here, so this account will be the workspace admin."
              : mode === "signin"
                ? "Ask questions about your company's documents and see exactly where each answer comes from."
                : "You'll be able to ask questions about every document shared with you."}
          </p>

          {notice && <Notice className="mt-5">{notice}</Notice>}

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "register" && (
              <Field label="Full name">
                <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
              </Field>
            )}
            <Field label="Work email">
              <input
                className="field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Password" hint={mode === "register" ? "At least 8 characters." : undefined}>
              <input
                className="field"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                minLength={mode === "register" ? 8 : undefined}
                required
              />
            </Field>
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" variant="primary" busy={busy} className="w-full">
              {mode === "signin" ? "Sign in" : firstRun ? "Create admin account" : "Create account"}
            </Button>
          </form>

          {!firstRun && canRegister && (
            <p className="mt-5 text-sm text-graphite">
              {mode === "signin" ? "New here? " : "Already have an account? "}
              <button
                type="button"
                className="font-medium text-teal underline-offset-4 hover:underline"
                onClick={() => {
                  setMode(mode === "signin" ? "register" : "signin");
                  setError(null);
                }}
              >
                {mode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </p>
          )}
          {!firstRun && info && !canRegister && mode === "signin" && (
            <p className="mt-5 text-sm text-graphite">Need access? Ask a workspace admin to create your account.</p>
          )}
        </div>

        <p className="text-xs text-faint">{info ? `Version ${info.version}` : " "}</p>
      </main>

      <Specimen />
    </div>
  );
}

/** A worked example of what an answer looks like: the product's core idea. */
function Specimen() {
  return (
    <aside className="relative hidden overflow-hidden border-l border-rule bg-sunk lg:flex lg:items-center lg:justify-center" aria-hidden>
      <div className="w-full max-w-lg px-10">
        <p className="text-sm text-graphite">How long do I have to submit expenses?</p>
        <p className="mt-3 font-serif text-xl leading-relaxed">
          Expense reports are due within 30 days of the expense
          <sup className="ml-0.5 rounded-sm bg-teal px-1 font-sans text-[11px] font-semibold text-white">1</sup>. Later
          submissions need written VP approval
          <sup className="ml-0.5 rounded-sm bg-teal px-1 font-sans text-[11px] font-semibold text-white">1</sup>.
        </p>
        <div className="mt-8 rounded-md border border-rule bg-surface p-5 shadow-lift">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm font-semibold">Employee Travel Policy</span>
            <span className="text-xs text-graphite">Reimbursement deadlines</span>
          </div>
          <p className="mt-3 font-serif text-base leading-relaxed text-graphite">
            <span className="mark text-ink">Employees must submit expense reports within 30 days of incurring business expenses.</span>{" "}
            Late submissions beyond 30 days will be rejected unless granted prior written VP approval. Itemized receipts are
            mandatory for any expense exceeding $25.
          </p>
        </div>
        <p className="mt-6 text-sm text-graphite">Every claim links to the passage it came from.</p>
      </div>
    </aside>
  );
}
