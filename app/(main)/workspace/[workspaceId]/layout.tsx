"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/WorkspaceContext";

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const { workspaces, setCurrentWorkspaceId, isLoading } = useWorkspace();

  useEffect(() => {
    if (isLoading) return;
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace && workspaces.length > 0) {
      router.replace(`/workspace/${workspaces[0].id}/cases`);
      return;
    }
    if (workspace) {
      setCurrentWorkspaceId(workspaceId);
    }
  }, [workspaceId, workspaces, isLoading, setCurrentWorkspaceId, router]);

  return <>{children}</>;
}
