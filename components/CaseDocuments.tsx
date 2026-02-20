"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useWorkspace } from "@/components/WorkspaceContext";
import { useUpload, type UploadItem } from "@/components/UploadContext";
import { db } from "@/lib/db";

const CLASSIFICATION_LABELS: Record<string, string> = {
  passport: "Passport",
  id_card: "ID Card",
  proof_of_address: "Proof of Address",
  proof_of_funds: "Proof of Funds",
  birth_certificate: "Birth Certificate",
  immigration_form: "Immigration Form",
  i_94: "I-94",
  i_20: "I-20",
  evidence: "Evidence",
  other: "Other",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type CaseDocument = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  storageKey: string;
  url: string;
  classification: string;
  extractedData?: string | null;
  status: string;
  createdAt: number;
};

export function CaseDocuments({
  caseId,
  userId,
}: {
  caseId: string;
  userId: string;
}) {
  const { user } = db.useAuth();
  const { currentWorkspace } = useWorkspace();
  const {
    addFilesToQueue,
    removeFromQueue,
    clearCompleted,
    getQueueForCase,
    isUploading,
  } = useUpload();
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const lastAddRef = useRef<{ key: string; at: number } | null>(null);
  const dropHandledAtRef = useRef<number>(0);
  const addInProgressRef = useRef(false);

  const uploadQueue = getQueueForCase(caseId);

  const { data } = db.useQuery(
    userId && currentWorkspace && caseId
      ? {
          caseDocuments: {
            $: {
              where: {
                and: [{ "case.id": caseId }, { deletedAt: { $isNull: true } }],
              },
              order: { createdAt: "desc" },
            },
          },
        }
      : null
  );

  type DocumentsQueryResult = { caseDocuments?: CaseDocument[] };
  const typedData = data as DocumentsQueryResult | null | undefined;
  const documents = (typedData?.caseDocuments ?? []) as CaseDocument[];

  const grouped = documents.reduce<Record<string, CaseDocument[]>>((acc, doc) => {
    const key = doc.classification || "other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  const order = [
    "passport",
    "id_card",
    "proof_of_address",
    "proof_of_funds",
    "birth_certificate",
    "immigration_form",
    "i_94",
    "i_20",
    "evidence",
    "other",
  ];

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      if (addInProgressRef.current) return;
      const token = (user as { refresh_token?: string } | null)?.refresh_token;
      if (!token) {
        setUploadError("Session expired. Please sign in again.");
        return;
      }
      const MAX_SIZE = 25 * 1024 * 1024;
      const fileArray = Array.from(files);
      const valid = fileArray.filter((f) => {
        if (!f.type.startsWith("image/") && f.type !== "application/pdf")
          return false;
        if (f.size > MAX_SIZE) return false;
        return true;
      });
      const invalid = fileArray.length - valid.length;
      if (invalid > 0) {
        setUploadError(
          `${invalid} file(s) skipped. Use PDF or images (JPEG, PNG, WebP), max 25MB each.`
        );
      }
      if (valid.length === 0) return;

      const key = valid
        .map((f) => `${f.name}:${f.size}`)
        .sort()
        .join("|");
      const now = Date.now();
      const last = lastAddRef.current;
      if (last && now - last.at < 800 && last.key === key) {
        return;
      }
      lastAddRef.current = { key, at: now };
      addInProgressRef.current = true;

      setUploadError("");
      addFilesToQueue(caseId, valid, token);
      setTimeout(() => {
        addInProgressRef.current = false;
      }, 400);
    },
    [caseId, user, addFilesToQueue]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      dropHandledAtRef.current = Date.now();
      const files = e.dataTransfer.files;
      if (files?.length) addFiles(files);
    },
    [addFiles]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) {
        e.target.value = "";
        return;
      }
      const now = Date.now();
      if (now - dropHandledAtRef.current < 300) {
        e.target.value = "";
        return;
      }
      addFiles(files);
      e.target.value = "";
    },
    [addFiles]
  );

  const handleView = useCallback(
    async (doc: CaseDocument) => {
      const token = (user as { refresh_token?: string } | null)?.refresh_token;
      if (!token) return;
      try {
        const res = await fetch(
          `/api/cases/${caseId}/documents/${doc.id}/url`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const json = await res.json();
        if (res.ok && json.url) window.open(json.url, "_blank");
      } catch {
        // ignore
      }
    },
    [caseId, user]
  );

  const handleRemove = useCallback(
    async (doc: CaseDocument) => {
      if (
        !confirm(
          `Remove "${doc.name}" from this case? It will be hidden but can be restored.`
        )
      )
        return;
      try {
        await db.transact([
          db.tx.caseDocuments[doc.id].update({ deletedAt: Date.now() }),
        ]);
        toast.success("Document removed from case");
      } catch {
        toast.error("Failed to remove document");
      }
    },
    []
  );

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Documents
      </h2>

      <input
        type="file"
        accept=".pdf,image/jpeg,image/jpg,image/png,image/webp"
        onChange={onFileSelect}
        multiple
        disabled={isUploading}
        className="hidden"
        id={`case-doc-upload-${caseId}`}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`mb-4 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragOver
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
            : "border-zinc-300 dark:border-zinc-600"
        }`}
      >
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {isUploading ? (
            <span className="text-emerald-600 dark:text-emerald-400">
              Uploading files...
            </span>
          ) : (
            <>
              Drag and drop files here, or{" "}
              <button
                type="button"
                onClick={() =>
                  document.getElementById(`case-doc-upload-${caseId}`)?.click()
                }
                className="font-medium text-emerald-600 dark:text-emerald-400 hover:underline focus:outline-none focus:underline"
              >
                click to browse
              </button>
            </>
          )}
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
          PDF, JPEG, PNG, WebP. Max 25MB per file. Multiple files supported.
        </p>
      </div>

      {uploadQueue.length > 0 && (
        <div className="mb-4 space-y-2">
          {uploadQueue.map((item) => (
            <UploadQueueItem
              key={item.id}
              item={item}
              onRemove={removeFromQueue}
            />
          ))}
          {uploadQueue.some((i) => i.status === "done" || i.status === "error") && (
            <button
              type="button"
              onClick={() => clearCompleted(caseId)}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            >
              Clear completed
            </button>
          )}
        </div>
      )}

      {uploadError && (
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">
          {uploadError}
        </p>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No documents yet. Upload files to get started.
        </p>
      ) : (
        <div className="space-y-4">
          {order.map((key) => {
            const docs = grouped[key];
            if (!docs?.length) return null;
            const label = CLASSIFICATION_LABELS[key] ?? key;
            return (
              <div key={key}>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {label}
                </h3>
                <ul className="space-y-2">
                  {docs.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                            {doc.name}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {formatSize(doc.size)} · {doc.status}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleView(doc)}
                            className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(doc)}
                            className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-zinc-600 dark:text-red-400 dark:hover:bg-red-950/30"
                            title="Remove from case"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      {doc.extractedData && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId((id) =>
                                id === doc.id ? null : doc.id
                              )
                            }
                            className="text-left text-xs text-emerald-600 dark:text-emerald-400"
                          >
                            {expandedId === doc.id ? "Hide" : "Show"} extracted
                            data
                          </button>
                          {expandedId === doc.id && (
                            <pre className="max-h-40 overflow-auto rounded bg-zinc-100 p-2 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                              {JSON.stringify(
                                JSON.parse(doc.extractedData),
                                null,
                                2
                              )}
                            </pre>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {currentWorkspace && (
        <Link
          href={`/workspace/${currentWorkspace.id}/cases/${caseId}/trash`}
          className="mt-4 inline-block text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
        >
          View removed documents →
        </Link>
      )}
    </section>
  );
}

function UploadQueueItem({
  item,
  onRemove,
}: {
  item: UploadItem;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {item.file.name}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {item.status === "pending" && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Queued
            </span>
          )}
          {item.status === "uploading" && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              Uploading {item.progress}%
            </span>
          )}
          {item.status === "extracting" && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Extracting...
            </span>
          )}
          {item.status === "done" && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">
              Done
            </span>
          )}
          {item.status === "error" && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {item.error}
            </span>
          )}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 disabled:opacity-50"
            aria-label="Remove from list"
            title={
              item.status === "uploading" || item.status === "extracting"
                ? "Cannot remove while uploading"
                : "Remove"
            }
            disabled={
              item.status === "uploading" || item.status === "extracting"
            }
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
      {(item.status === "uploading" || item.status === "extracting") && (
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
          <div
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{
              width:
                item.status === "extracting" ? "100%" : `${item.progress}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}
