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
    return NextResponse.json({ available: null, error: "Availability check not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username")?.toLowerCase().trim();

  if (!username) {
    return NextResponse.json({ available: false, error: "Username required" }, { status: 400 });
  }

  if (username.length < 3 || username.length > 30) {
    return NextResponse.json({ available: false, error: "Username must be 3–30 characters" }, { status: 400 });
  }

  if (!/^[a-z0-9_]+$/.test(username)) {
    return NextResponse.json({ available: false, error: "Username can only use letters, numbers, and underscores" }, { status: 400 });
  }

  try {
    const excludeUserId = searchParams.get("excludeUserId");
    const result = await db.query({
      $users: {
        $: {
          where: { username },
          limit: 2,
        },
      },
    });

    const matches = result.$users || [];
    const available = excludeUserId
      ? matches.length === 0 || (matches.length === 1 && matches[0].id === excludeUserId)
      : matches.length === 0;
    return NextResponse.json({ available });
  } catch (err) {
    console.error("Username check error:", err);
    return NextResponse.json({ available: false, error: "Check failed" }, { status: 500 });
  }
}
