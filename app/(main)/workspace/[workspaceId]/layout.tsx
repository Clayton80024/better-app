"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/WorkspaceContext";
import { db } from "@/lib/db";

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const { user } = db.useAuth();
  const { workspaces, setCurrentWorkspaceId, isLoading } = useWorkspace();

  const { data } = db.useQuery(
    user ? { $users: { $: { where: { id: user.id } } } } : null
  );
  const profile = data?.$users?.[0] as { nickname?: string | null; avatarSeed?: string | null; username?: string | null } | undefined;

  useEffect(() => {
    if (!user || !profile) return;
    const needsProfile =
      !profile.avatarSeed || !profile.nickname || !profile.username;
    if (needsProfile) {
      router.replace("/");
      return;
    }
  }, [user, profile, router]);

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
