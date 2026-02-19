"use client";

import { useState, useCallback } from "react";
import { useWorkspace } from "@/components/WorkspaceContext";
import { db } from "@/lib/db";
import { id } from "@instantdb/react";

type CaseNote = {
  id: string;
  text: string;
  createdAt: number;
};

export function CaseNotes({ caseId, userId }: { caseId: string; userId: string }) {
  const { currentWorkspace } = useWorkspace();
  const { user } = db.useAuth();
  const [newNoteText, setNewNoteText] = useState("");
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const { data } = db.useQuery(
    userId && currentWorkspace && caseId
      ? {
          caseNotes: {
            $: {
              where: { "case.id": caseId },
              order: { createdAt: "desc" },
            },
          },
        }
      : null
  );

  const notes = (data?.caseNotes ?? []) as CaseNote[];

  const handleAdd = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newNoteText.trim() || posting) return;
      setPosting(true);
      try {
        const noteId = id();
        await db.transact([
          db.tx.caseNotes[noteId]
            .update({ text: newNoteText.trim(), createdAt: Date.now() })
            .link({ case: caseId }),
        ]);
        setNewNoteText("");
      } catch (err) {
        console.error("Add note error:", err);
      } finally {
        setPosting(false);
      }
    },
    [caseId, newNoteText, posting]
  );

  const handleUpdate = useCallback(
    async (noteId: string) => {
      if (!editText.trim()) return;
      try {
        await db.transact([
          db.tx.caseNotes[noteId].update({ text: editText.trim() }),
        ]);
        setEditingId(null);
        setEditText("");
      } catch (err) {
        console.error("Update note error:", err);
      }
    },
    [editText]
  );

  const handleDelete = useCallback(async (noteId: string) => {
    try {
      await db.transact([db.tx.caseNotes[noteId].delete()]);
      setEditingId(null);
    } catch (err) {
      console.error("Delete note error:", err);
    }
  }, []);

  const startEdit = useCallback((note: CaseNote) => {
    setEditingId(note.id);
    setEditText(note.text);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditText("");
  }, []);

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        Case Notes
      </h2>
      <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
        Add general context for this case, e.g. &quot;Client overstay since 2023&quot; or
        &quot;Need to confirm Birth Certificate translation&quot;
      </p>

      <form onSubmit={handleAdd} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Add a note..."
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder-zinc-500"
          />
          <button
            type="submit"
            disabled={!newNoteText.trim() || posting}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
          >
            {posting ? "Adding..." : "Add"}
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No notes yet. Add one above.
        </p>
      ) : (
        <ul className="space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50"
            >
              {editingId === note.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdate(note.id)}
                      className="rounded px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-zinc-900 dark:text-zinc-50">
                    {note.text}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatDate(note.createdAt)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(note)}
                        className="text-xs text-zinc-600 hover:underline dark:text-zinc-400"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(note.id)}
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
