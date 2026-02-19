"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CompleteProfile } from "@/components/CompleteProfile";
import { InstalloLogo } from "@/components/InstalloLogo";
import { Login } from "@/components/Login";
import { useWorkspace } from "@/components/WorkspaceContext";
import { db } from "@/lib/db";

type UserWithProfile = {
  id: string;
  email?: string | null;
  isGuest?: boolean;
  nickname?: string | null;
  avatarSeed?: string | null;
  username?: string | null;
};

export default function HomePage() {
  const router = useRouter();
  const { isLoading: authLoading, user, error: authError } = db.useAuth();
  const { currentWorkspace, workspaces, isLoading: workspaceLoading } = useWorkspace();

  const { data, isLoading: queryLoading } = db.useQuery(
    user
      ? {
          $users: {
            $: { where: { id: user.id } },
          },
        }
      : null
  );

  const profile = data?.$users?.[0];
  const userWithProfile: UserWithProfile | null = user
    ? ({ ...user, ...profile } as UserWithProfile)
    : null;

  // Redirect to Cases when user is fully set up
  useEffect(() => {
    if (
      user &&
      userWithProfile &&
      currentWorkspace &&
      !workspaceLoading &&
      workspaces.length > 0
    ) {
      const needsProfile =
        !userWithProfile.avatarSeed ||
        !userWithProfile.nickname ||
        !userWithProfile.username;
      if (!needsProfile) {
        router.replace(`/workspace/${currentWorkspace.id}/cases`);
      }
    }
  }, [
    user,
    userWithProfile,
    currentWorkspace,
    workspaceLoading,
    workspaces.length,
    router,
  ]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
          <h2 className="mb-2 text-lg font-semibold text-red-800 dark:text-red-200">
            Connection Error
          </h2>
          <p className="mb-4 text-sm text-red-700 dark:text-red-300">
            {authError.message}
          </p>
          <p className="text-xs text-red-600 dark:text-red-400">
            Make sure you have run{" "}
            <code className="rounded bg-red-100 px-1 dark:bg-red-900">
              npx instant-cli init
            </code>{" "}
            and added{" "}
            <code className="rounded bg-red-100 px-1 dark:bg-red-900">
              NEXT_PUBLIC_INSTANT_APP_ID
            </code>{" "}
            to your .env.local file.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 font-sans dark:bg-black">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex items-center gap-1">
            <InstalloLogo size={40} className="text-zinc-900 dark:text-zinc-50" />
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Installo
            </h1>
          </div>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Sign in to get started
          </p>
        </div>
        <Login />
      </div>
    );
  }

  if (!userWithProfile || queryLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  const needsProfile =
    !userWithProfile.avatarSeed ||
    !userWithProfile.nickname ||
    !userWithProfile.username;

  if (needsProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 font-sans dark:bg-black">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex items-center gap-1">
            <InstalloLogo size={40} className="text-zinc-900 dark:text-zinc-50" />
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Installo
            </h1>
          </div>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {user.isGuest
              ? "Complete your profile to continue"
              : "Almost there!"}
          </p>
        </div>
        <CompleteProfile user={userWithProfile} />
      </div>
    );
  }

  if (!currentWorkspace || workspaceLoading || workspaces.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  // Brief loading state while redirect happens
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <div className="text-zinc-600 dark:text-zinc-400">Loading...</div>
    </div>
  );
}
