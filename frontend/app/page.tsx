"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { DashboardView } from "@/components/DashboardView";
import { ChatView } from "@/components/ChatView";
import { SearchView } from "@/components/SearchView";
import { DocumentsView } from "@/components/DocumentsView";
import { EvaluationView } from "@/components/EvaluationView";
import { EvidencePanel } from "@/components/EvidencePanel";
import { getActiveUser } from "@/lib/api";
import { Citation } from "@/lib/types";

export default function AppShell() {
  const [currentView, setCurrentView] = useState<"dashboard" | "chat" | "search" | "documents" | "evaluation">("dashboard");
  const [activeUser, setActiveUser] = useState(getActiveUser());
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const handleSelectCitation = (cit: Citation) => {
    setActiveCitation(cit);
  };

  const handleOpenDocumentFromEvidence = (docId: string) => {
    setSelectedDocId(docId);
    setCurrentView("documents");
    setActiveCitation(null);
  };

  const handleNewChat = () => {
    setCurrentView("chat");
    setActiveCitation(null);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0b0f17] text-slate-100 font-sans">
      {/* Persistent Left Sidebar */}
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

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {currentView === "dashboard" && (
          <DashboardView
            onNavigate={(v) => {
              setCurrentView(v);
              setActiveCitation(null);
            }}
            onSelectDocument={(id) => {
              setSelectedDocId(id);
              setCurrentView("documents");
            }}
            activeUser={activeUser}
          />
        )}

        {currentView === "chat" && (
          <ChatView
            onSelectCitation={handleSelectCitation}
            activeUser={activeUser}
          />
        )}

        {currentView === "search" && (
          <SearchView
            onSelectCitation={handleSelectCitation}
            activeUser={activeUser}
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
