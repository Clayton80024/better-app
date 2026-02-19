"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/WorkspaceContext";

export default function CaseReviewRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: caseId } = use(params);
  const router = useRouter();
  const { currentWorkspace, isLoading } = useWorkspace();

  useEffect(() => {
    if (isLoading) return;
    if (currentWorkspace) {
      router.replace(`/workspace/${currentWorkspace.id}/cases/${caseId}/review`);
    }
  }, [currentWorkspace, caseId, isLoading, router]);

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <div className="text-zinc-500 dark:text-zinc-400">Redirecting...</div>
    </div>
  );
}
