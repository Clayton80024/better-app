"use client";

import Link from "next/link";
import { useUpload } from "@/components/UploadContext";
import { useWorkspace } from "@/components/WorkspaceContext";

export function UploadIndicator() {
  const { activeCount, uploadQueue } = useUpload();
  const { currentWorkspace } = useWorkspace();

  if (activeCount === 0) return null;

  const inProgress = uploadQueue.filter(
    (i) => i.status === "uploading" || i.status === "extracting"
  ).length;
  const caseId = uploadQueue.find((i) => i.caseId)?.caseId;
  const base = currentWorkspace ? `/workspace/${currentWorkspace.id}` : "";
  const href = caseId ? `${base}/cases/${caseId}?tab=documents` : `${base}/cases`;

  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-950/70"
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
      {inProgress > 0
        ? `Uploading ${inProgress} file${inProgress === 1 ? "" : "s"}...`
        : `${activeCount} in queue`}
    </Link>
  );
}
