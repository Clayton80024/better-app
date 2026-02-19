import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.B2_ENDPOINT;
const keyId = process.env.B2_APPLICATION_KEY_ID;
const appKey = process.env.B2_APPLICATION_KEY;
const bucket = process.env.B2_BUCKET_NAME;

export function getB2Client(): S3Client | null {
  if (!endpoint || !keyId || !appKey || !bucket) return null;
  const region = endpoint.startsWith("s3.") && endpoint.includes(".backblazeb2.com")
    ? endpoint.split(".")[1] ?? "us-west-002"
    : "us-west-002";
  return new S3Client({
    endpoint: `https://${endpoint}`,
    region,
    credentials: {
      accessKeyId: keyId.trim(),
      secretAccessKey: appKey.trim(),
    },
    forcePathStyle: true,
  });
}

export function getBucketName(): string | null {
  return bucket ?? null;
}

export async function uploadToB2(
  key: string,
  body: Buffer,
  contentType: string
): Promise<{ key: string }> {
  const client = getB2Client();
  const bucketName = getBucketName();
  if (!client || !bucketName) {
    throw new Error("B2 not configured");
  }
  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return { key };
}

export async function getPresignedViewUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const client = getB2Client();
  const bucketName = getBucketName();
  if (!client || !bucketName) {
    throw new Error("B2 not configured");
  }
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucketName, Key: key }),
    { expiresIn }
  );
  return url;
}

export async function downloadFromB2(
  key: string
): Promise<{ body: Buffer; contentType?: string } | null> {
  const client = getB2Client();
  const bucketName = getBucketName();
  if (!client || !bucketName) return null;
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucketName, Key: key })
  );
  const stream = res.Body;
  if (!stream) return null;
  const body = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const nodeStream = stream as unknown as NodeJS.ReadableStream;
    nodeStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    nodeStream.once("end", () => resolve(Buffer.concat(chunks)));
    nodeStream.once("error", reject);
  });
  return {
    body,
    contentType: res.ContentType ?? undefined,
  };
}
