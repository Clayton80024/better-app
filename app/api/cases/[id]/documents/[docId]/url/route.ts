import { init } from "@instantdb/admin";
import { NextRequest, NextResponse } from "next/server";
import schema from "@/instant.schema";
import { getPresignedViewUrl } from "@/lib/b2";

const db = init({
  appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
  adminToken: process.env.INSTANT_APP_ADMIN_TOKEN,
  schema,
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  if (!process.env.INSTANT_APP_ADMIN_TOKEN) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const token = _request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db.auth.verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { id: caseId, docId } = await params;
  const docResult = await db.query({
    caseDocuments: {
      $: { where: { id: docId, "case.id": caseId } },
    },
  });

  const doc = docResult.caseDocuments?.[0] as { storageKey: string } | undefined;
  if (!doc?.storageKey) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    const url = await getPresignedViewUrl(doc.storageKey, 3600);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("Presigned URL error:", err);
    return NextResponse.json({ error: "Failed to get view URL" }, { status: 500 });
  }
}
