"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProfileForm } from "@/components/ProfileForm";
import { useWorkspace } from "@/components/WorkspaceContext";
import { db } from "@/lib/db";

type UserWithProfile = {
  id: string;
  email?: string | null;
  nickname?: string | null;
  avatarSeed?: string | null;
  username?: string | null;
};

export default function SettingsPage() {
  const router = useRouter();
  const { user } = db.useAuth();
  const { currentWorkspace } = useWorkspace();

  const { data, isLoading } = db.useQuery(
    user ? { $users: { $: { where: { id: user.id } } } } : null
  );

  const profile = data?.$users?.[0];
  const userWithProfile: UserWithProfile | null =
    user && profile ? ({ ...user, ...profile } as UserWithProfile) : null;

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  if (!user) return null;

  if (!userWithProfile || isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
        <div className="text-zinc-500 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  const backHref = currentWorkspace
    ? `/workspace/${currentWorkspace.id}/cases`
    : "/";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-57px)] max-w-2xl flex-col">
      <header className="shrink-0 border-b border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <Link
          href={backHref}
          className="mb-2 inline-block text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          ← Back
        </Link>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Update your profile
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex justify-center">
          <ProfileForm
            user={userWithProfile}
            title="Edit profile"
            subtitle="Change your username, display name, or avatar"
            submitLabel="Save changes"
            onSuccess={() => toast.success("Profile updated")}
          />
        </div>
      </div>
    </div>
  );
}
