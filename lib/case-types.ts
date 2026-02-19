export const CASE_TYPES = [
  "AOS Marriage",
  "AOS Employment",
  "Naturalization",
  "DACA",
  "TPS",
  "Asylum",
  "Family Petition",
  "Other",
] as const;

export type CaseType = (typeof CASE_TYPES)[number];
