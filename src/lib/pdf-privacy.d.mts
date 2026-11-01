export type PdfIdentityMode = "name-number" | "name-only" | "blank";
export type PdfIdentityContact = { name?: string; phone?: string };
export function applyPdfIdentityPrivacy(html: string, contacts?: PdfIdentityContact[], mode?: PdfIdentityMode): string;
