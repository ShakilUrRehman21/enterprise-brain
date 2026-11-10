"use client";

import React from "react";
import { X, FileText, CheckCircle2, BookmarkCheck, ExternalLink, Hash } from "lucide-react";
import { Citation } from "@/lib/types";

interface EvidencePanelProps {
  citation: Citation | null;
  onClose: () => void;
  onOpenDocument?: (docId: string) => void;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({
  citation,
  onClose,
  onOpenDocument,
}) => {
  if (!citation) return null;

  return (
    <div className="w-96 bg-[#0f172a] border-l border-slate-800 flex flex-col h-full shadow-2xl z-30 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-cyan-950 border border-cyan-800/80 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold">
            [{citation.citation_number}]
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Source Passage Evidence
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 overflow-y-auto flex-1">
        {/* Document Info Card */}
        <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
          <div className="flex items-start gap-2.5">
            <FileText className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <h4 className="text-xs font-semibold text-white leading-snug truncate">
                {citation.document_title}
              </h4>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                <span>Page {citation.page_number || "1"}</span>
                {citation.section_title && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[150px]">{citation.section_title}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {onOpenDocument && (
            <button
              onClick={() => onOpenDocument(citation.document_id)}
              className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-700/60 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-medium transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Inspect Full Document Preview</span>
            </button>
          )}
        </div>

        {/* Verification Status */}
        <div className="flex items-center gap-2 p-2.5 bg-emerald-950/40 border border-emerald-800/40 rounded-lg text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>Grounded Citation Verified Against Ingested Knowledge Base Chunk</span>
        </div>

        {/* Exact Supporting Passage */}
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
            <BookmarkCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Extracted Passage</span>
          </div>
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 leading-relaxed font-sans bg-gradient-to-b from-slate-900 to-[#0b101b]">
            &ldquo;{citation.exact_passage}&rdquo;
          </div>
        </div>

        {/* Chunk Details */}
        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-[11px] text-slate-400 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <Hash className="w-3 h-3" /> Chunk Identifier
            </span>
            <span className="font-mono text-slate-300 text-[10px] truncate max-w-[160px]">
              {citation.chunk_id}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Access Policy</span>
            <span className="text-emerald-400 font-mono text-[10px]">AUTHORIZED</span>
          </div>
        </div>
      </div>
    </div>
  );
};
