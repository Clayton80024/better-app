"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type UploadItem = {
  id: string;
  caseId: string;
  file: File;
  status: "pending" | "uploading" | "extracting" | "done" | "error";
  progress: number;
  error?: string;
};

const MAX_CONCURRENT = 3;

function uploadWithProgress(
  url: string,
  file: File,
  token: string,
  onProgress: (percent: number) => void
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      const response = new Response(xhr.responseText, {
        status: xhr.status,
        statusText: xhr.statusText,
      });
      resolve(response);
    });

    xhr.addEventListener("error", () => reject(new Error("Upload failed")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  });
}

type UploadContextValue = {
  uploadQueue: UploadItem[];
  addFilesToQueue: (
    caseId: string,
    files: FileList | File[],
    token: string
  ) => void;
  removeFromQueue: (id: string) => void;
  clearCompleted: (caseId?: string) => void;
  getQueueForCase: (caseId: string) => UploadItem[];
  isUploading: boolean;
  activeCount: number;
};

const UploadContext = createContext<UploadContextValue | null>(null);

export function UploadProvider({ children }: { children: ReactNode }) {
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const queueRef = useRef<UploadItem[]>([]);
  const processingCountRef = useRef(0);
  const processNextRef = useRef<(() => void) | null>(null);
  const tokenRef = useRef<string | null>(null);
  const recentAddKeysRef = useRef<Map<string, number>>(new Map());
  const recentlyUploadedRef = useRef<Map<string, number>>(new Map());
  const processingIdsRef = useRef<Set<string>>(new Set());
  queueRef.current = uploadQueue;

  const updateItem = useCallback((id: string, updates: Partial<UploadItem>) => {
    setUploadQueue((q) =>
      q.map((i) => (i.id === id ? { ...i, ...updates } : i))
    );
  }, []);

  const processOne = useCallback(
    async (item: UploadItem, token: string) => {
      const { id, caseId, file } = item;
      const uploadKey = `${caseId}:${file.name}:${file.size}`;
      const now = Date.now();
      const uploaded = recentlyUploadedRef.current;
      for (const [k, t] of [...uploaded]) {
        if (now - t > 5000) uploaded.delete(k);
      }
      if (uploaded.has(uploadKey)) {
        processingCountRef.current -= 1;
        updateItem(id, { status: "done", progress: 100 });
        setTimeout(() => {
          processingIdsRef.current.delete(id);
          processNextRef.current?.();
        }, 50);
        return;
      }
      uploaded.set(uploadKey, now);

      updateItem(id, { status: "uploading", progress: 0 });

      try {
        const res = await uploadWithProgress(
          `/api/cases/${caseId}/upload`,
          file,
          token,
          (pct) => updateItem(id, { progress: pct })
        );

        updateItem(id, { status: "extracting", progress: 100 });

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Upload failed");

        updateItem(id, { status: "done", progress: 100 });
      } catch (err) {
        uploaded.delete(uploadKey);
        const msg = err instanceof Error ? err.message : "Upload failed";
        updateItem(id, { status: "error", error: msg });
      } finally {
        processingCountRef.current -= 1;
        setTimeout(() => {
          processingIdsRef.current.delete(id);
          processNextRef.current?.();
        }, 50);
      }
    },
    [updateItem]
  );

  const processNext = useCallback(() => {
    const token = tokenRef.current;
    if (!token) return;

    const pending = queueRef.current.filter(
      (i) => i.status === "pending" && !processingIdsRef.current.has(i.id)
    );
    const slots = MAX_CONCURRENT - processingCountRef.current;
    const toStart = pending.slice(0, Math.max(0, slots));

    toStart.forEach((item) => {
      processingIdsRef.current.add(item.id);
      processingCountRef.current += 1;
      processOne(item, token);
    });
  }, [processOne]);

  processNextRef.current = processNext;

  const addFilesToQueue = useCallback(
    (caseId: string, files: FileList | File[], token: string) => {
      tokenRef.current = token;
      const MAX_SIZE = 25 * 1024 * 1024;
      const fileArray = Array.from(files);
      const valid = fileArray.filter((f) => {
        if (!f.type.startsWith("image/") && f.type !== "application/pdf")
          return false;
        if (f.size > MAX_SIZE) return false;
        return true;
      });
      if (valid.length === 0) return;

      const now = Date.now();
      const DEDUP_MS = 3000;
      const recent = recentAddKeysRef.current;
      for (const [k, t] of recent) {
        if (now - t > DEDUP_MS) recent.delete(k);
      }
      const fileKey = (f: File) => `${f.name}:${f.size}`;
      const toAdd = valid.filter((f) => {
        const key = `${caseId}:${fileKey(f)}`;
        if (recent.has(key)) return false;
        recent.set(key, now);
        return true;
      });
      if (toAdd.length === 0) return;

      setUploadQueue((q) => {
        const existingKeys = new Set(
          q
            .filter(
              (i) =>
                i.caseId === caseId &&
                (i.status === "pending" || i.status === "uploading" || i.status === "extracting")
            )
            .map((i) => fileKey(i.file))
        );
        const toAddFiltered = toAdd.filter((f) => !existingKeys.has(fileKey(f)));
        if (toAddFiltered.length === 0) return q;

        const newItems: UploadItem[] = toAddFiltered.map((file) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          caseId,
          file,
          status: "pending" as const,
          progress: 0,
        }));

        const next = [...q, ...newItems];
        setTimeout(() => processNextRef.current?.(), 50);
        return next;
      });
    },
    []
  );

  const removeFromQueue = useCallback((id: string) => {
    processingIdsRef.current.delete(id);
    setUploadQueue((q) => {
      const next = q.filter((i) => i.id !== id);
      setTimeout(() => processNextRef.current?.(), 50);
      return next;
    });
  }, []);

  const clearCompleted = useCallback((caseId?: string) => {
    setUploadQueue((q) => {
      const toRemove = q.filter(
        (i) =>
          (i.status === "done" || i.status === "error") &&
          (!caseId || i.caseId === caseId)
      );
      toRemove.forEach((i) => processingIdsRef.current.delete(i.id));
      const next = q.filter(
        (i) =>
          !(
            (i.status === "done" || i.status === "error") &&
            (!caseId || i.caseId === caseId)
          )
      );
      setTimeout(() => processNextRef.current?.(), 50);
      return next;
    });
  }, []);

  const getQueueForCase = useCallback(
    (caseId: string) =>
      uploadQueue.filter((i) => i.caseId === caseId),
    [uploadQueue]
  );

  const isUploading = uploadQueue.some(
    (i) => i.status === "uploading" || i.status === "extracting"
  );
  const activeCount = uploadQueue.filter(
    (i) =>
      i.status === "uploading" ||
      i.status === "extracting" ||
      i.status === "pending"
  ).length;

  return (
    <UploadContext.Provider
      value={{
        uploadQueue,
        addFilesToQueue,
        removeFromQueue,
        clearCompleted,
        getQueueForCase,
        isUploading,
        activeCount,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUpload must be used within UploadProvider");
  return ctx;
}

