"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { db } from "@/lib/db";
import { id } from "@instantdb/react";
import { useWorkspace } from "@/components/WorkspaceContext";
import { CASE_TYPES } from "@/lib/case-types";
import { useRouter } from "next/navigation";

export function CreateCaseModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { user } = db.useAuth();
  const { currentWorkspace } = useWorkspace();
  const [clientName, setClientName] = useState("");
  const [caseType, setCaseType] = useState<string>(CASE_TYPES[0]);
  const [customCaseType, setCustomCaseType] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const resolvedCaseType = caseType === "Other" ? customCaseType.trim() : caseType;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !currentWorkspace || !clientName.trim()) return;
    if (caseType === "Other" && !customCaseType.trim()) {
      setError("Please enter a case type");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const caseId = id();
      const now = Date.now();
      await db.transact([
        db.tx.cases[caseId]
          .update({
            clientName: clientName.trim(),
            caseType: resolvedCaseType,
            status: "active",
            createdAt: now,
          })
          .link({ workspace: currentWorkspace.id }),
      ]);
      setClientName("");
      setCaseType(CASE_TYPES[0]);
      setCustomCaseType("");
      onOpenChange(false);
      router.push(`/workspace/${currentWorkspace.id}/cases/${caseId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create case");
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          New Case
        </h2>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Create a new case for your workspace.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="clientName"
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Client name
            </label>
            <input
              id="clientName"
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. John Smith"
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/30"
              maxLength={200}
              autoFocus
            />
          </div>
          <div>
            <label
              htmlFor="caseType"
              className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Case type
            </label>
            <div className="relative">
              <select
                id="caseType"
                value={caseType}
                onChange={(e) => setCaseType(e.target.value)}
                className="w-full appearance-none rounded-xl border border-zinc-300 bg-white py-2.5 pl-4 pr-10 text-zinc-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/30"
              >
                {CASE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {caseType === "Other" && (
              <input
                type="text"
                value={customCaseType}
                onChange={(e) => setCustomCaseType(e.target.value)}
                placeholder="Type your case type"
                className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500 dark:focus:border-emerald-500 dark:focus:ring-emerald-500/30"
                maxLength={100}
              />
            )}
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !clientName.trim() || (caseType === "Other" && !customCaseType.trim())}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modal, document.body)
    : null;
}
