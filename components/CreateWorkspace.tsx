"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/db";
import { id } from "@instantdb/react";
import { useWorkspace } from "@/components/WorkspaceContext";

export function CreateWorkspace({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const { user } = db.useAuth();
  const { setCurrentWorkspaceId } = useWorkspace();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const workspaceId = id();
      const now = Date.now();
      await db.transact([
        db.tx.workspaces[workspaceId]
          .update({ name: name.trim(), createdAt: now })
          .link({ owner: user.id, members: [user.id] }),
      ]);
      setCurrentWorkspaceId(workspaceId);
      setName("");
      onCreated?.();
      router.push(`/workspace/${workspaceId}/cases`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create workspace");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Create a workspace
      </h2>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Workspaces help you organize your tasks, todos, and conversations. Create one to get
        started.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. My Team, Personal"
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
          maxLength={100}
          autoFocus
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={creating || !name.trim()}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create workspace"}
        </button>
      </form>
    </div>
  );
}
