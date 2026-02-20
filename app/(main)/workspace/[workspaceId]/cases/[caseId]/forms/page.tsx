"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EditableCaseHeader } from "@/components/EditableCaseHeader";
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

  const caseData = data?.cases?.[0] as { clientName: string; caseType: string; status?: string | null } | undefined;

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
        <EditableCaseHeader
          workspaceId={workspaceId}
          caseId={caseId}
          clientName={caseData.clientName}
          caseType={caseData.caseType}
          status={caseData.status}
          backHref={`/workspace/${workspaceId}/cases/${caseId}`}
          backLabel={`Back to ${caseData.clientName}`}
        />
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Forms</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <FormModeFormsPlaceholder />
      </div>
    </div>
  );
}
