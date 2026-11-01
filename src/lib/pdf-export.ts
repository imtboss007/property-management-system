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
  wrapper.style.cssText = "position:fixed;left:0;top:0;display:block;width:794px;min-height:1123px;background:#fff;color:#172b3b;font:12px/1.5 Arial,sans-serif;padding:18px;visibility:visible;opacity:1;pointer-events:none;z-index:-1;overflow:visible;isolation:isolate";
  for (const styleNode of Array.from(parsed.head.querySelectorAll("style"))) wrapper.appendChild(styleNode.cloneNode(true));
  wrapper.insertAdjacentHTML("beforeend", reportBody.innerHTML);
  document.body.appendChild(wrapper);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const filename = safeFilename(title) + ".pdf";
    const contentHeight = Math.max(wrapper.scrollHeight, wrapper.getBoundingClientRect().height, 1123);
    const scale = Math.max(0.75, Math.min(2, 24000 / contentHeight));
    const worker = html2pdf().set({
      margin: [10, 10, 12, 10],
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#fff",
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1024,
        windowHeight: Math.min(30000, contentHeight + 100),
        onclone: (clonedDocument: Document) => {
          const clonedRoot = clonedDocument.querySelector<HTMLElement>(".ax-pdf-export-root");
          if (!clonedRoot) throw new Error("The PDF report could not be prepared for rendering.");
          clonedRoot.style.cssText = "position:absolute!important;left:0!important;top:0!important;width:794px!important;min-height:1123px!important;background:#fff!important;color:#172b3b!important;font:12px/1.5 Arial,sans-serif!important;padding:18px!important;visibility:visible!important;opacity:1!important;display:block!important;pointer-events:none!important;z-index:1!important;overflow:visible!important;transform:none!important;filter:none!important;mix-blend-mode:normal!important;isolation:isolate!important";
        }
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait", compress: true },
      pagebreak: { mode: ["css", "legacy"], avoid: [".pdf-avoid-break", ".record-head", "tr"] }
    }).from(wrapper);
    await worker.toCanvas();
    const canvas = await worker.get("canvas") as HTMLCanvasElement;
    if (!canvas || canvas.width < 100 || canvas.height < 100) throw new Error("PDF renderer returned an empty page canvas.");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("PDF renderer could not inspect the rendered page.");
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const stride = Math.max(1, Math.floor((canvas.width * canvas.height) / 24000));
    let samples = 0, bright = 0, dark = 0, luminanceTotal = 0;
    for (let i = 0; i < canvas.width * canvas.height; i += stride) {
      const offset = i * 4;
      const luminance = (pixels[offset] * 0.2126) + (pixels[offset + 1] * 0.7152) + (pixels[offset + 2] * 0.0722);
      samples++;
      luminanceTotal += luminance;
      if (luminance > 225) bright++;
      if (luminance < 210) dark++;
    }
    const averageLuminance = luminanceTotal / Math.max(1, samples);
    if (bright / samples < 0.35 || dark / samples < 0.0005 || averageLuminance < 100) {
      throw new Error("PDF rendering produced a blank or black page. The file was not downloaded; please retry.");
    }
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
