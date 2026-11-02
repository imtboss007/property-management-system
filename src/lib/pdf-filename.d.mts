export type PdfFilenameMode = "name-only" | "number-only" | "name-number" | "neither";
export function buildPdfFilenameBase(args: {
  reportLabel: string;
  name?: string;
  number?: string;
  mode?: PdfFilenameMode;
}): string;
