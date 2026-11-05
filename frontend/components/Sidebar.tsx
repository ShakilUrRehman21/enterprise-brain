"use client";

import React from "react";
import {
  BrainCircuit,
  MessageSquare,
  Search,
  FolderLock,
  BarChart3,
  LayoutDashboard,
  ShieldAlert,
  UserCheck,
  Plus
} from "lucide-react";
import { getActiveUser, setActiveUser } from "@/lib/api";

interface SidebarProps {
  currentView: "dashboard" | "chat" | "search" | "documents" | "evaluation";
  onSelectView: (view: "dashboard" | "chat" | "search" | "documents" | "evaluation") => void;
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
  const switchUser = (role: "admin" | "member") => {
    const newUser =
      role === "admin"
        ? {
            email: "sarah_chen@enterprise.com",
            role: "admin" as const,
            name: "Sarah Chen (CIO / Admin)",
          }
        : {
            email: "bob_engineer@enterprise.com",
            role: "member" as const,
            name: "Bob Martinez (Engineer / Member)",
          };
    setActiveUser(newUser);
    onUserChange(newUser);
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "chat", label: "Knowledge Chat", icon: MessageSquare },
    { id: "search", label: "Hybrid Search", icon: Search },
    { id: "documents", label: "Documents", icon: FolderLock },
    { id: "evaluation", label: "Evaluation Suite", icon: BarChart3 },
  ];

  return (
    <aside className="w-64 bg-[#0d131f] border-r border-slate-800 flex flex-col justify-between select-none z-20">
      <div>
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-sm tracking-wide text-white">Enterprise Brain</div>
              <div className="text-[11px] text-cyan-400 font-mono tracking-wider">AI KNOWLEDGE BASE</div>
            </div>
          </div>
        </div>

        {/* New Chat Action */}
        <div className="p-3">
          <button
            onClick={() => {
              onNewChat();
              onSelectView("chat");
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-xs shadow-md shadow-blue-600/20 transition-all hover:scale-[1.01]"
          >
            <Plus className="w-4 h-4" />
            <span>New Investigation</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id as any)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-slate-800/90 text-cyan-400 shadow-sm border border-slate-700/60"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Role / Identity Simulation Switcher */}
      <div className="p-3 border-t border-slate-800 bg-[#090d16]/80">
        <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
          <span>Active Identity & RBAC</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 mb-2.5">
          <div className="text-xs font-semibold text-slate-200 truncate">{activeUser.name}</div>
          <div className="text-[11px] text-slate-400 font-mono truncate">{activeUser.email}</div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                activeUser.role === "admin"
                  ? "bg-purple-950/80 text-purple-300 border border-purple-800/50"
                  : "bg-emerald-950/80 text-emerald-300 border border-emerald-800/50"
              }`}
            >
              {activeUser.role}
            </span>
            <span className="text-[10px] text-slate-400">
              {activeUser.role === "admin" ? "All Documents" : "Restricted Access"}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => switchUser("admin")}
            className={`py-1.5 px-2 rounded text-[11px] font-medium border transition-colors flex items-center justify-center gap-1 ${
              activeUser.role === "admin"
                ? "bg-purple-600/20 border-purple-500/50 text-purple-300"
                : "bg-slate-800/40 border-slate-700/40 text-slate-400 hover:text-slate-200"
            }`}
          >
            <UserCheck className="w-3 h-3" />
            <span>Admin</span>
          </button>
          <button
            onClick={() => switchUser("member")}
            className={`py-1.5 px-2 rounded text-[11px] font-medium border transition-colors flex items-center justify-center gap-1 ${
              activeUser.role === "member"
                ? "bg-emerald-600/20 border-emerald-500/50 text-emerald-300"
                : "bg-slate-800/40 border-slate-700/40 text-slate-400 hover:text-slate-200"
            }`}
          >
            <UserCheck className="w-3 h-3" />
            <span>Member</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
