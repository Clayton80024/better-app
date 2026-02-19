"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/WorkspaceContext";

export default function CasesRedirectPage() {
  const router = useRouter();
  const { currentWorkspace, isLoading } = useWorkspace();

  useEffect(() => {
    if (isLoading) return;
    if (currentWorkspace) {
      router.replace(`/workspace/${currentWorkspace.id}/cases`);
    }
  }, [currentWorkspace, isLoading, router]);

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <div className="text-zinc-500 dark:text-zinc-400">Redirecting...</div>
    </div>
  );
}
