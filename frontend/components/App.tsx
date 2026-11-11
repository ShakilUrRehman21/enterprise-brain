"use client";

import {
  FileText,
  FlaskConical,
  LogOut,
  Menu,
  MessageSquareText,
  Plus,
  Search,
  Settings,
  Trash2,
  Users,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { SESSION_EXPIRED_EVENT, api, session } from "@/lib/api";
import type { Citation, ConversationSummary, SystemStatus, User } from "@/lib/types";
import { AuthScreen, Logo } from "./AuthScreen";
import { ChatView } from "./ChatView";
import { DocumentsView } from "./DocumentsView";
import { EvaluationView } from "./EvaluationView";
import { EvidenceDrawer } from "./EvidenceDrawer";
import { PeopleView } from "./PeopleView";
import { SearchView } from "./SearchView";
import { SettingsDialog } from "./SettingsDialog";
import { IconButton, Spinner, cx } from "./ui";

// ---------------------------------------------------------------- routing
export type Route =
  | { view: "ask"; id?: string }
  | { view: "search" }
  | { view: "documents"; id?: string; chunk?: string }
  | { view: "evaluation" }
  | { view: "people" };

function parseHash(hash: string): Route {
  const [view, id, chunk] = hash.replace(/^#\/?/, "").split("/");
  switch (view) {
    case "search":
    case "evaluation":
    case "people":
      return { view };
    case "documents":
      return { view, id: id || undefined, chunk: chunk || undefined };
    default:
      return { view: "ask", id: id || undefined };
  }
}

export function href(r: Route): string {
  if (r.view === "ask") return r.id ? `#/ask/${r.id}` : "#/ask";
  if (r.view === "documents") return `#/documents${r.id ? `/${r.id}` : ""}${r.chunk ? `/${r.chunk}` : ""}`;
  return `#/${r.view}`;
}

export function navigate(r: Route) {
  window.location.hash = href(r);
}

/** Current route plus a counter that changes on every navigation, so a fresh
 * "new conversation" view mounts even when the route itself looks unchanged. */
function useRoute(): [Route, number] {
  const [state, setState] = useState<[Route, number]>([{ view: "ask" }, 0]);
  useEffect(() => {
    const sync = () => setState(([, n]) => [parseHash(window.location.hash), n + 1]);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return state;
}

// ------------------------------------------------------------------- app
export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!session.token) {
      setChecking(false);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => session.clear())
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    const expired = () => {
      setUser(null);
      setNotice("Your session expired. Sign in again to continue.");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expired);
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-graphite">
        <Spinner />
      </div>
    );
  }
  if (!user) {
    return (
      <AuthScreen
        notice={notice}
        onSignedIn={(u) => {
          setNotice(null);
          setUser(u);
        }}
      />
    );
  }
  return (
    <Shell
      user={user}
      onSignOut={() => {
        session.clear();
        setUser(null);
        window.location.hash = "";
      }}
    />
  );
}

// ----------------------------------------------------------------- shell
function Shell({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const [route, navCount] = useRoute();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [citation, setCitation] = useState<Citation | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const refreshConversations = useCallback(() => {
    api.conversations().then(setConversations).catch(() => undefined);
  }, []);
  const refreshStatus = useCallback(() => {
    api.status().then(setStatus).catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshConversations();
    refreshStatus();
  }, [refreshConversations, refreshStatus]);

  // Close overlays when the page changes.
  useEffect(() => {
    setRailOpen(false);
    setCitation(null);
  }, [navCount]);

  const deleteConversation = async (id: string) => {
    await api.deleteConversation(id).catch(() => undefined);
    setConversations((cs) => cs.filter((c) => c.id !== id));
    if (route.view === "ask" && route.id === id) navigate({ view: "ask" });
  };

  const nav = [
    { route: { view: "ask" } as Route, label: "Ask", icon: MessageSquareText },
    { route: { view: "search" } as Route, label: "Search passages", icon: Search },
    { route: { view: "documents" } as Route, label: "Documents", icon: FileText },
    ...(user.role === "admin"
      ? [
          { route: { view: "people" } as Route, label: "People", icon: Users },
          { route: { view: "evaluation" } as Route, label: "Answer quality", icon: FlaskConical },
        ]
      : []),
  ];

  const rail = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <a href="#/ask" className="flex items-center gap-2.5">
          <Logo className="h-6 w-6" />
          <span className="font-semibold tracking-tight">Enterprise Brain</span>
        </a>
        <IconButton label="Close menu" className="lg:hidden" onClick={() => setRailOpen(false)}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>

      <nav className="space-y-0.5 px-2" aria-label="Main">
        {nav.map((item) => {
          const active = route.view === item.route.view;
          const Icon = item.icon;
          return (
            <a
              key={item.label}
              href={href(item.route)}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex items-center gap-2.5 rounded px-2.5 py-1.5 text-sm",
                active ? "bg-surface font-medium text-ink shadow-[inset_0_0_0_1px_var(--rule)]" : "text-graphite hover:bg-surface hover:text-ink",
              )}
            >
              <Icon className={cx("h-4 w-4", active ? "text-teal" : "")} />
              {item.label}
            </a>
          );
        })}
      </nav>

      <div className="mt-5 flex items-center justify-between px-4">
        <h2 className="text-xs font-medium text-faint">Conversations</h2>
        <IconButton label="New conversation" className="h-7 w-7" onClick={() => navigate({ view: "ask" })}>
          <Plus className="h-4 w-4" />
        </IconButton>
      </div>
      <ul className="mt-1 flex-1 space-y-px overflow-y-auto px-2 pb-3 scroll-thin">
        {conversations.length === 0 && <li className="px-2.5 py-2 text-sm text-faint">Your questions will appear here.</li>}
        {conversations.map((c) => {
          const active = route.view === "ask" && route.id === c.id;
          return (
            <li key={c.id} className="group relative">
              <a
                href={href({ view: "ask", id: c.id })}
                className={cx(
                  "block truncate rounded py-1.5 pl-2.5 pr-8 text-sm",
                  active ? "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--rule)]" : "text-graphite hover:bg-surface hover:text-ink",
                )}
                title={c.title}
              >
                {c.title}
              </a>
              <button
                aria-label={`Delete “${c.title}”`}
                onClick={() => deleteConversation(c.id)}
                className="absolute right-1 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-faint hover:text-danger focus:flex group-hover:flex"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-rule px-3 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-wash text-sm font-semibold text-teal-ink">
            {user.full_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{user.full_name}</div>
            <div className="truncate text-xs text-graphite">{user.role === "admin" ? "Admin" : "Member"}</div>
          </div>
          <IconButton label="Settings" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
          </IconButton>
          <IconButton label="Sign out" onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <aside className="hidden w-64 shrink-0 border-r border-rule bg-sunk lg:block">{rail}</aside>
      {railOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setRailOpen(false)}>
          <div className="absolute inset-0 bg-[rgba(16,26,22,0.38)]" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-sunk shadow-lift" onClick={(e) => e.stopPropagation()}>
            {rail}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-rule px-3 py-2 lg:hidden">
          <IconButton label="Open menu" onClick={() => setRailOpen(true)}>
            <Menu className="h-5 w-5" />
          </IconButton>
          <span className="font-semibold tracking-tight">Enterprise Brain</span>
        </div>

        <main className="relative flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto scroll-thin" id="main-scroll">
            {route.view === "ask" && (
              <ChatView
                key={route.id || `new-${navCount}`}
                conversationId={route.id}
                user={user}
                status={status}
                onCite={setCitation}
                activeCitation={citation}
                onConversationChanged={refreshConversations}
              />
            )}
            {route.view === "search" && <SearchView status={status} />}
            {route.view === "documents" && (
              <DocumentsView user={user} openId={route.id} focusChunk={route.chunk} onChanged={refreshStatus} />
            )}
            {route.view === "people" && user.role === "admin" && <PeopleView me={user} />}
            {route.view === "evaluation" && user.role === "admin" && <EvaluationView />}
          </div>
          {citation && route.view === "ask" && <EvidenceDrawer citation={citation} onClose={() => setCitation(null)} />}
        </main>
      </div>

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        user={user}
        status={status}
        onStatusChange={refreshStatus}
      />
    </div>
  );
}
