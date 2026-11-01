import { jsPDF } from "jspdf";
import { saveBlobForUser, type FileDelivery } from "./mobile-export";

export type PdfExportResult = { filename: string; delivery: FileDelivery; sizeBytes: number };

const safeFilename = (value: string) => value.normalize("NFKD")
  .replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "AXIVESTRA-Report";

// jsPDF's built-in Helvetica fonts are WinAnsi. Normalize common Indian/typographic
// symbols before rendering so they cannot corrupt the PDF content stream.
const pdfText = (value: string) => String(value ?? "")
  .replace(/\u00a0/g, " ")
  .replace(/[₹]/g, "INR ")
  .replace(/[•·]/g, " | ")
  .replace(/[–—]/g, "-")
  .replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'")
  .replace(/…/g, "...")
  .replace(/[\u200B-\u200D\uFEFF]/g, "")
  .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");

type DrawOptions = { fontSize?: number; bold?: boolean; color?: [number,number,number]; indent?: number; after?: number };

function drawText(doc: jsPDF, value: string, y: number, options: DrawOptions, page: { left:number; right:number; top:number; bottom:number; width:number; height:number }): number {
  const fontSize = options.fontSize ?? 8;
  const lineHeight = fontSize * 0.42 + 1.1;
  const x = page.left + (options.indent ?? 0);
  const maxWidth = page.width - (options.indent ?? 0);
  doc.setFont("helvetica", options.bold ? "bold" : "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...(options.color ?? [35,52,66]));
  const lines = doc.splitTextToSize(pdfText(value), maxWidth) as string[];
  for (const line of lines) {
    if (y + lineHeight > page.bottom) {
      doc.addPage();
      y = page.top;
    }
    doc.text(line, x, y + fontSize * 0.34);
    y += lineHeight;
  }
  return y + (options.after ?? 1.4);
}

function drawTable(doc: jsPDF, table: HTMLTableElement, y: number, page: { left:number; right:number; top:number; bottom:number; width:number; height:number }): number {
  const rowNodes = Array.from(table.querySelectorAll("tr"));
  const rows = rowNodes.map(row => Array.from(row.cells).map(cell => pdfText(cell.textContent || "").replace(/\s+/g," ").trim()));
  const columnCount = Math.max(1,...rows.map(row=>row.length));
  const headerRows = new Set(rowNodes.map((row,index) => row.closest("thead") ? index : -1).filter(index => index >= 0));
  const headerFont = columnCount >= 9 ? 5.1 : columnCount >= 5 ? 6.1 : 7.5;
  const bodyFont = columnCount >= 9 ? 4.8 : columnCount >= 5 ? 5.9 : 7.2;
  const paddingX = columnCount >= 9 ? 1.0 : 1.6;
  const paddingY = columnCount >= 9 ? 1.0 : 1.4;
  const widths = columnCount === 2
    ? [page.width * 0.30, page.width * 0.70]
    : Array.from({length:columnCount},()=>page.width / columnCount);
  const maxPrintableHeight = page.bottom - page.top - 6;

  rows.forEach((cells,rowIndex) => {
    const isHeader = headerRows.has(rowIndex) || Boolean(rowNodes[rowIndex]?.querySelector("th"));
    const fontSize = isHeader ? headerFont : bodyFont;
    const lineHeight = fontSize * 0.42 + 0.85;
    doc.setFont("helvetica",isHeader?"bold":"normal");
    doc.setFontSize(fontSize);
    const wrapped = Array.from({length:columnCount},(_,columnIndex) => {
      const text = cells[columnIndex] || "";
      return doc.splitTextToSize(text,Math.max(5,widths[columnIndex]-paddingX*2)) as string[];
    });
    const maxLines = Math.max(1,...wrapped.map(lines=>lines.length));
    const linesPerChunk = Math.max(2,Math.floor((maxPrintableHeight-paddingY*2)/lineHeight));
    for(let start=0;start<maxLines;start+=linesPerChunk){
      const chunkLines = Math.min(linesPerChunk,maxLines-start);
      const rowHeight = chunkLines*lineHeight+paddingY*2;
      if(y+rowHeight>page.bottom){
        doc.addPage();
        y=page.top;
      }
      let x=page.left;
      for(let columnIndex=0;columnIndex<columnCount;columnIndex++){
        const width=widths[columnIndex];
        doc.setFillColor(...(isHeader?[232,243,246]:[255,255,255]));
        doc.setDrawColor(205,218,227);
        doc.setLineWidth(0.12);
        doc.rect(x,y,width,rowHeight,"FD");
        doc.setFont("helvetica",isHeader?"bold":"normal");
        doc.setFontSize(fontSize);
        doc.setTextColor(...(isHeader?[35,66,87]:[35,55,70]));
        const slice=wrapped[columnIndex].slice(start,start+chunkLines);
        if(slice.length)doc.text(slice,x+paddingX,y+paddingY+fontSize*0.34);
        x+=width;
      }
      y+=rowHeight;
    }
  });
  return y+3;
}

/** Generate a searchable, vector-text PDF. No html2canvas/page screenshot is used. */
export async function exportHtmlReportAsPdf(html: string, title: string): Promise<PdfExportResult> {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const body = parsed.body;
  const reportText = body?.textContent?.replace(/\s+/g, " ").trim() || "";
  if (!body || reportText.length < 20) throw new Error("The report has no visible record content to export.");

  const tables = Array.from(body.querySelectorAll("table"));
  const maxColumns = Math.max(1,...tables.map(table=>Math.max(1,...Array.from(table.querySelectorAll("tr")).map(row=>row.cells.length))));
  const orientation = maxColumns >= 5 ? "landscape" : "portrait";
  const doc = new jsPDF({orientation,unit:"mm",format:"a4",compress:true});
  doc.setProperties({title,subject:"AXIVESTRA workspace export",creator:"AXIVESTRA"});
  const pageWidth=doc.internal.pageSize.getWidth();
  const pageHeight=doc.internal.pageSize.getHeight();
  const page={left:12,right:12,top:14,bottom:pageHeight-15,width:pageWidth-24,height:pageHeight};
  let y=page.top;

  const renderNode=(node:Element):void=>{
    const tag=node.tagName.toUpperCase();
    if(tag==="STYLE"||tag==="SCRIPT"||tag==="META"||tag==="LINK")return;
    if(tag==="TABLE"){
      y=drawTable(doc,node as HTMLTableElement,y,page);
      return;
    }
    if(tag==="HR"){
      if(y+4>page.bottom){doc.addPage();y=page.top;}
      doc.setDrawColor(190,207,218);
      doc.line(page.left,y,pageWidth-page.right,y);
      y+=4;
      return;
    }
    if(tag==="BR"){y+=2;return;}
    if(tag==="IMG")return;
    const text=(node.textContent||"").replace(/\s+/g," ").trim();
    const children=Array.from(node.children);
    if(["H1","H2","H3","H4"].includes(tag)){
      if(y>page.top+2)y+=2;
      const style:DrawOptions=tag==="H1"
        ? {fontSize:15,bold:true,color:[12,49,72],after:3}
        : tag==="H2"
          ? {fontSize:11.5,bold:true,color:[18,93,120],after:2}
          : {fontSize:9.2,bold:true,color:[20,100,126],after:1.5};
      y=drawText(doc,text,y,style,page);
      return;
    }
    if(tag==="P"||tag==="LI"||tag==="STRONG"||tag==="SMALL"||tag==="SPAN"){
      if(text)y=drawText(doc,(tag==="LI"?"- ":"")+text,y,{
        fontSize:tag==="SMALL"?6.8:tag==="STRONG"?8.8:tag==="SPAN"?7.4:7.6,
        bold:tag==="STRONG",color:tag==="SMALL"?[98,119,135]:[35,52,66],after:tag==="P"?1.8:1
      },page);
      return;
    }
    if(children.length){
      for(const child of children)renderNode(child);
      return;
    }
    if(text)y=drawText(doc,text,y,{fontSize:7.5,after:1.2},page);
  };

  for(const child of Array.from(body.children))renderNode(child);
  if(doc.getNumberOfPages()<1)throw new Error("PDF generation produced no pages.");

  const pageCount=doc.getNumberOfPages();
  for(let pageNumber=1;pageNumber<=pageCount;pageNumber++){
    doc.setPage(pageNumber);
    doc.setFont("helvetica","normal");
    doc.setFontSize(6.5);
    doc.setTextColor(112,130,145);
    doc.text("AXIVESTRA - Confidential workspace export",page.left,pageHeight-7);
    doc.text("Page "+pageNumber+" of "+pageCount,pageWidth-page.right,pageHeight-7,{align:"right"});
  }

  const arrayBuffer=doc.output("arraybuffer") as ArrayBuffer;
  if(!(arrayBuffer instanceof ArrayBuffer)||arrayBuffer.byteLength<1000)throw new Error("PDF generation returned an empty document.");
  const signature=new Uint8Array(arrayBuffer.slice(0,5));
  if(String.fromCharCode(...signature)!=="%PDF-")throw new Error("The generated file is not a valid PDF document.");
  const blob=new Blob([arrayBuffer],{type:"application/pdf"});
  const filename=safeFilename(title)+".pdf";
  const delivery=await saveBlobForUser(blob,filename);
  return {filename,delivery,sizeBytes:blob.size};
}
