import { init, id } from "@instantdb/admin";
import { NextResponse } from "next/server";
import schema from "@/instant.schema";

const db = init({
  appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
  adminToken: process.env.INSTANT_APP_ADMIN_TOKEN,
  schema,
});

export async function POST(request: Request) {
  if (!process.env.INSTANT_APP_ADMIN_TOKEN) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let verifiedUser: { id: string };
  try {
    verifiedUser = await db.auth.verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: { otherUserId?: string; taskId?: string; workspaceId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const otherUserId = body.otherUserId?.trim();
  if (!otherUserId || otherUserId === verifiedUser.id) {
    return NextResponse.json({ error: "Invalid other user" }, { status: 400 });
  }

  const taskId = body.taskId?.trim();
  const workspaceId = body.workspaceId?.trim();

  try {
    const convId = id();
    const now = Date.now();
    const convLinks = workspaceId
      ? { participants: [verifiedUser.id, otherUserId], workspace: workspaceId }
      : { participants: [verifiedUser.id, otherUserId] };
    const tx = [
      db.tx.conversations[convId]
        .update({ createdAt: now, updatedAt: now })
        .link(convLinks),
      ...(taskId ? [db.tx.tasks[taskId].link({ interestedUsers: [verifiedUser.id] })] : []),
    ];
    await db.transact(tx);
    return NextResponse.json({ conversationId: convId });
  } catch (err) {
    console.error("Start conversation error:", err);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
