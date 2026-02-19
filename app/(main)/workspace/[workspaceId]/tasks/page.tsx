"use client";

import { use, Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { UserAvatar } from "@/components/AvatarPicker";
import { useWorkspace } from "@/components/WorkspaceContext";
import { db } from "@/lib/db";
import { id } from "@instantdb/react";

type UserWithProfile = {
  id: string;
  nickname?: string | null;
  avatarSeed?: string | null;
  username?: string | null;
};

type Task = {
  id: string;
  text: string;
  createdAt: number;
  author: UserWithProfile[];
  interestedUsers?: UserWithProfile[];
};

function TasksPageContent({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const caseId = searchParams.get("case");
  const { user } = db.useAuth();
  const { currentWorkspace } = useWorkspace();
  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  const [newTaskText, setNewTaskText] = useState("");
  const [posting, setPosting] = useState(false);
  const [messageError, setMessageError] = useState("");

  const { data, isLoading } = db.useQuery(
    user && currentWorkspace
      ? {
          tasks: {
            $: {
              where: {
                "workspace.id": currentWorkspace.id,
                ...(caseId ? { "case.id": caseId } : {}),
              },
              order: { serverCreatedAt: "desc" },
            },
            author: {},
            interestedUsers: {},
          },
        }
      : null
  );

  const { data: caseDataResult } = db.useQuery(
    user && currentWorkspace && caseId
      ? {
          cases: {
            $: {
              where: {
                id: caseId,
                "workspace.id": currentWorkspace.id,
              } as { id: string; "workspace.id": string },
            },
          },
        }
      : null
  );

  const tasks = (data?.tasks || []) as unknown as Task[];
  const caseData = caseId
    ? (caseDataResult?.cases as { id: string; clientName: string; caseType: string }[])?.[0]
    : null;

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !currentWorkspace || !newTaskText.trim()) return;
    setPosting(true);
    try {
      const taskId = id();
      const now = Date.now();
      const links: Record<string, string> = {
        author: user.id,
        workspace: currentWorkspace.id,
      };
      if (caseId) links.case = caseId;
      await db.transact([
        db.tx.tasks[taskId]
          .update({ text: newTaskText.trim(), createdAt: now })
          .link(links),
      ]);
      setNewTaskText("");
    } catch (err) {
      console.error("Post task error:", err);
    } finally {
      setPosting(false);
    }
  }

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

  async function handleMessage(author: UserWithProfile, taskId?: string) {
    if (!user || !currentWorkspace || author.id === user.id) return;
    const token = (user as { refresh_token?: string }).refresh_token;
    if (!token) {
      setMessageError("Session expired. Please sign in again.");
      return;
    }
    setMessageError("");
    try {
      const res = await fetch("/api/start-conversation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          otherUserId: author.id,
          taskId,
          workspaceId: currentWorkspace?.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start conversation");
      router.push(`/workspace/${workspaceId}/chat/${json.conversationId}`);
    } catch (err) {
      setMessageError(err instanceof Error ? err.message : "Failed to start conversation");
    }
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
        {caseId && (
          <Link
            href={`/workspace/${workspaceId}/cases/${caseId}`}
            className="-ml-2 mb-3 flex min-h-[36px] min-w-[36px] items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {caseData ? `Back to ${caseData.clientName}` : "Back to case"}
          </Link>
        )}
        <h1 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {caseId && caseData
            ? `Tasks for ${caseData.clientName}`
            : "Tasks & help requests"}
        </h1>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Post what you need help with. Others can message you to offer help.
        </p>
        <form onSubmit={handlePost} className="flex gap-2">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder="e.g. I need someone to help me with my lawn"
            className="min-h-[44px] flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-base text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={posting || !newTaskText.trim()}
            className="min-h-[44px] min-w-[80px] rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50"
          >
            {posting ? "..." : "Post"}
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto">
        {messageError && (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            {messageError}
          </div>
        )}
        {isLoading ? (
          <div className="space-y-4 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-3 h-4 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
                  <div className="h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
                </div>
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              {caseId ? "No tasks for this case yet" : "No tasks yet"}
            </p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              {caseId ? "Post a task to track work for this case" : "Be the first to post what you need help with"}
            </p>
          </div>
        ) : (
          <ul className="space-y-4 p-4">
            {tasks.map((task) => {
              const author = Array.isArray(task.author) ? task.author[0] : task.author;
              const raw = task.interestedUsers ?? [];
              const interestedList = Array.isArray(raw)
                ? raw.filter((u): u is UserWithProfile => u && typeof u === "object" && "id" in u)
                : [];
              const isOwn = author?.id === user?.id;
              return (
                <li
                  key={task.id}
                  className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="p-5">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 whitespace-pre-wrap text-base leading-relaxed text-zinc-900 dark:text-zinc-50">
                        {task.text}
                      </p>
                      <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                        {task.createdAt ? formatRelativeTime(task.createdAt) : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                        <UserAvatar seed={author?.avatarSeed || "default"} size={36} className="shrink-0" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            {author?.nickname || "Unknown"}
                          </p>
                          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {author?.username ? `@${author.username}` : ""}
                          </p>
                        </div>
                      </div>
                      {!isOwn && author && (
                        <button
                          type="button"
                          onClick={() => handleMessage(author, task.id)}
                          className="min-h-[44px] shrink-0 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-emerald-700 hover:shadow active:bg-emerald-800"
                        >
                          Talk
                        </button>
                      )}
                    </div>
                  </div>
                  {interestedList.length > 0 && (
                    <div className="border-t border-zinc-100 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {interestedList.length === 1
                          ? "1 person interested"
                          : `${interestedList.length} people interested`}
                      </p>
                      <div className="flex flex-wrap items-center -space-x-2">
                        {interestedList.slice(0, 6).map((u) => (
                          <div
                            key={u.id}
                            className="group relative"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-white shadow-md transition-transform hover:scale-110 hover:z-10 dark:ring-zinc-900">
                              <UserAvatar seed={u.avatarSeed || "default"} size={40} className="h-full w-full object-cover" />
                            </div>
                            <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-lg opacity-0 transition-opacity group-hover:opacity-100 dark:border-zinc-700 dark:bg-zinc-800">
                              <div className="flex items-center gap-2">
                                <UserAvatar seed={u.avatarSeed || "default"} size={32} />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                                    {u.nickname || "Unknown"}
                                  </p>
                                  {u.username && (
                                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                                      @{u.username}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {interestedList.length > 6 && (
                          <span className="ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 ring-2 ring-white dark:bg-zinc-700 dark:ring-zinc-900 dark:text-zinc-400">
                            +{interestedList.length - 6}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function TasksPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
          <div className="text-zinc-500 dark:text-zinc-400">Loading...</div>
        </div>
      }
    >
      <TasksPageContent params={params} />
    </Suspense>
  );
}
