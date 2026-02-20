"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { useWorkspace } from "@/components/WorkspaceContext";
import { CreateWorkspaceModal } from "./CreateWorkspaceModal";

function WorkspaceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  );
}

export function WorkspaceSwitcher() {
  const router = useRouter();
  const { workspaces, currentWorkspace, setCurrentWorkspaceId } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  async function saveWorkspaceName(workspaceId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await db.transact([db.tx.workspaces[workspaceId].update({ name: trimmed })]);
      toast.success("Workspace name updated");
    } catch {
      toast.error("Failed to update workspace name");
    } finally {
      setEditingWorkspaceId(null);
    }
  }

  function startEdit(w: { id: string; name: string }, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingWorkspaceId(w.id);
    setEditName(w.name);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (workspaces.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-800 shadow-sm transition-all hover:border-zinc-300 hover:shadow dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
      >
        <WorkspaceIcon className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
        <span className="max-w-[140px] truncate">{currentWorkspace?.name ?? "Select workspace"}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 dark:text-zinc-500 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-zinc-200 bg-white py-1.5 shadow-xl ring-1 ring-black/5 dark:border-zinc-700 dark:bg-zinc-900 dark:ring-white/5">
          <div className="max-h-[280px] overflow-y-auto py-1">
            {workspaces.map((w) => {
              const isSelected = w.id === currentWorkspace?.id;
              const isEditing = editingWorkspaceId === w.id;
              return (
                <div
                  key={w.id}
                  className={`group flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200"
                      : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (!isEditing) {
                        setCurrentWorkspaceId(w.id);
                        setOpen(false);
                        router.push(`/workspace/${w.id}/cases`);
                      }
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isSelected ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-zinc-100 dark:bg-zinc-800"
                    }`}>
                      <WorkspaceIcon className={`h-4 w-4 ${
                        isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"
                      }`} />
                    </div>
                    {isEditing ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => saveWorkspaceName(w.id, editName)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            saveWorkspaceName(w.id, editName);
                          }
                          if (e.key === "Escape") setEditingWorkspaceId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="min-w-0 flex-1 rounded border border-emerald-300 bg-white px-2 py-0.5 text-sm text-zinc-900 outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-zinc-900 dark:text-zinc-50"
                        maxLength={100}
                      />
                    ) : (
                      <span className="min-w-0 flex-1 truncate font-medium">{w.name}</span>
                    )}
                    {isSelected && !isEditing && (
                      <CheckIcon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </button>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={(e) => startEdit(w, e)}
                      className="shrink-0 rounded p-1 text-zinc-400 opacity-60 transition-opacity hover:bg-zinc-200 hover:text-zinc-600 hover:opacity-100 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
                      aria-label="Edit workspace name"
                    >
                      <PencilIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => {
                setCreateModalOpen(true);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-emerald-300 dark:border-emerald-700">
                <PlusIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Create workspace
            </button>
          </div>
        </div>
      )}
      <CreateWorkspaceModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />
    </div>
  );
}
