"use client";

import React, { useState } from "react";
import {
  X,
  FileText,
  BookmarkCheck,
  ExternalLink,
  Hash,
  Copy,
  Check,
  ShieldCheck
} from "lucide-react";
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
  const [copied, setCopied] = useState(false);

  if (!citation) return null;

  const handleCopyPassage = () => {
    navigator.clipboard.writeText(citation.exact_passage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-88 bg-white border-l border-slate-200 flex flex-col h-full shadow-lg z-30 shrink-0 font-sans">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 font-mono text-xs font-bold flex items-center justify-center">
            [{citation.citation_number}]
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">
              Verified Evidence
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              GROUNDED PASSAGE EXCERPT
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content Body */}
      <div className="p-4 space-y-4 overflow-y-auto flex-1 font-sans">
        {/* Verification Status Card */}
        <div className="flex items-start gap-2.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
          <div className="text-xs leading-relaxed">
            <span className="font-semibold block text-emerald-900">Verified Evidence Source</span>
            Citation points to a real chunk in the accessible knowledge base.
          </div>
        </div>

        {/* Document Info Card */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-900 leading-snug truncate">
                {citation.document_title}
              </h4>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-mono">
                <span>Page {citation.page_number || "1"}</span>
                {citation.section_title && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[120px] text-blue-700">{citation.section_title}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {onOpenDocument && (
            <button
              onClick={() => onOpenDocument(citation.document_id)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-white hover:bg-blue-50 text-blue-700 rounded-lg text-xs font-medium transition-colors cursor-pointer border border-slate-200 shadow-2xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Inspect Full Document Preview</span>
            </button>
          )}
        </div>

        {/* Exact Supporting Passage */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <BookmarkCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Exact Supporting Passage</span>
            </span>
            <button
              onClick={handleCopyPassage}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer font-medium"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied" : "Copy Quote"}</span>
            </button>
          </div>
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed font-sans border-l-3 border-l-blue-600">
            &ldquo;{citation.exact_passage}&rdquo;
          </div>
        </div>

        {/* Chunk Details */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 space-y-1.5 font-mono">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3 text-slate-400" /> Chunk ID
            </span>
            <span className="text-slate-700 text-[10px] truncate max-w-[130px]">
              {citation.chunk_id}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-slate-200">
            <span>Security Status</span>
            <span className="text-emerald-700 text-[10px] font-bold">AUTHORIZED</span>
          </div>
        </div>
      </div>
    </div>
  );
};
