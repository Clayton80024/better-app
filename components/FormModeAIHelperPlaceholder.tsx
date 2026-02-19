"use client";

export function FormModeAIHelperPlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
          <svg
            className="h-6 w-6 text-zinc-500 dark:text-zinc-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.636-4.364l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            AI Data Helper
          </h3>
          <p className="mt-2 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
            Auto-fill and suggestions coming soon. The AI will help populate
            form fields from extracted document data.
          </p>
        </div>
      </div>
    </div>
  );
}
