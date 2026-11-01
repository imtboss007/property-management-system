import html2pdf from "html2pdf.js";
import { saveBlobForUser, type FileDelivery } from "./mobile-export";

export type PdfExportResult = { filename: string; delivery: FileDelivery; sizeBytes: number };

const safeFilename = (value: string) => value.normalize("NFKD")
  .replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "AXIVESTRA-Report";

/** Render a complete, self-contained HTML report into a PDF Blob and deliver it on desktop or Android. */
export async function exportHtmlReportAsPdf(html: string, title: string): Promise<PdfExportResult> {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const reportBody = parsed.body;
  const reportText = reportBody?.textContent?.replace(/\s+/g, " ").trim() || "";
  if (!reportBody || reportText.length < 20) throw new Error("The report has no visible record content to export.");
  const wrapper = document.createElement("div");
  wrapper.className = "ax-pdf-export-root";
  wrapper.style.cssText = "position:fixed;left:0;top:0;width:794px;min-height:1123px;background:#fff;color:#172b3b;font:12px/1.5 Arial,sans-serif;padding:18px;visibility:hidden;opacity:0;pointer-events:none;z-index:-1;overflow:visible";
  for (const styleNode of Array.from(parsed.head.querySelectorAll("style"))) wrapper.appendChild(styleNode.cloneNode(true));
  wrapper.insertAdjacentHTML("beforeend", reportBody.innerHTML);
  document.body.appendChild(wrapper);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const filename = safeFilename(title) + ".pdf";
    const worker = html2pdf().set({
      margin: [10, 10, 12, 10],
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#fff",
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1024,
        onclone: (clonedDocument: Document) => {
          const clonedRoot = clonedDocument.querySelector<HTMLElement>(".ax-pdf-export-root");
          if (!clonedRoot) throw new Error("The PDF report could not be prepared for rendering.");
          clonedRoot.style.cssText = "position:absolute!important;left:0!important;top:0!important;width:794px!important;min-height:1123px!important;background:#fff!important;color:#172b3b!important;font:12px/1.5 Arial,sans-serif!important;padding:18px!important;visibility:visible!important;opacity:1!important;display:block!important;pointer-events:none!important;z-index:1!important;overflow:visible!important;transform:none!important";
        }
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
      pagebreak: { mode: ["css", "legacy"], avoid: [".pdf-avoid-break", ".record-head", "tr"] }
    }).from(wrapper);
    const blob = await worker.outputPdf("blob") as Blob;
    if (!(blob instanceof Blob) || blob.size < 1200 || blob.type !== "application/pdf") {
      throw new Error("The PDF generator returned an empty or invalid PDF file. Please retry the export.");
    }
    const signature = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...signature) !== "%PDF-") throw new Error("The generated file is not a readable PDF document.");
    const delivery = await saveBlobForUser(blob, filename);
    return { filename, delivery, sizeBytes: blob.size };
  } finally {
    wrapper.remove();
  }
}
