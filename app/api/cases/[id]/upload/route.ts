import { init, id } from "@instantdb/admin";
import { NextRequest, NextResponse } from "next/server";
import schema from "@/instant.schema";
import { uploadToB2, getPresignedViewUrl } from "@/lib/b2";
import { extractWithMindeeModel } from "@/lib/mindee";
import {
  classifyDocument,
  type DocumentClassification,
} from "@/lib/openai-classify";

function getModelIdForClassification(
  classification: DocumentClassification
): string | null {
  const map: Record<DocumentClassification, string | undefined> = {
    passport: process.env.MINDEE_PASSPORT_MODEL_ID,
    id_card: process.env.MINDEE_ID_CARD_MODEL_ID,
    proof_of_address:
      process.env.MINDEE_FINANCIAL_MODEL_ID,
    proof_of_funds:
      process.env.MINDEE_BANK_STATEMENT_MODEL_ID ||
      process.env.MINDEE_FINANCIAL_MODEL_ID,
    birth_certificate: process.env.MINDEE_BIRTH_CERT_MODEL_ID,
    immigration_form: process.env.MINDEE_IMMIGRATION_MODEL_ID,
    evidence: process.env.MINDEE_EVIDENCE_MODEL_ID,
    other: undefined,
  };
  const id = map[classification]?.trim();
  return id || null;
}

const db = init({
  appId: process.env.NEXT_PUBLIC_INSTANT_APP_ID!,
  adminToken: process.env.INSTANT_APP_ADMIN_TOKEN,
  schema,
});

const ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];
const MAX_SIZE = 25 * 1024 * 1024; // 25MB

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id: caseId } = await params;
  if (!caseId) {
    return NextResponse.json({ error: "Case ID required" }, { status: 400 });
  }

  const caseResult = await db.query({
    cases: {
      $: { where: { id: caseId } },
      workspace: { owner: {}, members: {} },
    },
  });

  const caseData = caseResult.cases?.[0] as
    | {
        id: string;
        workspace?: {
          owner?: { id: string } | { id: string }[];
          members?: { id: string }[];
        };
      }
    | undefined;

  if (!caseData?.workspace) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const ws = caseData.workspace;
  const owner = ws.owner;
  const ownerId = Array.isArray(owner) ? owner[0]?.id : (owner as { id: string })?.id;
  const members = ws.members ?? [];
  const memberIds = members.map((m: { id: string }) => m.id);
  const isMember =
    ownerId === verifiedUser.id || memberIds.includes(verifiedUser.id);

  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: "File type not allowed. Use PDF or images (JPEG, PNG, WebP)." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Max 25MB." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const originalName = file.name || "document";
  const storageKey = `cases/${caseId}/${id()}-${sanitizeFilename(originalName)}`;

  try {
    await uploadToB2(storageKey, buffer, mimeType);
  } catch (err) {
    console.error("B2 upload error:", err);
    return NextResponse.json(
      { error: "Failed to upload file. Check B2 configuration." },
      { status: 500 }
    );
  }

  let viewUrl: string;
  try {
    viewUrl = await getPresignedViewUrl(storageKey, 7 * 24 * 3600);
  } catch (err) {
    console.error("Presigned URL error:", err);
    viewUrl = "";
  }

  // 1. Classify first (filename + mimeType only)
  const classification = await classifyDocument(originalName, mimeType);

  // 2. Extract only if we have a Mindee model for this classification
  const modelId = getModelIdForClassification(classification);
  let extractedData: unknown = null;
  let extractionSuccess = false;
  if (modelId) {
    const result = await extractWithMindeeModel(
      buffer,
      originalName,
      mimeType,
      modelId
    );
    extractedData = result.data;
    extractionSuccess = result.success;
  }

  const docId = id();
  const now = Date.now();
  const status = modelId
    ? extractionSuccess
      ? "processed"
      : "extraction_failed"
    : "classified";
  const processedAt = now;

  try {
    await db.transact([
        db.tx.caseDocuments[docId]
        .update({
          name: originalName,
          mimeType,
          size: file.size,
          storageKey,
          url: viewUrl,
          classification,
          extractedData: extractedData
            ? JSON.stringify(extractedData)
            : undefined,
          status,
          reviewStatus: "pending",
          createdAt: now,
          processedAt,
        })
        .link({ case: caseId }),
    ]);
  } catch (err) {
    console.error("InstantDB transact error:", err);
    return NextResponse.json(
      { error: "Failed to save document record" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    id: docId,
    status,
    classification,
    name: originalName,
    size: file.size,
  });
}
