"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/workspace/${workspaceId}/cases`);
  }, [workspaceId, router]);

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <div className="text-zinc-500 dark:text-zinc-400">Redirecting...</div>
    </div>
  );
}
