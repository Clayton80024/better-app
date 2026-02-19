import { GetObjectCommand } from "@aws-sdk/client-s3";
import { init } from "@instantdb/admin";
import { NextRequest, NextResponse } from "next/server";
import schema from "@/instant.schema";
import { getB2Client, getBucketName } from "@/lib/b2";

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

  const doc = docResult.caseDocuments?.[0] as {
    storageKey: string;
    mimeType?: string;
  } | undefined;
  if (!doc?.storageKey) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  try {
    const client = getB2Client();
    const bucketName = getBucketName();
    if (!client || !bucketName) {
      return NextResponse.json({ error: "B2 not configured" }, { status: 503 });
    }
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: doc.storageKey })
    );
    const stream = res.Body;
    if (!stream) {
      return NextResponse.json({ error: "Failed to get document" }, { status: 500 });
    }
    const nodeStream = stream as NodeJS.ReadableStream;
    const body = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      nodeStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      nodeStream.once("end", () => resolve(Buffer.concat(chunks)));
      nodeStream.once("error", reject);
    });
    const contentType = doc.mimeType ?? res.ContentType ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("B2 download error:", err);
    return NextResponse.json({ error: "Failed to get document" }, { status: 500 });
  }
}
