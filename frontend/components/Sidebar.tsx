"use client";

import React, { useState, useEffect } from "react";
import {
  BrainCircuit,
  MessageSquare,
  Search,
  FolderLock,
  BarChart3,
  UserCheck,
  Plus,
  Lock,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  KeyRound,
  X
} from "lucide-react";
import { setActiveUser, api, getGeminiApiKey, setGeminiApiKey } from "@/lib/api";

interface SidebarProps {
  currentView: "chat" | "search" | "documents" | "evaluation";
  onSelectView: (view: "chat" | "search" | "documents" | "evaluation") => void;
  onNewChat: () => void;
  activeUser: { email: string; role: "admin" | "member"; name: string };
  onUserChange: (user: { email: string; role: "admin" | "member"; name: string }) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  onNewChat,
  activeUser,
  onUserChange,
}) => {
  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [keySavedMessage, setKeySavedMessage] = useState(false);

  useEffect(() => {
    const existing = getGeminiApiKey();
    setGeminiKeyInput(existing);
    setHasApiKey(Boolean(existing));
  }, []);

  const handleSaveApiKey = () => {
    setGeminiApiKey(geminiKeyInput);
    setHasApiKey(Boolean(geminiKeyInput.trim()));
    setKeySavedMessage(true);
    setTimeout(() => {
      setKeySavedMessage(false);
      setShowKeyModal(false);
    }, 1200);
  };

  const switchUser = (role: "admin" | "member") => {
    const newUser =
      role === "admin"
        ? {
            email: "sarah_chen@enterprise.com",
            role: "admin" as const,
            name: "Sarah Chen (Admin)",
          }
        : {
            email: "bob_engineer@enterprise.com",
            role: "member" as const,
            name: "Bob Martinez (Member)",
          };
    setActiveUser(newUser);
    onUserChange(newUser);
  };

  const handleResetData = async () => {
    try {
      setResetting(true);
      await api.resetDemoData();
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 2500);
      window.location.reload();
    } catch (e: any) {
      alert("Failed to reset demo data: " + e.message);
    } finally {
      setResetting(false);
    }
  };

  const navItems = [
    { id: "chat", label: "Knowledge Chat", icon: MessageSquare },
    { id: "search", label: "Hybrid Search", icon: Search },
    { id: "documents", label: "Document Vault", icon: FolderLock },
    { id: "evaluation", label: "Evaluation Suite", icon: BarChart3 },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between select-none z-20 shrink-0 h-screen font-sans">
      <div className="flex flex-col h-full overflow-hidden">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-slate-900 leading-tight">
                Enterprise Brain
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Verified RAG Assistant
              </div>
            </div>
          </div>
        </div>

        {/* New Chat Primary Action */}
        <div className="p-3">
          <button
            onClick={() => {
              onNewChat();
              onSelectView("chat");
            }}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-xs shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Navigation List */}
        <nav className="px-3 py-1 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id as any)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? "text-blue-600" : "text-slate-400"
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Identity & RBAC Switcher */}
        <div className="p-3.5 border-t border-slate-100 bg-slate-50/70">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span>Active Identity</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                activeUser.role === "admin"
                  ? "bg-blue-100 text-blue-700"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {activeUser.role}
            </span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-200 mb-2.5 shadow-xs">
            <div className="text-xs font-semibold text-slate-900 truncate">
              {activeUser.name}
            </div>
            <div className="text-[11px] text-slate-500 truncate mt-0.5">
              {activeUser.email}
            </div>
            <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>
                {activeUser.role === "admin"
                  ? "Can access private policies"
                  : "Restricted from private policies"}
              </span>
            </div>
          </div>

          {/* Quick Toggle Buttons */}
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <button
              onClick={() => switchUser("admin")}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeUser.role === "admin"
                  ? "bg-blue-50 border-blue-200 text-blue-700 font-semibold"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
            <button
              onClick={() => switchUser("member")}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeUser.role === "member"
                  ? "bg-blue-50 border-blue-200 text-blue-700 font-semibold"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Member</span>
            </button>
          </div>

          {/* AI Engine & Gemini API Key Settings */}
          <button
            onClick={() => setShowKeyModal(true)}
            className="w-full mb-2 py-1.5 px-2 rounded-lg text-[11px] text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-between transition-colors cursor-pointer"
            title="Configure Gemini API Key or use Offline Grounded Extractor"
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className={`w-3 h-3 ${hasApiKey ? "text-amber-500" : "text-blue-600"}`} />
              <span className="font-medium">AI Engine</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${hasApiKey ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
              {hasApiKey ? "Gemini 2.5 Flash" : "Grounded"}
            </span>
          </button>

          {/* Reset Demo Data Action */}
          <button
            onClick={handleResetData}
            disabled={resetting}
            className="w-full py-1.5 px-2 rounded-lg text-[11px] text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="Reset to 6 clean demonstration documents"
          >
            {resetSuccess ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-700 font-medium">Reset Complete</span>
              </>
            ) : (
              <>
                <RotateCcw className={`w-3 h-3 ${resetting ? "animate-spin text-blue-600" : ""}`} />
                <span>{resetting ? "Resetting Docs..." : "Reset Seed Data"}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Gemini API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 text-slate-900 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">AI Engine Configuration</h3>
                  <p className="text-xs text-slate-500">Google Gemini API / Grounded Extractor</p>
                </div>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
                <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Dual-Engine Architecture
                </div>
                <p>
                  <strong>Google Gemini:</strong> Paste your Gemini API key below to activate conversational LLM responses using <code className="bg-white px-1 py-0.5 rounded border border-slate-200 text-blue-700">gemini-2.5-flash</code>.
                </p>
                <p>
                  <strong>Zero-Config Grounded Extractor:</strong> Leave empty to use the built-in deterministic extractor with 100% strict grounding, real section parsing, and verifiable citations.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Google Gemini API Key
                </label>
                <input
                  type="password"
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono bg-white text-slate-900"
                />
              </div>

              {keySavedMessage && (
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Configuration saved successfully!</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                {hasApiKey && (
                  <button
                    onClick={() => {
                      setGeminiKeyInput("");
                      setGeminiApiKey("");
                      setHasApiKey(false);
                      setKeySavedMessage(true);
                      setTimeout(() => {
                        setKeySavedMessage(false);
                        setShowKeyModal(false);
                      }, 1000);
                    }}
                    className="px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer mr-auto"
                  >
                    Remove Key
                  </button>
                )}
                <button
                  onClick={() => setShowKeyModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveApiKey}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  Save Configuration
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
