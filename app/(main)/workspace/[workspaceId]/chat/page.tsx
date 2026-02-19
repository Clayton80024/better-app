"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/AvatarPicker";
import { ConversationListSkeleton } from "@/components/ChatSkeleton";
import { useWorkspace } from "@/components/WorkspaceContext";
import { db } from "@/lib/db";

type UserWithProfile = {
  id: string;
  nickname?: string | null;
  avatarSeed?: string | null;
  username?: string | null;
};

type Conversation = {
  id: string;
  createdAt: number;
  updatedAt: number;
  participants: UserWithProfile[];
  messages: { id: string; text: string; createdAt: number; sender: UserWithProfile[] | (UserWithProfile | undefined)[] }[];
};

export default function ChatPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  const router = useRouter();
  const { user } = db.useAuth();
  const { currentWorkspace } = useWorkspace();
  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  const [searchUsername, setSearchUsername] = useState("");
  const [searchResults, setSearchResults] = useState<UserWithProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [startError, setStartError] = useState("");

  const { data, isLoading } = db.useQuery(
    user && currentWorkspace
      ? {
          conversations: {
            $: {
              where: {
                "participants.id": user.id,
                "workspace.id": currentWorkspace.id,
              },
              order: { serverCreatedAt: "desc" },
            },
            participants: {},
            messages: {
              $: { limit: 1, order: { serverCreatedAt: "desc" } },
              sender: {},
            },
          },
        }
      : null
  );

  const conversations = (data?.conversations || []) as unknown as Conversation[];

  async function handleSearch() {
    const q = searchUsername.replace(/^@/, "").trim();
    if (q.length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/find-user?username=${encodeURIComponent(q)}`);
      const json = await res.json();
      setSearchResults(json.users || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function startConversation(otherUser: UserWithProfile) {
    if (!user || otherUser.id === user.id || !currentWorkspace) return;
    const token = (user as { refresh_token?: string }).refresh_token;
    if (!token) {
      setStartError("Session expired. Please sign in again.");
      return;
    }
    setStartError("");
    try {
      const res = await fetch("/api/start-conversation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          otherUserId: otherUser.id,
          workspaceId: currentWorkspace.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to start conversation");
      router.push(`/workspace/${workspaceId}/chat/${json.conversationId}`);
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Failed to start conversation");
    }
  }

  function getOtherParticipant(conv: Conversation): UserWithProfile | null {
    const other = conv.participants?.find((p) => p.id !== user?.id);
    return other || null;
  }

  function getLastMessage(conv: Conversation) {
    const msgs = conv.messages || [];
    return msgs[0];
  }

  function formatRelativeTime(ts: number): string {
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    const min = Math.floor(diff / 60000);
    const hour = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);
    const week = Math.floor(diff / 604800000);
    const month = Math.floor(diff / 2592000000);
    if (sec < 60) return "just now";
    if (min < 60) return min === 1 ? "1 min ago" : `${min} min ago`;
    if (hour < 24) return hour === 1 ? "1 hour ago" : `${hour} hours ago`;
    if (day < 7) return day === 1 ? "1 day ago" : `${day} days ago`;
    if (week < 4) return week === 1 ? "1 week ago" : `${week} weeks ago`;
    if (month < 12) return month === 1 ? "1 month ago" : `${month} months ago`;
    return "over a year ago";
  }

  if (!user) return null;
  if (!currentWorkspace) {
    return (
      <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
        <div className="text-zinc-500 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-57px)] max-w-2xl flex-col">
      <div className="border-b border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Messages
        </h1>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search by @username"
            className="min-h-[44px] flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="min-h-[44px] min-w-[64px] rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50"
          >
            {searching ? "..." : "Find"}
          </button>
        </div>
        {startError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{startError}</p>
        )}
        {searchResults.length > 0 && (
          <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Start a conversation
            </p>
            {searchResults
              .filter((u) => u.id !== user?.id)
              .map((u) => (
                <button
                  key={u.id}
                  onClick={() => startConversation(u)}
                  className="flex min-h-[56px] w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
                >
                  <UserAvatar seed={u.avatarSeed || "default"} size={40} />
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {u.nickname || "Unknown"}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      @{u.username}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ConversationListSkeleton />
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p className="text-zinc-500 dark:text-zinc-400">
              No conversations yet
            </p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              Search for a user by @username to start chatting
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {conversations.map((conv) => {
              const other = getOtherParticipant(conv);
              const lastMsg = getLastMessage(conv);
              if (!other) return null;
              return (
                <li key={conv.id}>
                  <Link
                    href={`/workspace/${workspaceId}/chat/${conv.id}`}
                    className="flex min-h-[72px] items-center gap-3 p-4 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-900/50 dark:active:bg-zinc-800/50"
                  >
                    <UserAvatar seed={other.avatarSeed || "default"} size={48} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                          {other.nickname || "Unknown"}
                        </p>
                        {(lastMsg?.createdAt ?? conv.updatedAt) && (
                          <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                            {formatRelativeTime(lastMsg?.createdAt ?? conv.updatedAt)}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                        {lastMsg?.text || "No messages yet"}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
