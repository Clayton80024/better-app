import { init } from "@instantdb/admin";
import { NextResponse } from "next/server";
import schema from "@/instant.schema";

const db = init({
  appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
  adminToken: process.env.INSTANT_APP_ADMIN_TOKEN,
  schema,
});

export async function GET(request: Request) {
  if (!process.env.INSTANT_APP_ADMIN_TOKEN) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username")?.toLowerCase().replace(/^@/, "").trim();

  if (!username || username.length < 2) {
    return NextResponse.json({ error: "Username required (min 2 chars)" }, { status: 400 });
  }

  try {
    const result = await db.query({
      $users: {
        $: {
          where: { username },
          limit: 5,
        },
      },
    });

    const users = (result.$users || []).map((u: { id: string; username?: string; nickname?: string; avatarSeed?: string }) => ({
      id: u.id,
      username: u.username,
      nickname: u.nickname,
      avatarSeed: u.avatarSeed,
    }));

    return NextResponse.json({ users });
  } catch (err) {
    console.error("Find user error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
