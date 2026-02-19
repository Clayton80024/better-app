"use client";

import { use, useRef, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { UserAvatar } from "@/components/AvatarPicker";
import { MessageListSkeleton } from "@/components/ChatSkeleton";
import { db } from "@/lib/db";
import { id } from "@instantdb/react";

type UserWithProfile = {
  id: string;
  nickname?: string | null;
  avatarSeed?: string | null;
  username?: string | null;
};

type Message = {
  id: string;
  text: string;
  createdAt: number;
  sender: UserWithProfile[];
  failed?: boolean;
};

type Conversation = {
  id: string;
  participants: UserWithProfile[];
  messages: Message[];
};

export default function ChatViewPage({
  params,
}: {
  params: Promise<{ workspaceId: string; id: string }>;
}) {
  const { workspaceId, id: convId } = use(params);
  return <ChatContent workspaceId={workspaceId} convId={convId} />;
}

function ChatContent({ workspaceId, convId }: { workspaceId: string; convId: string }) {
  const router = useRouter();
  const { user } = db.useAuth();
  useEffect(() => {
    if (!user) router.replace("/");
  }, [user, router]);

  const [messageOffset, setMessageOffset] = useState(0);
  const [allServerMessages, setAllServerMessages] = useState<Message[]>([]);

  useEffect(() => {
    setMessageOffset(0);
    setAllServerMessages([]);
  }, [convId]);
  const MESSAGE_PAGE_SIZE = 50;

  const { data, isLoading } = db.useQuery(
    user && convId
      ? {
          $users: { $: { where: { id: user.id } } },
          conversations: {
            $: { where: { id: convId } },
            participants: {},
          },
          messages: {
            $: {
              where: { "conversation.id": convId },
              order: { serverCreatedAt: "desc" },
              limit: MESSAGE_PAGE_SIZE,
              offset: messageOffset,
            },
            sender: {},
          },
        }
      : null
  );

  const myProfile = data?.$users?.[0] as UserWithProfile | undefined;
  const conversation = data?.conversations?.[0] as Conversation | undefined;
  const other = conversation?.participants?.find((p) => p.id !== user?.id);
  const rawMessages = useMemo(
    () => (data?.messages ?? []) as unknown as Message[],
    [data?.messages]
  );

  useEffect(() => {
    if (rawMessages.length === 0 && messageOffset === 0) {
      setAllServerMessages((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const ordered = [...rawMessages].reverse();
    if (messageOffset === 0) {
      setAllServerMessages(ordered);
    } else {
      setAllServerMessages((prev) => [...ordered, ...prev]);
    }
  }, [rawMessages, messageOffset]);

  const serverMessages =
    allServerMessages.length > 0 ? allServerMessages : rawMessages.length ? [...rawMessages].reverse() : [];

  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);

  const messages = useMemo(
    () =>
      [
        ...serverMessages.filter((m) => !optimisticMessages.some((o) => o.id === m.id)),
        ...optimisticMessages,
      ].sort((a, b) => a.createdAt - b.createdAt),
    [serverMessages, optimisticMessages]
  );
  const room = db.room("chat", convId);
  db.rooms.useSyncPresence(room, {
    name: myProfile?.nickname || user?.email || "User",
    userId: user?.id,
  });
  const { peers } = db.rooms.usePresence(room, { keys: ["userId", "name", "typing"] });
  const typing = db.rooms.useTypingIndicator(room, "chat");
  const isOtherOnline = other
    ? Object.values(peers || {}).some((p) => (p as { userId?: string }).userId === other.id)
    : false;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const showLoadMore = rawMessages.length >= MESSAGE_PAGE_SIZE;
  const ESTIMATE_MESSAGE_HEIGHT = 88;
  const LOAD_MORE_HEIGHT = 60;
  const virtualizer = useVirtualizer({
    count: showLoadMore ? messages.length + 1 : messages.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) =>
      showLoadMore && index === 0 ? LOAD_MORE_HEIGHT : ESTIMATE_MESSAGE_HEIGHT,
    overscan: 5,
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted"
  );

  async function requestNotificationPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotificationsEnabled(perm === "granted");
  }

  useEffect(() => {
    if (messageOffset === 0 && messages.length > 0) {
      requestAnimationFrame(() => {
        const lastIndex = showLoadMore ? messages.length : messages.length - 1;
        virtualizer.scrollToIndex(lastIndex, { align: "end", behavior: "smooth" });
      });
    }
  }, [messages.length, messageOffset, showLoadMore, virtualizer]);

  const pendingScrollRestore = useRef<{ prevScrollHeight: number; prevScrollTop: number } | null>(null);

  const handleLoadMore = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      pendingScrollRestore.current = {
        prevScrollHeight: el.scrollHeight,
        prevScrollTop: el.scrollTop,
      };
    }
    setMessageOffset((o) => o + MESSAGE_PAGE_SIZE);
  }, []);

  useEffect(() => {
    if (!pendingScrollRestore.current || !scrollContainerRef.current) return;
    const { prevScrollHeight, prevScrollTop } = pendingScrollRestore.current;
    pendingScrollRestore.current = null;
    const el = scrollContainerRef.current;
    const newScrollHeight = el.scrollHeight;
    const heightDiff = newScrollHeight - prevScrollHeight;
    if (heightDiff > 0) {
      el.scrollTop = prevScrollTop + heightDiff;
    }
  }, [allServerMessages]);

  const handleSend = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!user || !convId) return;
      const input = e.currentTarget.message as HTMLInputElement;
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      setSendError(null);
      const msgId = id();
      const now = Date.now();
      const optimisticMsg: Message = {
        id: msgId,
        text,
        createdAt: now,
        sender: [{ id: user.id, nickname: myProfile?.nickname, username: (user as { username?: string }).username }],
      };
      setOptimisticMessages((prev) => [...prev, optimisticMsg]);
      try {
        await db.transact([
          db.tx.messages[msgId]
            .update({ text, createdAt: now })
            .link({ conversation: convId, sender: user.id }),
          db.tx.conversations[convId].update({ updatedAt: now }),
        ]);
        setOptimisticMessages((prev) => prev.filter((m) => m.id !== msgId));
      } catch (err) {
        setSendError("Failed to send message.");
        setOptimisticMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, failed: true } : m)));
      }
    },
    [user, convId, myProfile?.nickname]
  );

  if (!user || !convId) return null;

  if (!conversation && data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <p className="text-zinc-500 dark:text-zinc-400">
          Conversation not found
        </p>
        <Link
          href={`/workspace/${workspaceId}/chat`}
          className="text-emerald-600 hover:underline dark:text-emerald-400"
        >
          Back to messages
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <header className="flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <Link
          href={`/workspace/${workspaceId}/chat`}
          className="-ml-2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 active:bg-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 dark:active:bg-zinc-700"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        {other && (
          <>
            <div className="relative">
              <UserAvatar seed={other.avatarSeed || "default"} size={40} />
              {isOtherOnline && (
                <span
                  className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-950"
                  title="Online"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                {other.nickname || "Unknown"}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                @{other.username}
                {isOtherOnline && (
                  <span className="ml-1.5 text-emerald-600 dark:text-emerald-400">• Online</span>
                )}
              </p>
            </div>
            {typeof window !== "undefined" && "Notification" in window && Notification.permission !== "granted" && (
              <button
                type="button"
                onClick={requestNotificationPermission}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 active:bg-zinc-200 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 dark:active:bg-zinc-700"
                title="Enable notifications"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
            )}
          </>
        )}
      </header>

      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4"
      >
        {isLoading && messageOffset === 0 ? (
          <MessageListSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Send a message to start the conversation
            </p>
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              if (showLoadMore && virtualRow.index === 0) {
                return (
                  <div
                    key="load-more"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="flex justify-center py-2"
                  >
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={isLoading}
                      className="min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-50 active:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-950/50 dark:active:bg-emerald-900/50 disabled:opacity-50"
                    >
                      {isLoading ? "Loading..." : "Load older messages"}
                    </button>
                  </div>
                );
              }
              const msgIdx = showLoadMore ? virtualRow.index - 1 : virtualRow.index;
              const msg = messages[msgIdx];
              if (!msg) return null;
              const isMe = msg.sender?.[0]?.id === user?.id;
              const isLatestFromOther = !isMe && msgIdx === messages.length - 1;
              return (
                <div
                  key={msg.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="flex items-start py-1"
                >
                  <div className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}>
                    {!isMe && (
                      <span
                        className={`mr-2 mt-3 flex h-2 w-2 shrink-0 rounded-full ${
                          isLatestFromOther ? "bg-emerald-500" : "bg-emerald-400/60"
                        }`}
                        title={isLatestFromOther ? "New message" : undefined}
                      />
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        isMe
                          ? msg.failed
                            ? "bg-amber-600/90 text-white"
                            : "bg-emerald-600 text-white"
                          : "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm">{msg.text}</p>
                      <p
                        className={`mt-1 text-xs ${
                          isMe
                            ? msg.failed
                              ? "text-amber-200"
                              : "text-emerald-200"
                            : "text-zinc-500 dark:text-zinc-400"
                        }`}
                      >
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                        {msg.failed && " • Failed"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {sendError && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          {sendError}
        </div>
      )}

      {typing && (() => {
        const othersTyping = typing.active.filter(
          (a: { userId?: string }) => (a as { userId?: string }).userId !== user?.id
        );
        if (othersTyping.length === 0) return null;
        const names = othersTyping.map((a: { name?: string }) => a.name).filter(Boolean);
        return (
          <div className="border-t border-zinc-200 px-4 py-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {names.length === 1
              ? `${names[0]} is typing...`
              : names.length === 2
                ? `${names[0]} and ${names[1]} are typing...`
                : `${names[0]} and ${names.length - 1} others are typing...`}
          </div>
        );
      })()}

      <form
        onSubmit={handleSend}
        className="flex gap-2 border-t border-zinc-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-zinc-800 dark:bg-zinc-950"
      >
        <ChatInputWithTyping room={room} />
      </form>
    </div>
  );
}

function ChatInputWithTyping({ room }: { room: ReturnType<typeof db.room> }) {
  const typing = db.rooms.useTypingIndicator(room, "chat");

  return (
    <>
      <input
        name="message"
        placeholder="Type a message..."
        className="min-h-[44px] flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50"
        onKeyDown={(e) => {
          typing.inputProps.onKeyDown(e);
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            (e.target as HTMLInputElement).form?.requestSubmit();
          }
        }}
      />
      <button
        type="submit"
        className="min-h-[44px] min-w-[64px] rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700 active:bg-emerald-800"
      >
        Send
      </button>
    </>
  );
}
