"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormModeFormsPlaceholder } from "@/components/FormModeFormsPlaceholder";
import { useWorkspace } from "@/components/WorkspaceContext";
import { db } from "@/lib/db";

export default function CaseFormsPage({
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
        }
      : null
  );

  const caseData = data?.cases?.[0] as { clientName: string } | undefined;

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

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
        <Link
          href={`/workspace/${workspaceId}/cases/${caseId}`}
          className="-ml-2 mb-3 flex min-h-[36px] min-w-[36px] items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to {caseData.clientName}
        </Link>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Forms · {caseData.clientName}
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <FormModeFormsPlaceholder />
      </div>
    </div>
  );
}
