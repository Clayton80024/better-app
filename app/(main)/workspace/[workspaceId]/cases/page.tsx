"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/components/WorkspaceContext";
import { CreateCaseModal } from "@/components/CreateCaseModal";
import { db } from "@/lib/db";

type Case = {
  id: string;
  clientName: string;
  caseType: string;
  status?: string | null;
  createdAt: number;
};

export default function CasesPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const { user } = db.useAuth();
  const { currentWorkspace } = useWorkspace();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  const { data, isLoading } = db.useQuery(
    user && currentWorkspace
      ? {
          cases: {
            $: {
              where: { "workspace.id": currentWorkspace.id },
              order: { serverCreatedAt: "desc" },
            },
          },
        }
      : null
  );

  const cases = (data?.cases ?? []) as unknown as Case[];

  function formatRelativeTime(ts: number): string {
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(diff / 60000);
    const hour = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);
    const week = Math.floor(diff / 604800000);
    const month = Math.floor(diff / 2592000000);
    if (sec < 60) return "just now";
    if (min < 60) return min === 1 ? "1 min ago" : `${min} min ago`;
    if (hour < 24) return hour === 1 ? "1 hour ago" : `${hour} hours ago`;
    if (day < 7) return day === 1 ? "1 day ago" : `${day} days ago`;
    if (week < 4) return week === 1 ? "1 week ago" : `${week} weeks ago`;
    if (month < 12) return month === 1 ? "1 month ago" : `${month} months ago`;
    return "over a year ago";
  }

  if (!user) return null;
  if (!currentWorkspace) {
    return (
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
        <div className="text-zinc-500 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-57px)] max-w-2xl flex-col">
      <div className="border-b border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Cases
          </h1>
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="min-h-[44px] rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 active:bg-emerald-800"
          >
            New Case
          </button>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Manage your cases. Create a new case to get started.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-4 p-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="mb-3 h-4 w-1/2 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="h-3 w-1/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              </div>
            ))}
          </div>
        ) : cases.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">No cases yet</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              Create your first case to get started
            </p>
            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              New Case
            </button>
          </div>
        ) : (
          <ul className="space-y-4 p-4">
            {cases.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/workspace/${workspaceId}/cases/${c.id}`}
                  className="block overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {c.clientName}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {c.caseType}
                        {c.status && (
                          <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                            {c.status}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        {formatRelativeTime(c.createdAt)}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <CreateCaseModal open={createModalOpen} onOpenChange={setCreateModalOpen} />
    </div>
  );
}
