import html2pdf from "html2pdf.js";
import { saveBlobForUser, type FileDelivery } from "./mobile-export";

export type PdfExportResult = { filename: string; delivery: FileDelivery; sizeBytes: number };

const safeFilename = (value: string) => value.normalize("NFKD")
  .replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "AXIVESTRA-Report";

/** Render a complete, self-contained HTML report into a PDF Blob and deliver it on desktop or Android. */
export async function exportHtmlReportAsPdf(html: string, title: string): Promise<PdfExportResult> {
  const wrapper = document.createElement("div");
  wrapper.className = "ax-pdf-export-root";
  wrapper.setAttribute("aria-hidden", "true");
  wrapper.style.cssText = "position:fixed;left:-12000px;top:0;width:794px;min-height:1123px;background:#fff;z-index:-1;overflow:visible";
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const filename = safeFilename(title) + ".pdf";
    const worker = html2pdf().set({
      margin: [10, 10, 12, 10],
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 1.8, useCORS: true, allowTaint: false, backgroundColor: "#fff", logging: false, scrollX: 0, scrollY: 0, windowWidth: 794 },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
      pagebreak: { mode: ["css", "legacy"], avoid: [".pdf-avoid-break", ".record-head", "tr"] }
    }).from(wrapper);
    const blob = await worker.outputPdf("blob") as Blob;
    if (!(blob instanceof Blob) || blob.size < 500 || blob.type !== "application/pdf") {
      throw new Error("The PDF generator did not return a valid PDF file.");
    }
    const delivery = await saveBlobForUser(blob, filename);
    return { filename, delivery, sizeBytes: blob.size };
  } finally {
    wrapper.remove();
  }
}
