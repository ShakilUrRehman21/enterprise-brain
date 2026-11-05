"use client";

import React, { useState, useEffect } from "react";
import {
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  Eye,
  Shield,
  CheckCircle,
  X,
  AlertCircle,
  FolderPlus,
  Plus
} from "lucide-react";
import { api } from "@/lib/api";
import { DocumentItem } from "@/lib/types";

interface DocumentsViewProps {
  activeUser: { email: string; role: "admin" | "member"; name: string };
  selectedDocId?: string | null;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  activeUser,
  selectedDocId,
}) => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadAccess, setUploadAccess] = useState<"organization" | "private" | "shared">("organization");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Preview modal state
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Permission edit modal
  const [permDoc, setPermDoc] = useState<DocumentItem | null>(null);
  const [editAccessLevel, setEditAccessLevel] = useState<string>("organization");

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const docs = await api.getDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [activeUser]);

  useEffect(() => {
    if (selectedDocId) {
      handleInspect(selectedDocId);
    }
  }, [selectedDocId]);

  const handleInspect = async (docId: string) => {
    try {
      setLoadingPreview(true);
      const preview = await fetch(`http://localhost:8000/api/documents/${docId}/preview`, {
        headers: {
          "X-User-Email": activeUser.email,
          "X-User-Role": activeUser.role,
        },
      }).then((r) => r.json());
      setPreviewDoc(preview);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0) return;

    setUploading(true);
    setUploadError(null);

    try {
      for (const file of uploadFiles) {
        const formData = new FormData();
        formData.append("file", file);
        if (uploadTitle) formData.append("title", uploadTitle);
        formData.append("access_level", uploadAccess);

        await api.uploadDocument(formData);
      }
      setShowUploadModal(false);
      setUploadFiles([]);
      setUploadTitle("");
      await fetchDocs();
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document from the knowledge base?")) return;
    try {
      await api.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: any) {
      alert(err.message || "Failed to delete document.");
    }
  };

  const handleRetry = async (docId: string) => {
    try {
      await api.retryDocument(docId);
      await fetchDocs();
    } catch (err: any) {
      alert(err.message || "Reprocessing failed.");
    }
  };

  const handleSavePermissions = async () => {
    if (!permDoc) return;
    try {
      await api.updatePermissions(permDoc.id, editAccessLevel);
      setPermDoc(null);
      await fetchDocs();
    } catch (err: any) {
      alert(err.message || "Failed to update permissions.");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#0b0f17]">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>Organizational Knowledge Documents</span>
            <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-slate-800 text-slate-300">
              {documents.length}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage ingestions, chunk partitions, and row-level access control policies.
          </p>
        </div>

        {activeUser.role === "admin" && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium shadow-md shadow-blue-600/20 transition-all hover:scale-[1.01]"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        )}
      </div>

      {/* Documents Table */}
      <div className="bg-[#0f172a] rounded-xl border border-slate-800 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-[11px] font-mono uppercase text-slate-400 tracking-wider">
                <th className="p-4">Document Title</th>
                <th className="p-4">Format</th>
                <th className="p-4">Size</th>
                <th className="p-4">Access Level</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Loading knowledge documents...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No documents accessible for identity ({activeUser.role}).
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="p-4 font-medium text-white max-w-xs truncate">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="truncate">{doc.title}</span>
                      </div>
                    </td>
                    <td className="p-4 uppercase font-mono text-[11px] text-slate-400">
                      {doc.file_type}
                    </td>
                    <td className="p-4 font-mono text-slate-400">
                      {(doc.file_size / 1024).toFixed(1)} KB
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          doc.access_level === "private"
                            ? "bg-amber-950 text-amber-300 border border-amber-800/50"
                            : doc.access_level === "shared"
                            ? "bg-blue-950 text-blue-300 border border-blue-800/50"
                            : "bg-emerald-950 text-emerald-300 border border-emerald-800/50"
                        }`}
                      >
                        {doc.access_level}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          doc.status === "indexed"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/50"
                            : doc.status === "processing"
                            ? "bg-cyan-950 text-cyan-400 border border-cyan-800/50"
                            : "bg-red-950 text-red-400 border border-red-800/50"
                        }`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleInspect(doc.id)}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                          title="Preview Extracted Chunks"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {activeUser.role === "admin" && (
                          <>
                            <button
                              onClick={() => {
                                setPermDoc(doc);
                                setEditAccessLevel(doc.access_level);
                              }}
                              className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-amber-400 transition-colors"
                              title="Manage Permissions"
                            >
                              <Shield className="w-4 h-4" />
                            </button>

                            {doc.status === "failed" && (
                              <button
                                onClick={() => handleRetry(doc.id)}
                                className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-cyan-400 transition-colors"
                                title="Retry Ingestion"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="p-1.5 rounded hover:bg-slate-800 text-slate-300 hover:text-red-400 transition-colors"
                              title="Delete Document"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white">Upload Enterprise Document</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-lg text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Select File (PDF, DOCX, TXT)
                </label>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(e) => e.target.files && setUploadFiles(Array.from(e.target.files))}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer bg-slate-900 p-2 rounded-xl border border-slate-800"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Document Title (Optional)
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Q3 Security Compliance Policy"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Access Policy
                </label>
                <select
                  value={uploadAccess}
                  onChange={(e) => setUploadAccess(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="organization">Organization (All Authenticated Members)</option>
                  <option value="private">Private (Restricted to Owner/Admin Only)</option>
                  <option value="shared">Shared (Explicit User Delegation)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || uploadFiles.length === 0}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium"
                >
                  {uploading ? "Ingesting & Embedding..." : "Ingest Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">{previewDoc.title}</h3>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Total Chunks: {previewDoc.total_chunks} • Access: {previewDoc.access_level}
                </div>
              </div>
              <button onClick={() => setPreviewDoc(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                Extracted Text Chunks
              </div>
              <div className="space-y-3">
                {previewDoc.chunks?.map((chunk: any) => (
                  <div
                    key={chunk.id}
                    className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>Chunk #{chunk.chunk_index + 1} (Page {chunk.page_number || "1"})</span>
                      {chunk.section_title && (
                        <span className="text-cyan-400">{chunk.section_title}</span>
                      )}
                    </div>
                    <p className="text-slate-200 leading-relaxed">{chunk.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permission Edit Modal */}
      {permDoc && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-white">Manage Document Permissions</h3>
              <button onClick={() => setPermDoc(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300">
              Configuring policy for <span className="font-semibold text-white">{permDoc.title}</span>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-300">
                Access Level Policy
              </label>
              <select
                value={editAccessLevel}
                onChange={(e) => setEditAccessLevel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="organization">Organization (All Members Can Access)</option>
                <option value="private">Private (Restricted to Admins & Owner)</option>
                <option value="shared">Shared (Delegated User Access)</option>
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPermDoc(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
              >
                Save Policy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
