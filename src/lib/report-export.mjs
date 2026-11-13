
const ascii = value => String(value ?? "").replace(/₹/g,"Rs. ").replace(/[–—]/g,"-").replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[^\x20-\x7E]/g," ").replace(/\s+/g," ").trim();
const escPdf = value => ascii(value).replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
const xml = value => String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const timestamp = () => new Date().toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});
const headers = ["Record / Module","Location","Value / Exposure","SR Rate","Market Rate","Settlement","Area","Contacts / Follow-up"];
const rowValues = row => {
  const contactLines = [
    row.primaryContact ? "Primary: "+row.primaryContact : "",
    row.followUpContact ? "Follow-up: "+row.followUpContact : "",
    row.primaryGroup ? "Primary group: "+row.primaryGroup : "",
    row.followUpGroup ? "Follow-up group: "+row.followUpGroup : "",
    row.followUpSummary || "",
    row.detailsSummary || ""
  ].filter(Boolean);
  const fallback = [row.contactSummary,row.followUpSummary,row.detailsSummary].filter(Boolean);
  return [row.title+" / "+row.module,row.location,row.value,row.srRate,row.marketRate,row.settlementValue,row.area,(row.primaryContact||row.followUpContact||row.primaryGroup||row.followUpGroup?contactLines:fallback).join("\n")];
};

function makePdf(title, subtitle, rows) {
  const pageW=842,pageH=595,margin=28,usable=pageW-margin*2,widths=[130,80,72,60,62,65,48,257];
  const scale=usable/widths.reduce((a,b)=>a+b,0), ws=widths.map(w=>w*scale), xs=ws.map((_,i)=>margin+ws.slice(0,i).reduce((a,b)=>a+b,0));
  const wrap=(value,max)=>{const words=String(value||"").split(/\\s+/).filter(Boolean),lines=[];let line="";for(const word of words){const next=line?line+" "+word:word;if(next.length>max&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines.length?lines:["-"];};
  const prepared=rows.map(row=>{
    const cells=rowValues(row);
    const lines=cells.map((value,i)=>String(value||"-").split("\\n").flatMap(part=>wrap(part,Math.max(8,Math.floor((ws[i]-8)/(i===7?3.0:4.0))))));
    const lineCount=Math.max(1,...lines.map(value=>value.length));
    const lineHeight=lineCount>44?5.4:7.2;
    const height=Math.max(52,lineCount*lineHeight+16);
    return {lines,lineHeight,height,lineCount};
  });
  const pages=[];let page=[],used=0;const available=438;
  prepared.forEach((item,index)=>{
    if(page.length&&used+item.height>available){pages.push(page);page=[];used=0;}
    page.push(index);used+=Math.min(item.height,available);
    if(item.height>available){pages.push(page);page=[];used=0;}
  });
  if(page.length||!pages.length)pages.push(page);
  const objs=[];const add=s=>(objs.push(s),objs.length);
  const root=add("<< /Type /Catalog /Pages 2 0 R >>"), pagesObj=add(""), font=add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"), pageIds=[];
  const t=(x,y,size,value,color)=>"BT /F1 "+size+" Tf "+(color||"0.84 0.93 0.97")+" rg 1 0 0 1 "+x.toFixed(2)+" "+y.toFixed(2)+" Tm ("+escPdf(value)+") Tj ET";
  pages.forEach((indices,pi)=>{
    const cmd=["q 0.035 0.09 0.14 rg 0 0 842 595 re f Q",t(margin,558,17,title,"0.88 0.98 1"),t(margin,540,8,subtitle,"0.55 0.73 0.82"),t(650,558,7,"Downloaded: "+timestamp(),"0.55 0.73 0.82"),t(650,540,7,"Page "+(pi+1)+" / "+pages.length,"0.55 0.73 0.82")];
    const hy=510;cmd.push("q 0.08 0.23 0.31 rg "+margin+" "+(hy-5)+" "+usable+" 20 re f Q");
    headers.forEach((h,i)=>cmd.push(t(xs[i]+4,hy+2,7,h,"0.35 0.94 0.91")));
    let cursor=hy-20;
    indices.forEach(index=>{
      const item=prepared[index],height=Math.min(item.height,available),bottom=cursor-height;
      const bg=indices.indexOf(index)%2===0?"0.055 0.13 0.20":"0.07 0.16 0.23";
      cmd.push("q "+bg+" rg "+margin+" "+bottom.toFixed(2)+" "+usable+" "+height.toFixed(2)+" re f Q");
      item.lines.forEach((cellLines,i)=>{
        const maxLines=Math.max(1,Math.floor((height-16)/item.lineHeight));
        cellLines.slice(0,maxLines).forEach((line,j)=>{
          const fontSize=item.lineCount>44?4.6:(i===7?5.5:6.1);
          cmd.push(t(xs[i]+4,cursor-13-j*item.lineHeight,fontSize,line,"0.84 0.92 0.96"));
        });
      });
      cmd.push("0.12 0.25 0.33 RG 0.3 w "+margin+" "+bottom.toFixed(2)+" m "+(margin+usable)+" "+bottom.toFixed(2)+" l S");
      cursor=bottom;
    });
    cmd.push(t(margin,24,7,"AXIVESTRA | "+rows.length+" records | Generated "+timestamp(),"0.48 0.67 0.76"));
    const stream=cmd.join("\\n"),streamId=add("<< /Length "+stream.length+" >>\\nstream\\n"+stream+"\\nendstream");
    pageIds.push(add("<< /Type /Page /Parent "+pagesObj+" 0 R /MediaBox [0 0 "+pageW+" "+pageH+"] /Resources << /Font << /F1 "+font+" 0 R >> >> /Contents "+streamId+" 0 R >>"));
  });
  objs[pagesObj-1]="<< /Type /Pages /Kids ["+pageIds.map(id=>id+" 0 R").join(" ")+"] /Count "+pageIds.length+" >>";
  let out="%PDF-1.4\\n%AXIVESTRA\\n";const offsets=[0];
  objs.forEach((obj,i)=>{offsets.push(out.length);out+=(i+1)+" 0 obj\\n"+obj+"\\nendobj\\n";});
  const xref=out.length;out+="xref\\n0 "+(objs.length+1)+"\\n0000000000 65535 f \\n";
  offsets.slice(1).forEach(n=>{out+=String(n).padStart(10,"0")+" 00000 n \\n";});
  out+="trailer\\n<< /Size "+(objs.length+1)+" /Root "+root+" 0 R >>\\nstartxref\\n"+xref+"\\n%%EOF";
  return new Blob([out],{type:"application/pdf"});
}
function slideShape(id,name,text,x,y,w,h,size,bold,fill,color) {
  const fillXml=fill?'<a:solidFill><a:srgbClr val="'+fill+'"/></a:solidFill>':"<a:noFill/>";
  const paragraphs=String(text||"").split("\n").map(line=>'<a:p><a:pPr/><a:r><a:rPr lang="en-IN" sz="'+size+'" b="'+(bold?1:0)+'"><a:solidFill><a:srgbClr val="'+(color||"EAF5FA")+'"/></a:solidFill><a:latin typeface="Aptos"/></a:rPr><a:t>'+xml(line)+'</a:t></a:r><a:endParaRPr lang="en-IN" sz="'+size+'"/></a:p>').join("");
  return '<p:sp><p:nvSpPr><p:cNvPr id="'+id+'" name="'+xml(name)+'"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="'+x+'" y="'+y+'"/><a:ext cx="'+w+'" cy="'+h+'"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom>'+fillXml+'<a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="45000" rIns="45000" tIns="20000" bIns="20000"/><a:lstStyle/>'+paragraphs+'</p:txBody></p:sp>';
}
function makeSlide(title,subtitle,rows,page,totalPages) {
  const margin=380000,usable=12192000-margin*2,cols=[["Record / Module",2050000],["Location",950000],["Value / Exposure",1050000],["SR Rate",850000],["Market Rate",850000],["Settlement",950000],["Area",650000],["Contacts / Follow-up",4070000]];
  const factor=usable/cols.reduce((a,c)=>a+c[1],0);let shapes="";
  shapes+=slideShape(2,"Title",title,margin,220000,usable,450000,2300,true,null,"E9FAFF");
  shapes+=slideShape(3,"Subtitle",subtitle+" | Downloaded "+timestamp(),margin,680000,usable,240000,900,false,null,"8FB5C6");
  const y0=1080000,headerH=350000,rowH=1200000;let x=margin;
  cols.forEach((col,i)=>{const w=Math.floor(col[1]*factor);shapes+=slideShape(10+i,"Header "+col[0],col[0],x,y0,w,headerH,800,true,"123D50","65F0DF");x+=w;});
  rows.forEach((row,ri)=>{let xx=margin;const y=y0+headerH+ri*rowH;rowValues(row).forEach((value,i)=>{const w=Math.floor(cols[i][1]*factor),txt=ascii(value||"-");shapes+=slideShape(30+ri*10+i,"Cell "+ri+" "+i,txt,xx,y,w,rowH-25000,i===7?600:720,false,ri%2===0?"102C40":"0C2537","DDEAF0");xx+=w;});});
  shapes+=slideShape(4,"Footer","AXIVESTRA | "+rows.length+" records on this slide | Page "+page+" of "+totalPages,margin,6500000,usable,180000,800,false,null,"6F94A7");
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="071827"/></a:solidFill></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'+shapes+'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>';
}
function crc32(bytes) { let c=0xFFFFFFFF;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xEDB88320:0);}return (c^0xFFFFFFFF)>>>0; }
function zipStore(files) {
  const enc=new TextEncoder(),local=[],central=[];let offset=0;
  for(const [name,content] of Object.entries(files)){
    const nb=enc.encode(name),data=typeof content==="string"?enc.encode(content):content,crc=crc32(data);
    const h=new Uint8Array(30+nb.length),v=new DataView(h.buffer);
    v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0,true);v.setUint16(8,0,true);v.setUint16(10,0,true);v.setUint16(12,33,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,nb.length,true);v.setUint16(28,0,true);h.set(nb,30);local.push(h,data);
    const ch=new Uint8Array(46+nb.length),cv=new DataView(ch.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0,true);cv.setUint16(10,0,true);cv.setUint16(12,0,true);cv.setUint16(14,33,true);cv.setUint32(16,crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,nb.length,true);cv.setUint16(30,0,true);cv.setUint16(32,0,true);cv.setUint16(34,0,true);cv.setUint16(36,0,true);cv.setUint32(38,0,true);cv.setUint32(42,offset,true);ch.set(nb,46);central.push(ch);offset+=h.length+data.length;
  }
  const centralSize=central.reduce((s,b)=>s+b.length,0),end=new Uint8Array(22),ev=new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);ev.setUint16(8,central.length,true);ev.setUint16(10,central.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);ev.setUint16(20,0,true);
  return new Blob([...local,...central,end],{type:"application/vnd.openxmlformats-officedocument.presentationml.presentation"});
}
function makePptx(title,subtitle,rows) {
  const sets=[];for(let i=0;i<rows.length;i+=4)sets.push(rows.slice(i,i+4));if(!sets.length)sets.push([]);
  const slides=sets.map((set,i)=>makeSlide(title,subtitle,set,i+1,sets.length)),slideOverrides=slides.map((_,i)=>'<Override PartName="/ppt/slides/slide'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>').join("");
  const files={
    "[Content_Types].xml":'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'+slideOverrides+'</Types>',
    "_rels/.rels":'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>',
    "ppt/presentation.xml":'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId'+(slides.length+1)+'"/></p:sldMasterIdLst><p:sldIdLst>'+slides.map((_,i)=>'<p:sldId id="'+(256+i)+'" r:id="rId'+(i+1)+'"/>').join("")+'</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>',
    "ppt/_rels/presentation.xml.rels":'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+slides.map((_,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide'+(i+1)+'.xml"/>').join("")+'<Relationship Id="rId'+(slides.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/></Relationships>',
    "ppt/slideMasters/slideMaster1.xml":'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap accent1="20D9EF" accent2="2578FF" accent3="7A6DFF" accent4="28C78A" accent5="FFBF68" accent6="FC7796" bg1="FFFFFF" bg2="071827" folHlink="954F72" hlink="0563C1" tx1="000000" tx2="FFFFFF"/><p:sldLayoutIdLst><p:sldLayoutId id="1" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>',
    "ppt/slideMasters/_rels/slideMaster1.xml.rels":'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>',
    "ppt/slideLayouts/slideLayout1.xml":'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>',
    "ppt/slideLayouts/_rels/slideLayout1.xml.rels":'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>',
    "ppt/theme/theme1.xml":'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="AXIVESTRA"><a:themeElements><a:clrScheme name="AXIVESTRA"><a:dk1><a:srgbClr val="071827"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="102C40"/></a:dk2><a:lt2><a:srgbClr val="EAF5FA"/></a:lt2><a:accent1><a:srgbClr val="20D9EF"/></a:accent1><a:accent2><a:srgbClr val="2578FF"/></a:accent2><a:accent3><a:srgbClr val="7A6DFF"/></a:accent3><a:accent4><a:srgbClr val="28C78A"/></a:accent4><a:accent5><a:srgbClr val="FFBF68"/></a:accent5><a:accent6><a:srgbClr val="FC7796"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme><a:fontScheme name="AXIVESTRA"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme><a:fmtScheme name="AXIVESTRA"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme></a:themeElements></a:theme>',
    ...Object.fromEntries(slides.map((s,i)=>["ppt/slides/slide"+(i+1)+".xml",s])),
    ...Object.fromEntries(slides.map((s,i)=>["ppt/slides/_rels/slide"+(i+1)+".xml.rels",'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>']))
  };
  return zipStore(files);
}
function save(blob,name) {
  const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export function downloadIntelligencePdf(title,subtitle,rows) {
  save(makePdf(title,subtitle,rows),"AXIVESTRA-"+title.toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-"+new Date().toISOString().slice(0,10)+".pdf");
}
export function downloadIntelligencePptx(title,subtitle,rows) {
  save(makePptx(title,subtitle,rows),"AXIVESTRA-"+title.toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-"+new Date().toISOString().slice(0,10)+".pptx");
}
