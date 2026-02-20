"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { db } from "@/lib/db";
import { CASE_TYPES, type CaseType } from "@/lib/case-types";

type EditableCaseHeaderProps = {
  workspaceId: string;
  caseId: string;
  clientName: string;
  caseType: string;
  status?: string | null;
  backHref?: string;
  backLabel?: string;
};

export function EditableCaseHeader({
  workspaceId,
  caseId,
  clientName: initialClientName,
  caseType: initialCaseType,
  status: initialStatus,
  backHref,
  backLabel = "Back to cases",
}: EditableCaseHeaderProps) {
  const defaultBackHref = `/workspace/${workspaceId}/cases`;
  const href = backHref ?? defaultBackHref;
  const [clientName, setClientName] = useState(initialClientName);
  const [caseType, setCaseType] = useState(initialCaseType);
  const [status, setStatus] = useState(initialStatus ?? "");
  const [editingField, setEditingField] = useState<"clientName" | "caseType" | "status" | null>(null);

  useEffect(() => {
    if (editingField !== "clientName") setClientName(initialClientName);
  }, [initialClientName, editingField]);
  useEffect(() => {
    if (editingField !== "caseType") setCaseType(initialCaseType);
  }, [initialCaseType, editingField]);
  useEffect(() => {
    if (editingField !== "status") setStatus(initialStatus ?? "");
  }, [initialStatus, editingField]);

  const saveClientName = useCallback(async () => {
    const trimmed = clientName.trim();
    if (trimmed === initialClientName) {
      setEditingField(null);
      return;
    }
    if (!trimmed) {
      setClientName(initialClientName);
      setEditingField(null);
      return;
    }
    try {
      await db.transact([db.tx.cases[caseId].update({ clientName: trimmed })]);
      toast.success("Client name updated");
    } catch {
      toast.error("Failed to update");
    }
    setEditingField(null);
  }, [caseId, clientName, initialClientName]);

  const saveCaseType = useCallback(async () => {
    if (caseType === initialCaseType) {
      setEditingField(null);
      return;
    }
    try {
      await db.transact([db.tx.cases[caseId].update({ caseType })]);
      toast.success("Case type updated");
    } catch {
      toast.error("Failed to update");
    }
    setEditingField(null);
  }, [caseId, caseType, initialCaseType]);

  const saveStatus = useCallback(async () => {
    const trimmed = status.trim();
    const prev = initialStatus ?? "";
    if (trimmed === prev) {
      setEditingField(null);
      return;
    }
    try {
      await db.transact([db.tx.cases[caseId].update({ status: trimmed || undefined })]);
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update");
    }
    setEditingField(null);
  }, [caseId, status, initialStatus]);

  return (
    <>
      <Link
        href={href}
        className="-ml-2 mb-3 flex min-h-[36px] min-w-[36px] items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {backLabel}
      </Link>
      <div className="space-y-1">
        {editingField === "clientName" ? (
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            onBlur={saveClientName}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveClientName();
              if (e.key === "Escape") {
                setClientName(initialClientName);
                setEditingField(null);
              }
            }}
            autoFocus
            className="w-full max-w-md rounded border border-emerald-300 bg-white px-2 py-1 text-xl font-semibold text-zinc-900 outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-zinc-900 dark:text-zinc-50"
            maxLength={200}
          />
        ) : (
          <h1
            onClick={() => setEditingField("clientName")}
            className="cursor-pointer rounded px-1 py-0.5 text-xl font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
            title="Click to edit"
          >
            {clientName}
          </h1>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {editingField === "caseType" ? (
            <select
              value={caseType}
              onChange={(e) => setCaseType(e.target.value as CaseType)}
              onBlur={saveCaseType}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveCaseType();
                if (e.key === "Escape") {
                  setCaseType(initialCaseType);
                  setEditingField(null);
                }
              }}
              autoFocus
              className="rounded-full border border-emerald-300 bg-white px-2.5 py-0.5 text-sm font-medium text-emerald-800 outline-none focus:border-emerald-500 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200"
            >
              {CASE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : (
            <span
              onClick={() => setEditingField("caseType")}
              className="cursor-pointer rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200 dark:hover:bg-emerald-900/70"
              title="Click to edit"
            >
              {caseType}
            </span>
          )}
          {editingField === "status" ? (
            <input
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              onBlur={saveStatus}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveStatus();
                if (e.key === "Escape") {
                  setStatus(initialStatus ?? "");
                  setEditingField(null);
                }
              }}
              placeholder="Status"
              autoFocus
              className="w-24 rounded-full border border-zinc-300 bg-white px-2.5 py-0.5 text-sm text-zinc-600 outline-none focus:border-emerald-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
            />
          ) : (
            <span
              onClick={() => setEditingField("status")}
              className="cursor-pointer rounded-full bg-zinc-100 px-2.5 py-0.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              title="Click to edit"
            >
              {status || "Active"}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
