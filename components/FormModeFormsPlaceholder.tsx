"use client";

export function FormModeFormsPlaceholder() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          I-140
        </span>
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            USCIS Forms
          </h3>
          <p className="mt-2 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
            Forms will load from the database. I-140 and other form definitions
            will appear here when configured.
          </p>
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          No forms yet
        </p>
      </div>
    </div>
  );
}
