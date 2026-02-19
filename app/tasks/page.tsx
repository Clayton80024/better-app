"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "@/components/WorkspaceContext";

function TasksRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentWorkspace, isLoading } = useWorkspace();
  const caseParam = searchParams.get("case");

  useEffect(() => {
    if (isLoading) return;
    if (currentWorkspace) {
      const query = caseParam ? `?case=${caseParam}` : "";
      router.replace(`/workspace/${currentWorkspace.id}/tasks${query}`);
    }
  }, [currentWorkspace, caseParam, isLoading, router]);

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <div className="text-zinc-500 dark:text-zinc-400">Redirecting...</div>
    </div>
  );
}

export default function TasksRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
          <div className="text-zinc-500 dark:text-zinc-400">Loading...</div>
        </div>
      }
    >
      <TasksRedirectContent />
    </Suspense>
  );
}
