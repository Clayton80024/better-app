"use client";

import { useState, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type DocumentViewerProps = {
  file: Blob | string | null;
  mimeType: string;
  isLoading?: boolean;
  compact?: boolean;
};

export function DocumentViewer({
  file,
  mimeType,
  isLoading,
  compact = false,
}: DocumentViewerProps) {
  const minHeightClass = compact ? "min-h-0" : "min-h-[400px]";
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    setNumPages(0);
    setPageNumber(1);
  }, [file]);

  useEffect(() => {
    if (file instanceof Blob && mimeType.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setDownloadUrl(null);
      return () => URL.revokeObjectURL(url);
    }
    setImageUrl(null);
    if (file instanceof Blob && !mimeType.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setDownloadUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setDownloadUrl(typeof file === "string" ? file : null);
  }, [file, mimeType]);

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPageNumber(1);
  }, []);

  useEffect(() => {
    if (numPages > 0 && pageNumber > numPages) {
      setPageNumber(numPages);
    }
  }, [numPages, pageNumber]);

  if (!file) {
    return (
      <div className={`flex h-full ${minHeightClass} flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50/50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-800/50`}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Select a document to view
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex h-full ${minHeightClass} flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-800/50`}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  const isPdf = mimeType === "application/pdf";
  const isImage =
    mimeType.startsWith("image/") &&
    ["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(mimeType);

  if (isImage && imageUrl) {
    return (
      <div className={`flex h-full ${minHeightClass} items-center justify-center overflow-auto rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50`}>
        <img
          src={imageUrl}
          alt="Document"
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }

  if (!isPdf) {
    if (!downloadUrl) {
      return (
        <div className={`flex h-full ${minHeightClass} flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-700 dark:bg-zinc-800/50`}>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
        </div>
      );
    }
    return (
      <div className={`flex h-full ${minHeightClass} flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50/50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-800/50`}>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Preview not available for this file type
        </p>
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 text-sm text-emerald-600 hover:underline dark:text-emerald-400"
        >
          Open in new tab
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="min-w-[80px] text-center text-sm text-zinc-600 dark:text-zinc-400">
            Page {pageNumber} of {numPages || "?"}
          </span>
          <button
            type="button"
            onClick={() => setPageNumber((p) => Math.min(numPages || 1, p + 1))}
            disabled={pageNumber >= numPages}
            className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-40 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <span className="text-sm">−</span>
          </button>
          <span className="min-w-[48px] text-center text-sm text-zinc-600 dark:text-zinc-400">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(2, s + 0.25))}
            className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <span className="text-sm">+</span>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setRotation((r) => (r + 90) % 360)}
          className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <div className="flex items-center justify-center">
          <Document
            file={file}
            onLoadSuccess={onDocumentLoadSuccess}
            loading="Loading PDF…"
            error="Failed to load PDF."
          >
            {numPages > 0 && pageNumber >= 1 && pageNumber <= numPages && (
              <Page
                pageNumber={pageNumber}
                scale={scale}
                rotate={rotation}
                renderTextLayer
                renderAnnotationLayer
              />
            )}
          </Document>
        </div>
      </div>
    </div>
  );
}
