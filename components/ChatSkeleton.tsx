export function ConversationListSkeleton() {
  return (
    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {[1, 2, 3, 4, 5].map((i) => (
        <li key={i} className="flex items-center gap-3 p-4">
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-700" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-3 w-48 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function MessageListSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex justify-start">
        <div className="h-12 w-48 animate-pulse rounded-2xl rounded-bl-md bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="flex justify-end">
        <div className="h-12 w-40 animate-pulse rounded-2xl rounded-br-md bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="flex justify-start">
        <div className="h-10 w-64 animate-pulse rounded-2xl rounded-bl-md bg-zinc-200 dark:bg-zinc-700" />
      </div>
      <div className="flex justify-end">
        <div className="h-12 w-56 animate-pulse rounded-2xl rounded-br-md bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}
