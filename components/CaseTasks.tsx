"use client";

import Link from "next/link";
import { useWorkspace } from "@/components/WorkspaceContext";
import { db } from "@/lib/db";

type Task = {
  id: string;
  text: string;
  createdAt: number;
};

export function CaseTasks({
  caseId,
  caseClientName,
  userId,
}: {
  caseId: string;
  caseClientName: string;
  userId: string;
}) {
  const { currentWorkspace } = useWorkspace();

  const { data, isLoading } = db.useQuery(
    userId && currentWorkspace && caseId
      ? {
          tasks: {
            $: {
              where: { "case.id": caseId, "workspace.id": currentWorkspace.id },
              order: { createdAt: "desc" },
            },
          },
        }
      : null
  );

  const tasks = (data?.tasks ?? []) as Task[];

  function formatRelativeTime(ts: number): string {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    const hour = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);
    if (min < 60) return min <= 1 ? "just now" : `${min} min ago`;
    if (hour < 24) return hour === 1 ? "1 hour ago" : `${hour} hours ago`;
    if (day < 7) return day === 1 ? "1 day ago" : `${day} days ago`;
    return new Date(ts).toLocaleDateString();
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Tasks
      </h2>
      <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
        Tasks and help requests for this case.
      </p>

      <Link
        href={currentWorkspace ? `/workspace/${currentWorkspace.id}/tasks?case=${caseId}` : `/tasks?case=${caseId}`}
        className="mb-4 inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        View all tasks
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      {isLoading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No tasks for this case yet. Add one from the tasks page.
        </p>
      ) : (
        <ul className="space-y-3">
          {tasks.slice(0, 5).map((task) => (
            <li
              key={task.id}
              className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50"
            >
              <p className="text-sm text-zinc-900 dark:text-zinc-50">{task.text}</p>
              <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                {formatRelativeTime(task.createdAt)}
              </span>
            </li>
          ))}
          {tasks.length > 5 && (
            <li>
              <Link
                href={currentWorkspace ? `/workspace/${currentWorkspace.id}/tasks?case=${caseId}` : `/tasks?case=${caseId}`}
                className="text-sm text-emerald-600 hover:underline dark:text-emerald-400"
              >
                +{tasks.length - 5} more
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
