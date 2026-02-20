"use client";

import { use, useEffect, useState, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EditableCaseHeader } from "@/components/EditableCaseHeader";
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
  i_94: "I-94",
  i_20: "I-20",
  evidence: "Evidence",
  other: "Other",
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_review: "In Review",
  approved: "Approved",
  flagged: "Flagged",
};

/** Essential fields to show per classification. Mindee and other extractors may use different key names. */
const ESSENTIAL_FIELDS: Record<string, string[]> = {
  passport: [
    "full_name",
    "given_names",
    "surnames",
    "date_of_birth",
    "passport_number",
    "nationality",
    "date_of_expiry",
    "expiry_date",
    "expiration_date",
    "issuing_country",
  ],
  id_card: [
    "full_name",
    "name",
    "given_names",
    "surnames",
    "id_number",
    "document_number",
    "date_of_birth",
    "date_of_expiry",
    "expiry_date",
    "nationality",
  ],
  proof_of_address: [
    "address",
    "full_address",
    "date",
    "issue_date",
    "issuer",
    "name",
  ],
  proof_of_funds: [
    "account_holder",
    "account_holder_name",
    "account_holder_names",
    "balance",
    "amount",
    "total_credits",
    "total_debits",
    "date",
    "issuer",
    "bank_name",
  ],
  birth_certificate: [
    "full_name",
    "name",
    "date_of_birth",
    "place_of_birth",
    "issuing_authority",
  ],
  immigration_form: [
    "form_type",
    "applicant_name",
    "date",
    "status",
  ],
  i_94: [
    "admission_number",
    "i94_number",
    "date_of_birth",
    "passport_number",
    "full_name",
    "given_names",
    "surnames",
    "admission_date",
    "class_of_admission",
    "country_of_citizenship",
    "expiration_date",
    "date_of_expiry",
  ],
  i_20: [
    "student_name",
    "full_name",
    "given_names",
    "surnames",
    "sevis_id",
    "sevis_number",
    "school_name",
    "program_of_study",
    "degree_level",
    "start_date",
    "end_date",
    "expiration_date",
    "date_of_birth",
    "country_of_citizenship",
    "major",
  ],
  evidence: ["description", "date", "type"],
  other: [], // show all
};

/** Canonical keys for passport validation. Check these (or variants) for required fields. */
const PASSPORT_REQUIRED_KEYS = [
  ["full_name", "given_names", "surnames"],
  "date_of_birth",
  "passport_number",
  "nationality",
  ["date_of_expiry", "expiry_date", "expiration_date"],
] as const;

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

function getValueFromObj(
  obj: Record<string, unknown>,
  keys: string | readonly string[]
): string | null {
  const arr = Array.isArray(keys) ? keys : [keys];
  for (const k of arr) {
    const v = obj[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return null;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

type PassportStatus = "valid" | "expired" | "missing" | "incomplete";

function getPassportStatus(data: Record<string, unknown>): PassportStatus {
  const hasName =
    getValueFromObj(data, "full_name") ||
    (getValueFromObj(data, "given_names") && getValueFromObj(data, "surnames"));
  const hasDob = getValueFromObj(data, "date_of_birth");
  const hasPassportNum = getValueFromObj(data, "passport_number");
  const hasNationality = getValueFromObj(data, "nationality");
  const expiryStr = getValueFromObj(data, [
    "date_of_expiry",
    "expiry_date",
    "expiration_date",
  ]);
  const expiryDate = parseDate(expiryStr);

  const required = [hasName, hasDob, hasPassportNum, hasNationality, expiryStr];
  const missingCount = required.filter((v) => !v).length;
  if (missingCount === required.length) return "missing";
  if (missingCount > 0) return "incomplete";

  if (expiryDate && expiryDate < new Date()) return "expired";
  return "valid";
}

function getEssentialFieldsForDoc(
  doc: CaseDocument,
  essentialKeys: string[]
): [string, unknown][] {
  if (!doc.extractedData) return [];
  try {
    const obj = JSON.parse(doc.extractedData) as Record<string, unknown>;
    const entries: [string, unknown][] = [];
    const seen = new Set<string>();

    for (const key of essentialKeys) {
      const v = obj[key];
      if (v == null || typeof v === "function") continue;
      const str = typeof v === "object" ? JSON.stringify(v) : String(v);
      if (str.trim() && !seen.has(key)) {
        seen.add(key);
        entries.push([key, v]);
      }
    }

    if (essentialKeys.length === 0) {
      for (const [k, v] of Object.entries(obj)) {
        if (v == null || typeof v === "function") continue;
        const str = typeof v === "object" ? JSON.stringify(v) : String(v);
        if (str.trim() && !seen.has(k)) {
          seen.add(k);
          entries.push([k, v]);
        }
      }
    }
    return entries;
  } catch {
    return [];
  }
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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [collapsedMergedDocs, setCollapsedMergedDocs] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const s = localStorage.getItem("case-review-panels");
      if (s) setCollapsed(JSON.parse(s));
    } catch {
      /* ignore */
    }
  }, []);

  const togglePanel = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("case-review-panels", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggleMergedDocCollapse = useCallback((docId: string) => {
    setCollapsedMergedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  }, []);

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
              where: {
                and: [{ "case.id": caseId }, { deletedAt: { $isNull: true } }],
              },
              order: { createdAt: "desc" },
            },
          },
        }
      : null
  );

  const caseData = data?.cases?.[0] as { id: string; clientName: string; caseType: string; status?: string | null } | undefined;
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

  const { docsWithExtraction, docsWithoutExtraction } = useMemo(() => {
    const withExt: CaseDocument[] = [];
    const withoutExt: CaseDocument[] = [];
    for (const doc of documents) {
      const hasData =
        doc.extractedData &&
        (() => {
          try {
            const obj = JSON.parse(doc.extractedData!) as Record<string, unknown>;
            return Object.keys(obj).some(
              (k) => obj[k] != null && String(obj[k]).trim()
            );
          } catch {
            return false;
          }
        })();
      if (hasData) withExt.push(doc);
      else withoutExt.push(doc);
    }
    return { docsWithExtraction: withExt, docsWithoutExtraction: withoutExt };
  }, [documents]);

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

  const handleRemoveDocument = useCallback(
    async (doc: { id: string; name: string }) => {
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
        if (selectedId === doc.id) setSelectedId(null);
        toast.success("Document removed from case");
      } catch {
        toast.error("Failed to remove document");
      }
    },
    [selectedId]
  );

  const lastSavedByUsRef = useRef<{ docId: string; data: string } | null>(null);
  const prevExtractedRef = useRef<{ docId: string; data: string } | null>(null);

  const updateExtractedField = useCallback(
    async (docId: string, fieldKey: string, value: unknown) => {
      const doc = documents.find((d) => d.id === docId);
      if (!doc?.extractedData) return;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(doc.extractedData) as Record<string, unknown>;
      } catch {
        return;
      }
      const updated = { ...parsed, [fieldKey]: value };
      const newData = JSON.stringify(updated);
      try {
        await db.transact([
          db.tx.caseDocuments[docId].update({ extractedData: newData }),
        ]);
        lastSavedByUsRef.current = { docId, data: newData };
        toast.success("Extracted field updated");
      } catch {
        toast.error("Failed to update extracted field");
      }
    },
    [documents]
  );

  useEffect(() => {
    if (!selectedDoc?.extractedData) return;
    const current = { docId: selectedDoc.id, data: selectedDoc.extractedData };
    const prev = prevExtractedRef.current;
    const lastSaved = lastSavedByUsRef.current;

    if (lastSaved?.docId === current.docId && lastSaved?.data === current.data) {
      lastSavedByUsRef.current = null;
      prevExtractedRef.current = current;
      return;
    }
    if (prev?.docId === current.docId && prev?.data !== current.data) {
      toast.info("Extracted data was updated");
    }
    prevExtractedRef.current = current;
  }, [selectedDoc?.id, selectedDoc?.extractedData]);

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
        <EditableCaseHeader
          workspaceId={workspaceId}
          caseId={caseId}
          clientName={caseData.clientName}
          caseType={caseData.caseType}
          status={caseData.status}
          backHref={`/workspace/${workspaceId}/cases/${caseId}`}
          backLabel={`Back to ${caseData.clientName}`}
        />
        <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">Case Review</p>
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

      <div
        className="grid min-h-0 flex-1 overflow-hidden transition-[grid-template-columns] duration-300 ease-out"
        style={{
          gridTemplateColumns: [
            `${collapsed.docList ? 52 : 280}px`,
            collapsed.viewer ? "52px" : "minmax(0, 3fr)",
            collapsed.fieldInfo ? "52px" : "minmax(280px, 1fr)",
            collapsed.merged ? "52px" : "minmax(240px, 1fr)",
          ].join(" "),
        }}
      >
        {/* Left: Document list */}
        <aside className="flex flex-col overflow-hidden border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-3 py-3 dark:border-zinc-800">
            {collapsed.docList ? (
              <button
                type="button"
                onClick={() => togglePanel("docList")}
                className="flex h-full w-full flex-col items-center justify-center gap-1 py-4 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                title="Expand document list"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-[10px] font-medium uppercase tracking-wider">Docs</span>
              </button>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  All Documents
                </h2>
                <button
                  type="button"
                  onClick={() => togglePanel("docList")}
                  className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  title="Collapse"
                  aria-label="Collapse document list"
                >
                  <svg className="h-4 w-4 -rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>
          {!collapsed.docList && (
            <>
              <div className="border-b border-zinc-200 px-3 dark:border-zinc-800">
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
                    <li key={doc.id} className="group flex items-stretch gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedId(doc.id)}
                        className={`min-w-0 flex-1 rounded-lg px-3 py-2.5 text-left transition-colors ${
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
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveDocument(doc);
                        }}
                        className={`shrink-0 self-center rounded p-1.5 text-zinc-400 transition-opacity hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 ${isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                        title="Remove from case"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
              </div>
            </>
          )}
        </aside>

        {/* Center: Document viewer */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden border-x border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
          {collapsed.viewer ? (
            <button
              type="button"
              onClick={() => togglePanel("viewer")}
              className="flex h-full w-full flex-col items-center justify-center gap-1 py-4 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              title="Expand document viewer"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-[10px] font-medium uppercase tracking-wider">Viewer</span>
            </button>
          ) : (
            <>
              <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {selectedDoc ? (CLASSIFICATION_LABELS[selectedDoc.classification] ?? selectedDoc.classification) : "Document"}
                </span>
                <button
                  type="button"
                  onClick={() => togglePanel("viewer")}
                  className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                  title="Collapse"
                  aria-label="Collapse document viewer"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <DocumentViewer
                  file={viewFile}
                  mimeType={selectedDoc?.mimeType ?? "application/pdf"}
                  isLoading={!!(selectedId && fileLoading)}
                />
              </div>
            </>
          )}
        </main>

        {/* Right: Field information */}
        <aside className="flex flex-col overflow-hidden border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            {collapsed.fieldInfo ? (
              <button
                type="button"
                onClick={() => togglePanel("fieldInfo")}
                className="flex h-full w-full flex-col items-center justify-center gap-1 py-4 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                title="Expand field information"
              >
                <svg className="h-5 w-5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-[10px] font-medium uppercase tracking-wider">Fields</span>
              </button>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  Field Information
                </h2>
                <button
                  type="button"
                  onClick={() => togglePanel("fieldInfo")}
                  className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  title="Collapse"
                  aria-label="Collapse field information"
                >
                  <svg className="h-4 w-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>
          {!collapsed.fieldInfo && (
            <>
              {selectedDoc && (
                <div className="border-b border-zinc-200 px-4 pb-3 dark:border-zinc-800">
                  <div className="flex gap-2">
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
                </div>
              )}
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
                {parsedFields.map(([key, value]) => {
                  const displayValue =
                    typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value ?? "");
                  return (
                    <div key={`${selectedDoc.id}-${key}`}>
                      <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {humanizeFieldKey(key)}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          defaultValue={displayValue}
                          onBlur={(e) =>
                            updateExtractedField(selectedDoc.id, key, e.target.value)
                          }
                          onClick={(e) => {
                            const input = e.target as HTMLInputElement;
                            input.select();
                            navigator.clipboard.writeText(input.value);
                            toast.success("Copied to clipboard");
                          }}
                          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 pr-10 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            const input = (e.currentTarget as HTMLElement)
                              .previousElementSibling as HTMLInputElement;
                            const value = input?.value ?? displayValue;
                            navigator.clipboard.writeText(value);
                            toast.success("Copied to clipboard");
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                          title="Copy"
                          aria-label="Copy"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
              </div>
            </>
          )}
        </aside>

        {/* Right: Merged case data from all documents */}
        <aside className="flex flex-col overflow-hidden border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            {collapsed.merged ? (
              <button
                type="button"
                onClick={() => togglePanel("merged")}
                className="flex h-full w-full flex-col items-center justify-center gap-1 py-4 text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                title="Expand merged data"
              >
                <svg className="h-5 w-5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-[10px] font-medium uppercase tracking-wider">Merged</span>
              </button>
            ) : (
              <>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Merged (all documents)
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    Combined extracted fields from this case
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => togglePanel("merged")}
                  className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  title="Collapse"
                  aria-label="Collapse merged data"
                >
                  <svg className="h-4 w-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>
          {!collapsed.merged && (
          <div className="flex-1 overflow-y-auto p-4">
            {docsWithExtraction.length === 0 && docsWithoutExtraction.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No documents in this case
              </p>
            ) : (
              <div className="space-y-6">
                {docsWithExtraction.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      With extracted data
                    </h3>
                    <div className="space-y-4">
                      {docsWithExtraction.map((doc) => {
                        const essentialKeys =
                          ESSENTIAL_FIELDS[doc.classification] ??
                          ESSENTIAL_FIELDS.other;
                        const fields = getEssentialFieldsForDoc(doc, essentialKeys);
                        const isPassport = doc.classification === "passport";
                        let passportStatus: PassportStatus | null = null;
                        if (isPassport && doc.extractedData) {
                          try {
                            const obj = JSON.parse(
                              doc.extractedData
                            ) as Record<string, unknown>;
                            passportStatus = getPassportStatus(obj);
                          } catch {
                            passportStatus = "incomplete";
                          }
                        }
                        const isCollapsed = collapsedMergedDocs.has(doc.id);

                        return (
                          <div
                            key={doc.id}
                            className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-900/30"
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleMergedDocCollapse(doc.id)
                                  }
                                  className="flex w-full items-center gap-1.5 text-left"
                                >
                                  <svg
                                    className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${
                                      isCollapsed ? "-rotate-90" : ""
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                                    {CLASSIFICATION_LABELS[doc.classification] ??
                                      doc.classification}
                                  </span>
                                </button>
                              </div>
                              {passportStatus && (
                                <span
                                  className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                                    passportStatus === "valid"
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                                      : passportStatus === "expired"
                                        ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200"
                                        : passportStatus === "incomplete"
                                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                                          : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                                  }`}
                                >
                                  {passportStatus === "valid"
                                    ? "Valid"
                                    : passportStatus === "expired"
                                      ? "Expired"
                                      : passportStatus === "incomplete"
                                        ? "Incomplete"
                                        : "Missing"}
                                </span>
                              )}
                            </div>
                            <p className="mb-2 truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {doc.name}
                            </p>
                            {isCollapsed && (() => {
                              if (!doc.extractedData) return null;
                              try {
                                const o = JSON.parse(doc.extractedData) as Record<string, unknown>;
                                const summary =
                                  doc.classification === "proof_of_funds"
                                    ? (o.account_holder ?? o.account_holder_name ?? o.account_holder_names ?? o.bank_name ?? o.issuer) as string
                                    : doc.classification === "i_94"
                                      ? (o.full_name ?? o.admission_number ?? o.i94_number ?? o.passport_number ?? o.class_of_admission) as string
                                      : doc.classification === "i_20"
                                        ? (o.student_name ?? o.full_name ?? o.school_name ?? o.sevis_id ?? o.program_of_study) as string
                                      : (o.full_name ?? o.name ?? o.given_names ?? o.account_holder ?? o.address ?? o.form_type ?? o.description) as string;
                                return summary ? (
                                  <p className="text-xs text-zinc-600 dark:text-zinc-300">
                                    {String(summary)}
                                  </p>
                                ) : null;
                              } catch {
                                return null;
                              }
                            })()}
                            {!isCollapsed && (
                              <>
                                {fields.length === 0 ? (
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                    No essential fields extracted
                                  </p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {fields.map(([key, value]) => {
                                      const displayValue =
                                        typeof value === "object"
                                          ? JSON.stringify(value)
                                          : String(value ?? "");
                                      return (
                                        <div key={key}>
                                          <label className="mb-0.5 block text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                                            {humanizeFieldKey(key)}
                                          </label>
                                          <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => {
                                              navigator.clipboard.writeText(
                                                displayValue
                                              );
                                              toast.success(
                                                "Copied to clipboard"
                                              );
                                            }}
                                            onKeyDown={(e) => {
                                              if (
                                                e.key === "Enter" ||
                                                e.key === " "
                                              ) {
                                                e.preventDefault();
                                                navigator.clipboard.writeText(
                                                  displayValue
                                                );
                                                toast.success(
                                                  "Copied to clipboard"
                                                );
                                              }
                                            }}
                                            className="rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 cursor-pointer hover:bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800/50"
                                          >
                                            <span className="line-clamp-2 break-words">
                                              {displayValue || "—"}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
                {docsWithoutExtraction.length > 0 && (
                  <section>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Without extracted data
                    </h3>
                    <ul className="space-y-1.5">
                      {docsWithoutExtraction.map((doc) => (
                        <li
                          key={doc.id}
                          className="flex items-center justify-between gap-2 rounded border border-zinc-200 bg-zinc-50/30 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900/20"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                              {CLASSIFICATION_LABELS[doc.classification] ??
                                doc.classification}
                            </span>
                            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {doc.name}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </div>
          )}
        </aside>
      </div>
    </div>
  );
}
