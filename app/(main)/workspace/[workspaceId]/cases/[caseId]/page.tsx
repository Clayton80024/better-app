"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CaseDocuments } from "@/components/CaseDocuments";
import { CaseNotes } from "@/components/CaseNotes";
import { useWorkspace } from "@/components/WorkspaceContext";
import { db } from "@/lib/db";

type CaseData = {
  id: string;
  clientName: string;
  caseType: string;
  status?: string | null;
  createdAt: number;
};

type TabId = "overview" | "documents" | "notes";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "documents", label: "Documents" },
  { id: "notes", label: "Notes" },
];

export default function CaseDashboardPage({
  params,
}: {
  params: Promise<{ workspaceId: string; caseId: string }>;
}) {
  const { workspaceId, caseId } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = db.useAuth();
  const { currentWorkspace } = useWorkspace();
  const tabParam = searchParams.get("tab") as TabId | null;
  const activeTab = (tabParam && TABS.some((t) => t.id === tabParam) ? tabParam : "overview") as TabId;

  function setActiveTab(tab: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  const { data, isLoading } = db.useQuery(
    user && currentWorkspace && caseId
      ? {
          cases: {
            $: {
              where: { id: caseId, "workspace.id": currentWorkspace.id },
            },
          },
          caseDocuments: {
            $: { where: { "case.id": caseId } },
          },
        }
      : null
  );

  const caseData = data?.cases?.[0] as CaseData | undefined;
  const documents = (data?.caseDocuments ?? []) as { reviewStatus?: string | null }[];
  const reviewCounts = {
    approved: documents.filter((d) => (d.reviewStatus || "pending") === "approved").length,
    in_review: documents.filter((d) => (d.reviewStatus || "pending") === "in_review").length,
    flagged: documents.filter((d) => (d.reviewStatus || "pending") === "flagged").length,
    pending: documents.filter((d) => (d.reviewStatus || "pending") === "pending").length,
  };

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
    <div className="mx-auto flex h-[calc(100vh-57px)] max-w-3xl flex-col">
      <header className="shrink-0 border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <Link
          href={`/workspace/${workspaceId}/cases`}
          className="-ml-2 mb-3 flex min-h-[36px] min-w-[36px] items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to cases
        </Link>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {caseData.clientName}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
            {caseData.caseType}
          </span>
          {caseData.status && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {caseData.status}
            </span>
          )}
        </div>
        {documents.length > 0 && (
          <div className="mt-3">
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
                className="bg-emerald-500 transition-all"
                style={{ width: `${(reviewCounts.approved / documents.length) * 100}%` }}
              />
              <div
                className="bg-amber-400 transition-all"
                style={{ width: `${(reviewCounts.in_review / documents.length) * 100}%` }}
              />
              <div
                className="bg-red-500 transition-all"
                style={{ width: `${(reviewCounts.flagged / documents.length) * 100}%` }}
              />
              <div
                className="bg-zinc-400 dark:bg-zinc-600 transition-all"
                style={{ width: `${(reviewCounts.pending / documents.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mt-4 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as TabId)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "overview" && (
          <div className="space-y-6">
            <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Quick actions
              </h2>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/workspace/${workspaceId}/cases/${caseId}/review`}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Case Review
                </Link>
                <Link
                  href={`/workspace/${workspaceId}/cases/${caseId}/forms`}
                  className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Forms
                </Link>
              </div>
            </section>

            <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Case overview
              </h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Client</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                    {caseData.clientName}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Case type</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                    {caseData.caseType}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Status</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                    {caseData.status ?? "Active"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Created</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                    {new Date(caseData.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
        )}

        {activeTab === "documents" && (
          <CaseDocuments caseId={caseId} userId={user.id} />
        )}

        {activeTab === "notes" && (
          <CaseNotes caseId={caseId} userId={user.id} />
        )}
      </div>
    </div>
  );
}
