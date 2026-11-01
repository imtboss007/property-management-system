declare module "html2pdf.js" {
  type Options = {
    margin?: number | number[];
    filename?: string;
    image?: { type?: "jpeg" | "png" | "webp"; quality?: number };
    html2canvas?: Record<string, unknown>;
    jsPDF?: Record<string, unknown>;
    pagebreak?: Record<string, unknown>;
  };
  type Worker = {
    set(options: Options): Worker;
    from(source: HTMLElement): Worker;
    outputPdf(type: "blob"): Promise<Blob>;
  };
  function html2pdf(): Worker;
  export default html2pdf;
}
