"use client";

import { use, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EditableCaseHeader } from "@/components/EditableCaseHeader";
import { useWorkspace } from "@/components/WorkspaceContext";
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
  classification: string;
  deletedAt?: number;
};

export default function CaseTrashPage({
  params,
}: {
  params: Promise<{ workspaceId: string; caseId: string }>;
}) {
  const { workspaceId, caseId } = use(params);
  const router = useRouter();
  const { user } = db.useAuth();
  const { currentWorkspace } = useWorkspace();

  const { data, isLoading } = db.useQuery(
    user && currentWorkspace && caseId
      ? {
          cases: {
            $: { where: { id: caseId, "workspace.id": currentWorkspace.id } },
          },
          caseDocuments: {
            $: {
              where: {
                and: [
                  { "case.id": caseId },
                  { deletedAt: { $isNull: false } },
                ],
              },
              order: { deletedAt: "desc" },
            },
          },
        }
      : null
  );

  const caseData = data?.cases?.[0] as {
    clientName: string;
    caseType: string;
    status?: string | null;
  } | undefined;
  const deletedDocuments = (data?.caseDocuments ?? []) as CaseDocument[];

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  const handleRestore = useCallback(
    async (doc: CaseDocument) => {
      try {
        await db.transact([
          db.tx.caseDocuments[doc.id].update({ deletedAt: null }),
        ]);
        toast.success("Document restored");
      } catch {
        toast.error("Failed to restore document");
      }
    },
    []
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

  return (
    <div className="mx-auto flex h-[calc(100vh-57px)] max-w-2xl flex-col">
      <header className="shrink-0 border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <EditableCaseHeader
          workspaceId={workspaceId}
          caseId={caseId}
          clientName={caseData.clientName}
          caseType={caseData.caseType}
          status={caseData.status}
          backHref={`/workspace/${workspaceId}/cases/${caseId}`}
          backLabel={`Back to ${caseData.clientName}`}
        />
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Documents removed from this case. Restore to add them back.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {deletedDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50/50 py-16 dark:border-zinc-700 dark:bg-zinc-800/30">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No removed documents
            </p>
            <Link
              href={`/workspace/${workspaceId}/cases/${caseId}?tab=documents`}
              className="mt-3 text-sm text-emerald-600 hover:underline dark:text-emerald-400"
            >
              Back to documents
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {deletedDocuments.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {doc.name}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {CLASSIFICATION_LABELS[doc.classification] ?? doc.classification} · {formatSize(doc.size)}
                    {doc.deletedAt && (
                      <> · Removed {new Date(doc.deletedAt).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestore(doc)}
                  className="shrink-0 rounded-lg border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
