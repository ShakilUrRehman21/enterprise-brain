"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Lock,
  Globe,
  Search,
  FileUp,
  Check,
  Code
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
  const [searchFilter, setSearchFilter] = useState("");

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadAccess, setUploadAccess] = useState<"organization" | "private" | "shared">("organization");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview drawer / modal state
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewTab, setPreviewTab] = useState<"chunks" | "json">("chunks");
  const [chunkSearch, setChunkSearch] = useState("");

  // Permission edit modal
  const [permDoc, setPermDoc] = useState<DocumentItem | null>(null);
  const [editAccessLevel, setEditAccessLevel] = useState<string>("organization");
  const [savingPerm, setSavingPerm] = useState(false);

  // Delete confirmation modal
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      const preview = await api.getDocumentPreview(docId);
      setPreviewDoc(preview);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setUploadFiles(Array.from(e.dataTransfer.files));
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
      setUploadError(err.message || "Document ingestion failed.");
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteDocId) return;
    try {
      setDeleting(true);
      await api.deleteDocument(deleteDocId);
      setDocuments((prev) => prev.filter((d) => d.id !== deleteDocId));
      setDeleteDocId(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete document.");
    } finally {
      setDeleting(false);
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
      setSavingPerm(true);
      await api.updatePermissions(permDoc.id, editAccessLevel);
      setPermDoc(null);
      await fetchDocs();
    } catch (err: any) {
      alert(err.message || "Failed to update permissions.");
    } finally {
      setSavingPerm(false);
    }
  };

  const filteredDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
    d.access_level.toLowerCase().includes(searchFilter.toLowerCase()) ||
    d.file_type.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 bg-slate-50 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <span>Document Vault</span>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-slate-200 text-slate-700">
              {documents.length} Authorized
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Manage organizational documents, inspect extracted token chunks, and configure document permissions.
          </p>
        </div>

        <div>
          {activeUser.role === "admin" && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Document</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter authorized documents by title, policy, or extension..."
            className="w-full bg-white border border-slate-200 focus:border-blue-600 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all shadow-xs"
          />
        </div>

        <div className="text-xs text-slate-500">
          Identity Clearance: <span className="text-blue-700 font-semibold capitalize">{activeUser.role}</span>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
                <th className="p-3.5 px-5">Document Title</th>
                <th className="p-3.5">Type</th>
                <th className="p-3.5">File Size</th>
                <th className="p-3.5">Access Policy</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400">
                    Loading documents for {activeUser.role}...
                  </td>
                </tr>
              ) : filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-500 space-y-1">
                    <p className="font-semibold text-slate-700">No documents found matching filter.</p>
                    <p className="text-xs text-slate-400">
                      {activeUser.role === "member"
                        ? "Note: Member role is restricted from private executive documents."
                        : "Upload documents or click 'Reset Seed Data' in the sidebar."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="p-3.5 px-5 font-medium text-slate-900 max-w-sm truncate">
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="truncate font-semibold text-xs group-hover:text-blue-600 transition-colors">
                          {doc.title}
                        </span>
                      </div>
                    </td>
                    <td className="p-3.5 uppercase font-mono text-[11px] text-slate-500">
                      {doc.file_type}
                    </td>
                    <td className="p-3.5 text-slate-500 font-mono">
                      {(doc.file_size / 1024).toFixed(1)} KB
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          doc.access_level === "private"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {doc.access_level === "private" ? (
                          <Lock className="w-3 h-3" />
                        ) : (
                          <Globe className="w-3 h-3" />
                        )}
                        <span>{doc.access_level}</span>
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                          doc.status === "indexed"
                            ? "bg-emerald-100 text-emerald-800"
                            : doc.status === "processing"
                            ? "bg-blue-100 text-blue-800 animate-pulse"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {doc.status === "indexed" && <Check className="w-3 h-3" />}
                        <span>{doc.status}</span>
                      </span>
                    </td>
                    <td className="p-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleInspect(doc.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Inspect Extracted Chunks"
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
                              className="p-1.5 rounded-lg text-slate-500 hover:text-amber-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Configure Access Policy"
                            >
                              <Shield className="w-4 h-4" />
                            </button>

                            {doc.status === "failed" && (
                              <button
                                onClick={() => handleRetry(doc.id)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Retry Ingestion"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}

                            <button
                              onClick={() => setDeleteDocId(doc.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-slate-100 transition-colors cursor-pointer"
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

      {/* Drag & Drop Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Upload Enterprise Document</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Supported formats: PDF, DOCX, TXT (Max 25MB)
                </p>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Drag and Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-blue-600 bg-blue-50"
                    : "border-slate-200 hover:border-blue-400 bg-slate-50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(e) => e.target.files && setUploadFiles(Array.from(e.target.files))}
                  className="hidden"
                />
                <FileUp className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                {uploadFiles.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-800">
                      {uploadFiles.length} file(s) selected:
                    </p>
                    <p className="text-xs text-blue-700 truncate font-mono">
                      {uploadFiles.map((f) => f.name).join(", ")}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      Drag & drop your files here, or <span className="text-blue-600">browse</span>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Text, page numbers, and structural headings are preserved automatically
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Document Title (Optional)
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Q3 Security Compliance Policy"
                  className="w-full bg-white border border-slate-200 focus:border-blue-600 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Access Policy Enforcement
                </label>
                <select
                  value={uploadAccess}
                  onChange={(e) => setUploadAccess(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 focus:border-blue-600 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none"
                >
                  <option value="organization">Organization (All Authenticated Members)</option>
                  <option value="private">Private (Restricted to Owner/Admin Only)</option>
                  <option value="shared">Shared (Delegated User Access)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-800 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || uploadFiles.length === 0}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-40 cursor-pointer"
                >
                  {uploading ? "Ingesting..." : "Ingest Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Chunks Inspection Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl font-sans">
            {/* Header */}
            <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>{previewDoc.title}</span>
                </h3>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-3">
                  <span>Partitions: {previewDoc.total_chunks} Chunks</span>
                  <span>•</span>
                  <span>Access: <span className="uppercase text-blue-700 font-semibold">{previewDoc.access_level}</span></span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="p-5 overflow-y-auto space-y-3.5 flex-1 bg-slate-50">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={chunkSearch}
                  onChange={(e) => setChunkSearch(e.target.value)}
                  placeholder="Search within extracted chunks..."
                  className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="space-y-2.5">
                {previewDoc.chunks
                  ?.filter((c: any) =>
                    !chunkSearch ||
                    c.content.toLowerCase().includes(chunkSearch.toLowerCase()) ||
                    (c.section_title && c.section_title.toLowerCase().includes(chunkSearch.toLowerCase()))
                  )
                  .map((chunk: any) => (
                    <div
                      key={chunk.id}
                      className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1.5 text-xs shadow-xs"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                        <span className="text-blue-700 font-semibold">
                          Chunk #{chunk.chunk_index + 1} (Page {chunk.page_number || "1"})
                        </span>
                        {chunk.section_title && (
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px]">
                            {chunk.section_title}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-700 leading-relaxed font-sans">{chunk.content}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permission Edit Modal */}
      {permDoc && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600" />
                <span>Configure Document Policy</span>
              </h3>
              <button onClick={() => setPermDoc(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600">
              Configuring access rules for: <br />
              <span className="font-semibold text-slate-900 mt-1 block font-mono text-xs">{permDoc.title}</span>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-700">
                Access Level
              </label>
              <select
                value={editAccessLevel}
                onChange={(e) => setEditAccessLevel(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-blue-600 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none"
              >
                <option value="organization">Organization (All Members Can Access)</option>
                <option value="private">Private (Restricted to Admins Only)</option>
                <option value="shared">Shared (Delegated User Access)</option>
              </select>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Server-side SQL filters ensure unauthorized users can never retrieve this document or its vector chunks.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPermDoc(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePermissions}
                disabled={savingPerm}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {savingPerm ? "Updating..." : "Save Policy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteDocId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-red-200 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-xl font-sans">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Delete Document</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Are you sure you want to remove this document and all its indexed vector chunks from the knowledge base?
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteDocId(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
