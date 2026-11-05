"use client";

import React, { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { ChatView } from "@/components/ChatView";
import { SearchView } from "@/components/SearchView";
import { DocumentsView } from "@/components/DocumentsView";
import { EvaluationView } from "@/components/EvaluationView";
import { EvidencePanel } from "@/components/EvidencePanel";
import { getActiveUser, DEFAULT_USER, ActiveUserSession } from "@/lib/api";
import { Citation } from "@/lib/types";

export default function AppShell() {
  const [currentView, setCurrentView] = useState<"chat" | "search" | "documents" | "evaluation">("chat");
  const [activeUser, setActiveUser] = useState<ActiveUserSession>(DEFAULT_USER);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [prefillQuery, setPrefillQuery] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setActiveUser(getActiveUser());
  }, []);

  const handleSelectCitation = (cit: Citation) => {
    setActiveCitation(cit);
  };

  const handleOpenDocumentFromEvidence = (docId: string) => {
    setSelectedDocId(docId);
    setCurrentView("documents");
    setActiveCitation(null);
  };

  const handleNewChat = () => {
    setPrefillQuery(null);
    setCurrentView("chat");
    setActiveCitation(null);
  };

  const handleStartChatWithQuery = (q: string) => {
    setPrefillQuery(q);
    setCurrentView("chat");
    setActiveCitation(null);
  };

  if (!mounted) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50 text-slate-600">
        <div className="flex items-center gap-2 text-xs font-medium">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Loading Enterprise Brain...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Clean Light Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={(v) => {
          setCurrentView(v);
          setActiveCitation(null);
        }}
        onNewChat={handleNewChat}
        activeUser={activeUser}
        onUserChange={(u) => {
          setActiveUser(u);
          setActiveCitation(null);
        }}
      />

      {/* Main Module Content Area */}
      <main className="flex-1 flex overflow-hidden relative bg-slate-50">
        {currentView === "chat" && (
          <ChatView
            onSelectCitation={handleSelectCitation}
            activeUser={activeUser}
            initialQuery={prefillQuery}
            onClearInitialQuery={() => setPrefillQuery(null)}
          />
        )}

        {currentView === "search" && (
          <SearchView
            onSelectCitation={handleSelectCitation}
            activeUser={activeUser}
            onStartChatWithChunk={handleStartChatWithQuery}
          />
        )}

        {currentView === "documents" && (
          <DocumentsView
            activeUser={activeUser}
            selectedDocId={selectedDocId}
          />
        )}

        {currentView === "evaluation" && (
          <EvaluationView />
        )}

        {/* Slide-over Evidence & Verified Citation Panel */}
        {activeCitation && (
          <EvidencePanel
            citation={activeCitation}
            onClose={() => setActiveCitation(null)}
            onOpenDocument={handleOpenDocumentFromEvidence}
          />
        )}
      </main>
    </div>
  );
}
