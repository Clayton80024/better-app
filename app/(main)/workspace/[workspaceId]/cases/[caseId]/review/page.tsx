"use client";

import { use, useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/WorkspaceContext";
import { db } from "@/lib/db";

const DocumentViewer = dynamic(
  () => import("@/components/DocumentViewer").then((m) => m.DocumentViewer),
  { ssr: false }
);

const CLASSIFICATION_LABELS: Record<string, string> = {
  passport: "Passport",
  id_card: "ID Card",
  proof_of_address: "Proof of Address",
  proof_of_funds: "Proof of Funds",
  birth_certificate: "Birth Certificate",
  immigration_form: "Immigration Form",
  evidence: "Evidence",
  other: "Other",
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_review: "In Review",
  approved: "Approved",
  flagged: "Flagged",
};

type CaseDocument = {
  id: string;
  name: string;
  mimeType: string;
  classification: string;
  extractedData?: string | null;
  reviewStatus?: string | null;
};

function humanizeFieldKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CaseReviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string; caseId: string }>;
}) {
  const { workspaceId, caseId } = use(params);
  const router = useRouter();
  const { user } = db.useAuth();
  const { currentWorkspace } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewFile, setViewFile] = useState<Blob | string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  const { data, isLoading } = db.useQuery(
    user && currentWorkspace && caseId
      ? {
          cases: {
            $: { where: { id: caseId, "workspace.id": currentWorkspace.id } },
          },
          caseDocuments: {
            $: {
              where: { "case.id": caseId },
              order: { createdAt: "desc" },
            },
          },
        }
      : null
  );

  const caseData = data?.cases?.[0] as { id: string; clientName: string } | undefined;
  const documents = useMemo(
    () => (data?.caseDocuments ?? []) as CaseDocument[],
    [data?.caseDocuments]
  );
  const reviewCounts = {
    approved: documents.filter((d) => (d.reviewStatus || "pending") === "approved").length,
    in_review: documents.filter((d) => (d.reviewStatus || "pending") === "in_review").length,
    flagged: documents.filter((d) => (d.reviewStatus || "pending") === "flagged").length,
    pending: documents.filter((d) => (d.reviewStatus || "pending") === "pending").length,
  };
  const filteredDocs =
    filterStatus != null
      ? documents.filter((d) => (d.reviewStatus || "pending") === filterStatus)
      : documents;

  const selectedDoc = documents.find((d) => d.id === selectedId);

  const fetchViewFile = useCallback(
    async (docId: string) => {
      const token = (user as { refresh_token?: string } | null)?.refresh_token;
      if (!token) return;
      setFileLoading(true);
      try {
        const res = await fetch(
          `/api/cases/${caseId}/documents/${docId}/stream`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const blob = await res.blob();
          setViewFile(blob);
        } else {
          setViewFile(null);
        }
      } catch {
        setViewFile(null);
      } finally {
        setFileLoading(false);
      }
    },
    [caseId, user]
  );

  useEffect(() => {
    if (selectedId) fetchViewFile(selectedId);
    else setViewFile(null);
  }, [selectedId, fetchViewFile]);

  const updateReviewStatus = useCallback(
    (docId: string, status: string) => {
      db.transact([db.tx.caseDocuments[docId].update({ reviewStatus: status })]);
    },
    []
  );

  const updateExtractedField = useCallback(
    (docId: string, fieldKey: string, value: unknown) => {
      const doc = documents.find((d) => d.id === docId);
      if (!doc?.extractedData) return;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(doc.extractedData) as Record<string, unknown>;
      } catch {
        return;
      }
      const updated = { ...parsed, [fieldKey]: value };
      db.transact([
        db.tx.caseDocuments[docId].update({
          extractedData: JSON.stringify(updated),
        }),
      ]);
    },
    [documents]
  );

  if (!user) return null;
  if (!currentWorkspace) {
    return (
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
        <div className="text-zinc-500 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!isLoading && !caseData && data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <p className="text-zinc-500 dark:text-zinc-400">Case not found</p>
        <Link
          href={`/workspace/${workspaceId}/cases`}
          className="text-emerald-600 hover:underline dark:text-emerald-400"
        >
          Back to cases
        </Link>
      </div>
    );
  }

  if (isLoading || !caseData) {
    return (
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
        <div className="text-zinc-500 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  let parsedFields: [string, unknown][] = [];
  if (selectedDoc?.extractedData) {
    try {
      const obj = JSON.parse(selectedDoc.extractedData) as Record<string, unknown>;
      parsedFields = Object.entries(obj).filter(
        ([, v]) => v != null && typeof v !== "function"
      );
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <header className="flex shrink-0 flex-col gap-2 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/workspace/${workspaceId}/cases/${caseId}`}
              className="-ml-2 flex min-h-[36px] min-w-[36px] items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Case Review · {caseData.clientName}
            </h1>
          </div>
        </div>
        {documents.length > 0 && (
          <div className="w-full max-w-md">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                Review progress
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">
                {Math.round((reviewCounts.approved / documents.length) * 100)}%
              </span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className="bg-emerald-500 transition-all duration-300 ease-out"
                style={{ width: `${(reviewCounts.approved / documents.length) * 100}%` }}
              />
              <div
                className="bg-amber-400 transition-all duration-300 ease-out"
                style={{ width: `${(reviewCounts.in_review / documents.length) * 100}%` }}
              />
              <div
                className="bg-red-500 transition-all duration-300 ease-out"
                style={{ width: `${(reviewCounts.flagged / documents.length) * 100}%` }}
              />
              <div
                className="bg-zinc-400 dark:bg-zinc-600 transition-all duration-300 ease-out"
                style={{ width: `${(reviewCounts.pending / documents.length) * 100}%` }}
              />
            </div>
          </div>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr_320px]">
        {/* Left: Document list */}
        <aside className="flex flex-col overflow-hidden border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-3 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              All Documents
            </h2>
            <div className="mt-2 flex flex-wrap gap-1">
              {(["approved", "in_review", "flagged", "pending"] as const).map((status) => {
                const icon = status === "approved" ? "🟢" : status === "in_review" ? "🟡" : status === "flagged" ? "🔴" : "⚪";
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() =>
                      setFilterStatus((f) => (f === status ? null : status))
                    }
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      filterStatus === status
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {icon} {REVIEW_STATUS_LABELS[status]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {filteredDocs.length === 0 ? (
              <p className="px-2 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                No documents
              </p>
            ) : (
              <ul className="space-y-1">
                {filteredDocs.map((doc) => {
                  const status = doc.reviewStatus || "pending";
                  const statusIcon =
                    status === "approved" ? "🟢" : status === "in_review" ? "🟡" : status === "flagged" ? "🔴" : "⚪";
                  const isSelected = selectedId === doc.id;
                  return (
                    <li key={doc.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(doc.id)}
                        className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                          isSelected
                            ? "bg-emerald-50 dark:bg-emerald-950/30"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                        }`}
                      >
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {CLASSIFICATION_LABELS[doc.classification] ?? doc.classification}
                        </p>
                        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {doc.name}
                        </p>
                        <span
                          className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs ${
                            status === "approved"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                              : status === "flagged"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {statusIcon} {REVIEW_STATUS_LABELS[status] ?? status}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Center: Document viewer */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-50 dark:bg-zinc-900/50">
          <DocumentViewer
            file={viewFile}
            mimeType={selectedDoc?.mimeType ?? "application/pdf"}
            isLoading={!!(selectedId && fileLoading)}
          />
        </main>

        {/* Right: Field information */}
        <aside className="flex flex-col overflow-hidden border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Field Information
            </h2>
            {selectedDoc && (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => updateReviewStatus(selectedDoc.id, "approved")}
                  className="rounded px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => updateReviewStatus(selectedDoc.id, "flagged")}
                  className="rounded px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                >
                  Flag
                </button>
                <button
                  type="button"
                  onClick={() => updateReviewStatus(selectedDoc.id, "in_review")}
                  className="rounded px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  In Review
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {!selectedDoc ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Select a document to view extracted fields
              </p>
            ) : parsedFields.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No extracted data
              </p>
            ) : (
              <div className="space-y-4">
                {parsedFields.map(([key, value]) => (
                  <div key={`${selectedDoc.id}-${key}`}>
                    <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {humanizeFieldKey(key)}
                    </label>
                    <input
                      key={`${selectedDoc.id}-${key}`}
                      type="text"
                      defaultValue={
                        typeof value === "object"
                          ? JSON.stringify(value)
                          : String(value ?? "")
                      }
                      onBlur={(e) =>
                        updateExtractedField(selectedDoc.id, key, e.target.value)
                      }
                      className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
