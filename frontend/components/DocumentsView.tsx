"use client";

import { ArrowLeft, Download, FileUp, Lock, RefreshCw, Trash2, Upload, Users } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { AccessLevel, DirectoryEntry, DocumentDetail, DocumentItem, User } from "@/lib/types";
import { href, navigate } from "./App";
import { Button, Dialog, Field, Notice, PageHeader, Spinner, cx, formatBytes, formatDate } from "./ui";

const ACCEPT = ".pdf,.docx,.txt,.md";

const ACCESS_COPY: Record<AccessLevel, { label: string; detail: string }> = {
  organization: { label: "Everyone", detail: "Anyone in the workspace can search and ask about it." },
  shared: { label: "Specific people", detail: "Only the people you pick (and admins)." },
  private: { label: "Only me", detail: "Only you (and admins)." },
};

export function DocumentsView({
  user,
  openId,
  focusChunk,
  onChanged,
}: {
  user: User;
  openId?: string;
  focusChunk?: string;
  onChanged: () => void;
}) {
  if (openId) return <DocumentReader id={openId} focusChunk={focusChunk} user={user} onChanged={onChanged} />;
  return <DocumentList user={user} onChanged={onChanged} />;
}

// ------------------------------------------------------------------- list
function DocumentList({ user, onChanged }: { user: User; onChanged: () => void }) {
  const [docs, setDocs] = useState<DocumentItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [accessDoc, setAccessDoc] = useState<DocumentItem | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocumentItem | null>(null);
  const [addingSamples, setAddingSamples] = useState(false);

  const load = useCallback(() => {
    api
      .documents()
      .then((d) => {
        setDocs(d);
        setError(null);
      })
      .catch((e: ApiError) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  // Poll while anything is still being indexed.
  const processing = docs?.some((d) => d.status === "processing");
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [processing, load]);
  useEffect(() => {
    if (docs && !processing) onChanged();
  }, [processing]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (docs || []).filter((d) => !q || d.title.toLowerCase().includes(q) || d.filename.toLowerCase().includes(q));
  }, [docs, filter]);

  const reprocess = async (d: DocumentItem) => {
    try {
      await api.reprocess(d.id);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't reprocess the document.");
    }
  };

  const addSamples = async () => {
    setAddingSamples(true);
    try {
      const r = await api.addSamples();
      if (r.added.length === 0) setError("The sample documents are already in the workspace.");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't add the sample documents.");
    } finally {
      setAddingSamples(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <PageHeader
        title="Documents"
        description="Everything here can be searched and asked about by the people it's shared with. Text is extracted from PDF, Word, text and Markdown files."
        actions={
          <>
            {user.role === "admin" && docs !== null && !docs.some((d) => d.is_sample) && (
              <Button onClick={addSamples} busy={addingSamples}>
                Add sample documents
              </Button>
            )}
            <Button variant="primary" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          </>
        }
      />

      {error && (
        <Notice tone="error" className="mt-5">
          {error}
        </Notice>
      )}

      {docs === null && !error && (
        <div className="mt-12 flex justify-center text-graphite">
          <Spinner />
        </div>
      )}

      {docs && docs.length === 0 && (
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="mt-8 flex w-full flex-col items-center rounded-lg border border-dashed border-rule px-6 py-14 text-center hover:border-teal"
        >
          <FileUp className="h-6 w-6 text-teal" />
          <span className="mt-3 font-medium">Upload your first document</span>
          <span className="mt-1 text-sm text-graphite">PDF, DOCX, TXT or Markdown, up to 25 MB each</span>
        </button>
      )}

      {docs && docs.length > 0 && (
        <>
          <div className="mt-6">
            <label htmlFor="doc-filter" className="sr-only">
              Filter documents
            </label>
            <input
              id="doc-filter"
              className="field max-w-xs"
              placeholder="Filter by title"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
          <ul className="mt-4 divide-y divide-rule border-y border-rule">
            {shown.map((d) => (
              <li key={d.id} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2.5">
                    <a href={href({ view: "documents", id: d.id })} className="truncate font-medium hover:text-teal">
                      {d.title}
                    </a>
                    {d.is_sample && <span className="text-xs text-faint">Sample</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-graphite">
                    <span className="uppercase tracking-wide text-faint">{d.file_type}</span>
                    <span>{formatBytes(d.file_size)}</span>
                    <span>{d.owner_id === user.id ? "Added by you" : `Added by ${d.owner_name || "someone"}`}</span>
                    <span>{formatDate(d.created_at)}</span>
                  </div>
                  {d.status === "failed" && <p className="mt-1 text-sm text-danger">{d.error_message || "Indexing failed."}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusLabel doc={d} />
                  <AccessLabel doc={d} onClick={d.can_manage ? () => setAccessDoc(d) : undefined} />
                  {d.can_manage && (
                    <div className="flex">
                      {d.status === "failed" && (
                        <Button size="sm" variant="ghost" onClick={() => reprocess(d)} aria-label={`Reprocess ${d.title}`}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setDeleteDoc(d)} aria-label={`Delete ${d.title}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
            {shown.length === 0 && <li className="py-6 text-sm text-graphite">No documents match “{filter}”.</li>}
          </ul>
        </>
      )}

      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} user={user} onUploaded={load} />
      {accessDoc && (
        <AccessDialog
          doc={accessDoc}
          user={user}
          onClose={() => setAccessDoc(null)}
          onSaved={() => {
            setAccessDoc(null);
            load();
          }}
        />
      )}
      <DeleteDialog
        doc={deleteDoc}
        onClose={() => setDeleteDoc(null)}
        onDeleted={() => {
          setDeleteDoc(null);
          load();
          onChanged();
        }}
      />
    </div>
  );
}

function StatusLabel({ doc }: { doc: DocumentItem }) {
  if (doc.status === "processing")
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-graphite">
        <Spinner className="h-3 w-3" /> Indexing
      </span>
    );
  if (doc.status === "failed") return <span className="text-sm font-medium text-danger">Failed</span>;
  return <span className="text-sm text-graphite">{doc.chunk_count} passages</span>;
}

function AccessLabel({ doc, onClick }: { doc: DocumentItem; onClick?: () => void }) {
  const Icon = doc.access_level === "organization" ? Users : Lock;
  const label =
    doc.access_level === "shared" && doc.can_manage
      ? `${doc.shared_with.length} ${doc.shared_with.length === 1 ? "person" : "people"}`
      : ACCESS_COPY[doc.access_level].label;
  const content = (
    <>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </>
  );
  const cls = "inline-flex min-w-[7.5rem] items-center gap-1.5 rounded px-2 py-1 text-sm text-graphite";
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(cls, "hover:bg-sunk hover:text-ink")} title="Change who can access this">
      {content}
    </button>
  ) : (
    <span className={cls}>{content}</span>
  );
}

// ---------------------------------------------------------------- dialogs
function AccessPicker({
  user,
  level,
  onLevel,
  selected,
  onSelected,
}: {
  user: User;
  level: AccessLevel;
  onLevel: (l: AccessLevel) => void;
  selected: string[];
  onSelected: (ids: string[]) => void;
}) {
  const [people, setPeople] = useState<DirectoryEntry[] | null>(null);
  useEffect(() => {
    if (level === "shared" && people === null) api.directory().then(setPeople).catch(() => setPeople([]));
  }, [level, people]);

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Who can access it</legend>
      <div className="space-y-1">
        {(Object.keys(ACCESS_COPY) as AccessLevel[]).map((l) => (
          <label
            key={l}
            className={cx(
              "flex cursor-pointer gap-3 rounded border px-3 py-2",
              level === l ? "border-teal bg-teal-wash" : "border-rule hover:bg-sunk",
            )}
          >
            <input type="radio" name="access" className="mt-1 accent-[var(--teal)]" checked={level === l} onChange={() => onLevel(l)} />
            <span>
              <span className="block text-sm font-medium">{ACCESS_COPY[l].label}</span>
              <span className="block text-sm text-graphite">{ACCESS_COPY[l].detail}</span>
            </span>
          </label>
        ))}
      </div>
      {level === "shared" && (
        <div className="mt-3 rounded border border-rule">
          {people === null && (
            <div className="flex justify-center p-4 text-graphite">
              <Spinner />
            </div>
          )}
          {people && people.filter((p) => p.id !== user.id).length === 0 && (
            <p className="p-3 text-sm text-graphite">There's no one else in the workspace yet.</p>
          )}
          <ul className="max-h-48 overflow-y-auto scroll-thin">
            {people
              ?.filter((p) => p.id !== user.id)
              .map((p) => (
                <li key={p.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-sunk">
                    <input
                      type="checkbox"
                      className="accent-[var(--teal)]"
                      checked={selected.includes(p.id)}
                      onChange={(e) => onSelected(e.target.checked ? [...selected, p.id] : selected.filter((x) => x !== p.id))}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{p.full_name}</span>
                      <span className="block truncate text-xs text-graphite">{p.email}</span>
                    </span>
                  </label>
                </li>
              ))}
          </ul>
        </div>
      )}
    </fieldset>
  );
}

function UploadDialog({ open, onClose, user, onUploaded }: { open: boolean; onClose: () => void; user: User; onUploaded: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState<AccessLevel>("organization");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFiles([]);
    setTitle("");
    setLevel("organization");
    setSelected([]);
    setErrors([]);
  };
  const close = () => {
    if (busy) return;
    reset();
    onClose();
  };

  const submit = async () => {
    setBusy(true);
    const failed: string[] = [];
    for (const f of files) {
      try {
        await api.upload(f, {
          title: files.length === 1 ? title.trim() || undefined : undefined,
          access_level: level,
          user_ids: level === "shared" ? selected : [],
        });
      } catch (e) {
        failed.push(`${f.name}: ${e instanceof ApiError ? e.message : "upload failed"}`);
      }
    }
    setBusy(false);
    onUploaded();
    if (failed.length) {
      setErrors(failed);
      setFiles(files.filter((f) => failed.some((m) => m.startsWith(f.name + ":"))));
    } else {
      reset();
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      title="Upload documents"
      onClose={close}
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} busy={busy} disabled={!files.length || (level === "shared" && !selected.length)}>
            {files.length > 1 ? `Upload ${files.length} files` : "Upload"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            setFiles(Array.from(e.dataTransfer.files));
          }}
          className={cx("rounded-md border border-dashed px-4 py-6 text-center", dragging ? "border-teal bg-teal-wash" : "border-rule")}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          {files.length === 0 ? (
            <>
              <p className="text-sm">Drop files here, or</p>
              <Button size="sm" className="mt-2" onClick={() => inputRef.current?.click()}>
                Choose files
              </Button>
              <p className="mt-2 text-xs text-graphite">PDF, DOCX, TXT or Markdown, up to 25 MB each</p>
            </>
          ) : (
            <>
              <ul className="space-y-1 text-left text-sm">
                {files.map((f) => (
                  <li key={f.name} className="flex justify-between gap-3">
                    <span className="truncate">{f.name}</span>
                    <span className="shrink-0 text-graphite">{formatBytes(f.size)}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className="mt-3 text-sm text-teal hover:underline" onClick={() => inputRef.current?.click()}>
                Choose different files
              </button>
            </>
          )}
        </div>

        {files.length === 1 && (
          <Field label="Title" hint="Optional. Defaults to the file name.">
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        )}

        <AccessPicker user={user} level={level} onLevel={setLevel} selected={selected} onSelected={setSelected} />

        {errors.length > 0 && (
          <Notice tone="error">
            <ul className="space-y-0.5">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Notice>
        )}
      </div>
    </Dialog>
  );
}

function AccessDialog({ doc, user, onClose, onSaved }: { doc: DocumentItem; user: User; onClose: () => void; onSaved: () => void }) {
  const [level, setLevel] = useState<AccessLevel>(doc.access_level);
  const [selected, setSelected] = useState<string[]>(doc.shared_with);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    try {
      await api.setAccess(doc.id, level, level === "shared" ? selected : []);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save access.");
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      title={`Access to “${doc.title}”`}
      onClose={onClose}
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} busy={busy} disabled={level === "shared" && !selected.length}>
            Save access
          </Button>
        </>
      }
    >
      <AccessPicker user={user} level={level} onLevel={setLevel} selected={selected} onSelected={setSelected} />
      {error && <Notice tone="error" className="mt-4">{error}</Notice>}
    </Dialog>
  );
}

function DeleteDialog({ doc, onClose, onDeleted }: { doc: DocumentItem | null; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!doc) return null;
  const confirm = async () => {
    setBusy(true);
    try {
      await api.deleteDocument(doc.id);
      setBusy(false);
      onDeleted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't delete the document.");
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      title="Delete document"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} busy={busy}>
            Delete document
          </Button>
        </>
      }
    >
      <p className="text-sm">
        “{doc.title}” will be removed for everyone and can no longer be used in answers. Past answers that cite it keep their
        quoted text.
      </p>
      {error && <Notice tone="error" className="mt-4">{error}</Notice>}
    </Dialog>
  );
}

// ----------------------------------------------------------------- reader
function DocumentReader({ id, focusChunk, user, onChanged }: { id: string; focusChunk?: string; user: User; onChanged: () => void }) {
  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(() => {
    api
      .document(id)
      .then(setDoc)
      .catch((e: ApiError) => setError(e.status === 404 ? "This document doesn't exist or you don't have access to it." : e.message));
  }, [id]);
  useEffect(load, [load]);

  useEffect(() => {
    if (doc?.status !== "processing") return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [doc?.status, load]);

  useEffect(() => {
    if (doc && focusChunk) document.getElementById(`chunk-${focusChunk}`)?.scrollIntoView({ block: "center" });
  }, [doc, focusChunk]);

  const back = (
    <a href={href({ view: "documents" })} className="inline-flex items-center gap-1.5 text-sm text-graphite hover:text-ink">
      <ArrowLeft className="h-4 w-4" /> All documents
    </a>
  );

  if (error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
        {back}
        <Notice tone="error" className="mt-6">
          {error}
        </Notice>
      </div>
    );
  if (!doc)
    return (
      <div className="flex justify-center py-20 text-graphite">
        <Spinner />
      </div>
    );

  // Group consecutive chunks under their section heading, hiding the overlap
  // that indexing repeats between neighbouring chunks.
  const groups: { title: string | null; page: number | null; chunks: (DocumentDetail["chunks"][number] & { text: string })[] }[] = [];
  doc.chunks.forEach((c, i) => {
    const prev = doc.chunks[i - 1];
    const text = prev && prev.section_title === c.section_title ? trimOverlap(prev.content, c.content) : c.content;
    const last = groups[groups.length - 1];
    if (last && last.title === c.section_title) last.chunks.push({ ...c, text });
    else groups.push({ title: c.section_title, page: c.page_number, chunks: [{ ...c, text }] });
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-10">
      {back}
      <header className="mt-5 border-b border-rule pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">{doc.title}</h1>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-graphite">
          <span>{doc.filename}</span>
          <span>{formatBytes(doc.file_size)}</span>
          {doc.page_count ? <span>{doc.page_count} pages</span> : null}
          <span>{doc.owner_id === user.id ? "Added by you" : `Added by ${doc.owner_name}`}</span>
          <span>{ACCESS_COPY[doc.access_level].label}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => api.downloadDocument(doc).catch((e) => setError(e.message))}>
            <Download className="h-4 w-4" /> Download original
          </Button>
          {doc.can_manage && (
            <>
              <Button size="sm" onClick={() => setAccessOpen(true)}>
                <Users className="h-4 w-4" /> Change access
              </Button>
              <Button
                size="sm"
                disabled={doc.status === "processing"}
                title="Extract and index the text again"
                onClick={() =>
                  api
                    .reprocess(doc.id)
                    .then(load)
                    .catch((e) => setError(e.message))
                }
              >
                <RefreshCw className="h-4 w-4" /> Reprocess
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </>
          )}
        </div>
      </header>

      {doc.status === "processing" && (
        <Notice className="mt-6">
          <span className="inline-flex items-center gap-2">
            <Spinner className="h-3 w-3" /> Extracting and indexing text. This page updates when it's done.
          </span>
        </Notice>
      )}
      {doc.status === "failed" && (
        <Notice tone="error" className="mt-6">
          {doc.error_message || "Indexing failed."}
        </Notice>
      )}

      <div className="mt-6 space-y-8">
        {groups.map((g, gi) => (
          <section key={gi}>
            {(g.title || g.page) && (
              <h2 className="mb-2 flex items-baseline justify-between gap-4 text-sm font-semibold">
                <span>{g.title}</span>
                {g.page ? <span className="font-normal text-faint">Page {g.page}</span> : null}
              </h2>
            )}
            {g.chunks.map((c) => (
              <p
                key={c.id}
                id={`chunk-${c.id}`}
                className={cx(
                  "whitespace-pre-line rounded font-serif text-lg leading-relaxed",
                  c.id === focusChunk ? "-mx-2 bg-marker px-2 py-1 text-ink" : "text-ink",
                )}
              >
                {c.text}
              </p>
            ))}
          </section>
        ))}
      </div>

      {accessOpen && (
        <AccessDialog
          doc={doc}
          user={user}
          onClose={() => setAccessOpen(false)}
          onSaved={() => {
            setAccessOpen(false);
            load();
          }}
        />
      )}
      <DeleteDialog
        doc={deleteOpen ? doc : null}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          onChanged();
          navigate({ view: "documents" });
        }}
      />
    </div>
  );
}

function trimOverlap(prev: string, cur: string): string {
  const a = prev.split(/\s+/);
  const b = cur.split(/\s+/);
  for (let n = Math.min(a.length, b.length, 200); n >= 4; n--) {
    if (a.slice(-n).join(" ") === b.slice(0, n).join(" ")) return b.slice(n).join(" ");
  }
  return cur;
}
