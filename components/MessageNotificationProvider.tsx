"use client";

import { useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { db } from "@/lib/db";
import { useWorkspace } from "@/components/WorkspaceContext";

type MessageLike = {
  id: string;
  text: string;
  sender?: { id: string; nickname?: string | null; username?: string | null }[] | { id: string; nickname?: string | null; username?: string | null };
};

type ConversationLike = {
  id: string;
  messages?: MessageLike[];
};

export function MessageNotificationProvider() {
  const pathname = usePathname();
  const { user } = db.useAuth();
  const { currentWorkspace } = useWorkspace();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);

  const { data } = db.useQuery(
    user
      ? {
          conversations: {
            $: {
              where: { "participants.id": user.id },
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

  useEffect(() => {
    if (!user || typeof window === "undefined" || !("Notification" in window)) return;

    const requestPermission = () => {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    };

    requestPermission();
  }, [user]);

  useEffect(() => {
    if (!user || !data?.conversations) return;

    const conversations = (data.conversations || []) as ConversationLike[];
    const chatMatch = pathname?.match(/\/chat\/([^/]+)/);
    const currentChatId = chatMatch ? chatMatch[1] : null;

    for (const conv of conversations) {
      const latest = conv.messages?.[0];
      if (!latest) continue;

      const sender = Array.isArray(latest.sender) ? latest.sender[0] : latest.sender;
      const senderId = sender?.id;
      const isFromMe = senderId === user.id;

      if (isFromMe) {
        seenIdsRef.current.add(latest.id);
        continue;
      }

      if (!seenIdsRef.current.has(latest.id)) {
        seenIdsRef.current.add(latest.id);

        if (!initializedRef.current) continue;

        const isViewingThisChat = currentChatId === conv.id;
        const isTabFocused = !document.hidden;

        if (isViewingThisChat && isTabFocused) continue;

        const senderName = sender?.nickname || sender?.username || "Someone";
        const preview = latest.text.length > 80 ? `${latest.text.slice(0, 80)}…` : latest.text;

        if (Notification.permission === "granted") {
          const n = new Notification(`${senderName}`, {
            body: preview,
            icon: "/favicon.ico",
            tag: `msg-${conv.id}`,
          });
          n.onclick = () => {
            window.focus();
            const base = currentWorkspace ? `/workspace/${currentWorkspace.id}` : "";
            window.location.href = `${base}/chat/${conv.id}`;
            n.close();
          };
        }
      }
    }

    initializedRef.current = true;
  }, [user, data, pathname]);

  return null;
}
