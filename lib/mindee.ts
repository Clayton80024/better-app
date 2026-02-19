/**
 * Mindee extraction using v2 API (api-v2.mindee.net).
 * Requires MINDEE_API_KEY and MINDEE_MODEL_ID from app.mindee.com.
 * @see https://docs.mindee.com/getting-started/quickstart
 */
const MINDEE_V2 = "https://api-v2.mindee.net";

function getModelIds(): string[] {
  const ids = process.env.MINDEE_MODEL_ID || process.env.MINDEE_MODEL_IDS;
  if (!ids) return [];
  return ids.split(",").map((id) => id.trim()).filter(Boolean);
}

async function runExtraction(
  apiKey: string,
  modelId: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<{ data: unknown; success: boolean }> {
  const formData = new FormData();
  formData.append("model_id", modelId);
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
  formData.append("file", blob, filename);

  const enqueueRes = await fetch(`${MINDEE_V2}/v2/products/extraction/enqueue`, {
    method: "POST",
    headers: { Authorization: apiKey },
    body: formData,
  });

  if (!enqueueRes.ok) return { data: null, success: false };

  const jobData = (await enqueueRes.json()) as {
    job?: { id?: string; status?: string; result_url?: string };
  };
  const jobId = jobData?.job?.id;
  if (!jobId) return { data: null, success: false };

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const pollRes = await fetch(`${MINDEE_V2}/v2/jobs/${jobId}?redirect=false`, {
      headers: { Authorization: apiKey },
    });
    const pollData = (await pollRes.json()) as {
      job?: { status?: string; result_url?: string };
    };
    const status = pollData?.job?.status;
    const resultUrl = pollData?.job?.result_url;

    if (status === "Failed") return { data: null, success: false };
    if (status === "Processed" && resultUrl) {
      const resultRes = await fetch(resultUrl, {
        headers: { Authorization: apiKey },
      });
      if (!resultRes.ok) return { data: null, success: false };
      const resultJson = (await resultRes.json()) as {
        inference?: { result?: { fields?: Record<string, unknown> } };
      };
      const fields = resultJson?.inference?.result?.fields;
      if (fields && typeof fields === "object") {
        const data: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(fields)) {
          if (v != null && typeof v === "object" && "value" in v) {
            data[k] = (v as { value: unknown }).value;
          } else {
            data[k] = v;
          }
        }
        return { data: Object.keys(data).length > 0 ? data : fields, success: true };
      }
      return { data: null, success: false };
    }
  }

  return { data: null, success: false };
}

/** Extract with a specific Mindee model (classify-first flow). */
export async function extractWithMindeeModel(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  modelId: string
): Promise<{ data: unknown; success: boolean }> {
  const apiKey = process.env.MINDEE_API_KEY?.trim();
  if (!apiKey) return { data: null, success: false };
  return runExtraction(apiKey, modelId, buffer, filename, mimeType);
}

/** Try extraction with multiple models (legacy fallback). Prefer classify-first + extractWithMindeeModel. */
export async function extractWithMindee(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<{ data: unknown; success: boolean }> {
  const apiKey = process.env.MINDEE_API_KEY?.trim();
  const modelIds = getModelIds();
  if (!apiKey || modelIds.length === 0) return { data: null, success: false };

  for (const modelId of modelIds) {
    try {
      const result = await runExtraction(apiKey, modelId, buffer, filename, mimeType);
      if (result.success) return result;
    } catch {
      continue;
    }
  }
  return { data: null, success: false };
}
