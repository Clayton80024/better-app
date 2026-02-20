import OpenAI from "openai";

const CLASSES = [
  "passport",
  "id_card",
  "proof_of_address",
  "proof_of_funds",
  "birth_certificate",
  "immigration_form",
  "i_94",
  "i_20",
  "evidence",
  "other",
] as const;

export type DocumentClassification = (typeof CLASSES)[number];

export async function classifyDocument(
  filename: string,
  mimeType: string,
  extractedData?: unknown
): Promise<DocumentClassification> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return "other";
  }

  const client = new OpenAI({ apiKey });

  const context =
    extractedData != null
      ? `Extracted data from document: ${JSON.stringify(extractedData)}`
      : `Filename: ${filename}, MIME type: ${mimeType}. Classify based on the filename and document type.`;

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You classify immigration case documents. Reply with exactly one word from this list: ${CLASSES.join(", ")}. No other text.
- proof_of_address: utility bills, lease, residency proof (where you live)
- proof_of_funds: bank statements, investment statements, financial capacity proof
- i_94: I-94 Arrival/Departure Record, admission stamp, electronic I-94
- i_20: F-1 Student I-20, Form I-20, Certificate of Eligibility`,
        },
        {
          role: "user",
          content: `Classify this document:\n\n${context}`,
        },
      ],
      max_tokens: 20,
    });

    const text = completion.choices[0]?.message?.content?.trim().toLowerCase();
    if (text && CLASSES.includes(text as DocumentClassification)) {
      return text as DocumentClassification;
    }
    const match = CLASSES.find((c) => text?.includes(c));
    return match ?? "other";
  } catch (err) {
    console.error("OpenAI classification error:", err);
    return "other";
  }
}
