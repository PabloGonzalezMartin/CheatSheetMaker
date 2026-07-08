"use client";
import type { CheatsheetData, CodeLine } from "@/types/cheatsheet";
import { useState, useEffect, useRef } from "react";
import { withImageToken } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

interface Props {
  data: CheatsheetData;
}

const DEBOUNCE_MS = 800;

const COL_OPTIONS = [
  { value: 0, label: "Auto", title: "Layout from editor (masonry / rowBreak)" },
  { value: 1, label: "1", title: "Force 1 column" },
  { value: 2, label: "2", title: "Force 2 columns" },
  { value: 3, label: "3", title: "Force 3 columns" },
] as const;
type ColOverride = 0 | 1 | 2 | 3;

// Build a full printable HTML page from the cheatsheet data using KaTeX for math
function collectImageSrcs(data: CheatsheetData): string[] {
  const srcs = new Set<string>();
  const scan = (lines: CodeLine[]) => { for (const l of lines) if (l.type === "image" && l.src) srcs.add(l.src); };
  for (const s of data.sections ?? []) { scan(s.lines ?? []); for (const sub of s.subsections ?? []) scan(sub.lines ?? []); }
  return Array.from(srcs);
}

async function resolveImageSrcs(srcs: string[]): Promise<Record<string, string>> {
  const pairs = await Promise.all(srcs.map(async (src) => {
    try {
      const res = await fetch(withImageToken(src));
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise<[string, string] | null>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve([src, reader.result as string]);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch { return null; }
  }));
  return Object.fromEntries(pairs.filter((p): p is [string, string] => p !== null));
}

function buildPrintHtml(data: CheatsheetData, resolvedSrcs: Record<string, string> = {}, colOverride: ColOverride = 0): string {
  const katexCss = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">`;
  const katexJs = `<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" onload="renderMathInElement(document.body,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false},{left:'\\\\(',right:'\\\\)',display:false},{left:'\\\\[',right:'\\\\]',display:true}]});window.parent.postMessage('katex-ready','*');"></script>`;

  function escHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderMd(text: string): string {
    return escHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function isTableSep(line: string): boolean {
    return line.split("|").every((c) => /^\s*:?-+:?\s*$/.test(c.trim()) || c.trim() === "");
  }

  function renderTextBlock(raw: string): string {
    const lines = raw.split("\n");
    const out: string[] = [];
    let i = 0;
    while (i < lines.length) {
      if (lines[i].trim().includes("|")) {
        let sepIdx = i + 1;
        while (sepIdx < lines.length && lines[sepIdx].trim() === "") sepIdx++;
        if (sepIdx < lines.length && isTableSep(lines[sepIdx])) {
          const parseRow = (l: string) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
          const headers = parseRow(lines[i]);
          const tableRows: string[][] = [];
          let j = sepIdx + 1;
          while (j < lines.length && lines[j].trim().includes("|")) {
            tableRows.push(parseRow(lines[j]));
            j++;
          }
          const thead = `<thead><tr>${headers.map((h) => `<th>${renderMd(h)}</th>`).join("")}</tr></thead>`;
          const tbody = `<tbody>${tableRows.map((row, ri) => `<tr>${headers.map((_, ci) => `<td>${renderMd(row[ci] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody>`;
          out.push(`<table>${thead}${tbody}</table>`);
          i = j;
          continue;
        }
      }
      if (lines[i].trim()) out.push(`<p>${renderMd(lines[i])}</p>`);
      i++;
    }
    return out.join("");
  }

  function renderDesc(text: string): string {
    // For descriptions — preserve math delimiters for KaTeX auto-render,
    // escape only HTML-special chars outside of math spans, then apply markdown.
    // Strategy: split on math regions, escape non-math parts, rejoin.
    const parts: string[] = [];
    const mathRe = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = mathRe.exec(text)) !== null) {
      if (m.index > last) {
        parts.push(renderMd(text.slice(last, m.index)));
      }
      parts.push(m[1]); // keep math verbatim for KaTeX
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push(renderMd(text.slice(last)));
    return parts.join("");
  }

  // Parse {method:x} {param:x} {str:x} syntax tokens into colored spans
  function renderCmd(command: string): string {
    const SYNTAX = { method: "#e74c3c", param: "#e67e22", str: "#27ae60" } as const;
    const pattern = /\{(method|param|str):([^}]*)\}/g;
    let last = 0;
    let out = "";
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(command)) !== null) {
      if (m.index > last) out += escHtml(command.slice(last, m.index));
      const color = SYNTAX[m[1] as keyof typeof SYNTAX];
      const bold = m[1] === "method" ? "font-weight:bold;" : "";
      out += `<span style="color:${color};${bold}">${escHtml(m[2])}</span>`;
      last = m.index + m[0].length;
    }
    if (last < command.length) out += escHtml(command.slice(last));
    return out;
  }

  const COLORS = [
    "#667eea", "#48bb78", "#ed8936", "#e53e3e", "#9f7aea",
    "#38b2ac", "#f6ad55", "#fc8181", "#68d391", "#76e4f7",
    "#b794f4", "#fbd38d",
  ];

  function getColor(i: number) { return COLORS[i % COLORS.length]; }

  function lighten(hex: string, a: number): string {
    const n = parseInt(hex.replace("#", ""), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 0xff) + (255 - ((n >> 16) & 0xff)) * a));
    const g = Math.min(255, Math.round(((n >> 8) & 0xff) + (255 - ((n >> 8) & 0xff)) * a));
    const b = Math.min(255, Math.round((n & 0xff) + (255 - (n & 0xff)) * a));
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  }

  const sections = data.sections ?? [];

  const sectionsHtml = sections.map((section, si) => {
    const color = getColor(si);
    const headerBg = lighten(color, 0.88);
    const subs = section.subsections ?? [];

    const linesHtml = (section.lines ?? []).map((line, li) => {
      if (line.type === "image" && line.src) {
        const imgSrc = resolvedSrcs[line.src];
        if (!imgSrc) return "";
        const w = line.widthPercent ? `${line.widthPercent}%` : "100%";
        return `<div style="text-align:center;margin:4px 0"><img src="${imgSrc}" style="max-width:${w};border-radius:4px"></div>`;
      }
      if (line.type === "text") {
        return `<div class="text-line" style="background:${color}11;padding:3px 8px;margin:1px 0;border-radius:3px;font-size:7.5pt;color:#2c3e50;line-height:1.4">${renderTextBlock(line.text || "")}</div>`;
      }
      const cmd = renderCmd(line.command || "");
      const cmt = line.comment ? `<span style="color:#6c757d;font-style:italic;font-size:7pt;flex-shrink:0;max-width:38%;text-align:right;word-break:break-word;white-space:normal;padding-left:8px;align-self:center;line-height:1.3">${escHtml(line.comment)}</span>` : "";
      const rowBg = li % 2 === 0 ? "#f8f9fa" : "#ffffff";
      return `<div style="font-family:monospace;font-size:7.5pt;padding:2px 8px;color:#2c3e50;background:${rowBg};margin:0;display:flex;align-items:flex-start"><span style="flex:1;min-width:0;white-space:pre-wrap;word-break:break-all">${cmd}</span>${cmt}</div>`;
    });

    const subsHtml = subs.length === 0 ? "" : (() => {
      type SubItem = typeof subs[0];

      const renderSubCard = (sub: SubItem, sIdx: number): string => {
        const subLinesArr = (sub.lines ?? []).map((line, li) => {
          if (line.type === "image" && line.src) {
            const imgSrc = resolvedSrcs[line.src];
            if (!imgSrc) return "";
            return `<div class="sub-row" style="text-align:center;margin:2px 0"><img src="${imgSrc}" style="max-width:100%;border-radius:3px"></div>`;
          }
          if (line.type === "text") {
            return `<div class="sub-row text-line" style="padding:3px 6px;font-size:7.5pt;color:#2c3e50;line-height:1.4;background:${color}11;margin:1px 0;border-radius:2px">${renderTextBlock(line.text || "")}</div>`;
          }
          const cmd = renderCmd(line.command || "");
          const cmt = line.comment ? `<span style="color:#6c757d;font-style:italic;font-size:7pt;flex-shrink:0;max-width:38%;text-align:right;word-break:break-word;white-space:normal;padding-left:8px;align-self:center;line-height:1.3">${escHtml(line.comment)}</span>` : "";
          const rowBg = li % 2 === 0 ? "#f8f9fa" : "#ffffff";
          return `<div class="sub-row" style="font-family:monospace;font-size:7.5pt;padding:2px 6px;color:#2c3e50;background:${rowBg};margin:0;display:flex;align-items:flex-start"><span style="flex:1;min-width:0;white-space:pre-wrap;word-break:break-all">${cmd}</span>${cmt}</div>`;
        }).filter(Boolean);
        const firstLine = subLinesArr[0] ?? "";
        const restLines = subLinesArr.slice(1).join("");
        return `<div style="margin-bottom:4px;border:1px solid #e0e0e0;border-left:2px solid ${color};border-radius:3px;box-decoration-break:clone;-webkit-box-decoration-break:clone">
          <div style="break-inside:avoid">
            <div style="background:${headerBg};padding:3px 6px;font-size:7pt;font-weight:bold;color:#2c3e50">
              <span style="background:${color};color:white;border-radius:2px;padding:1px 4px;font-size:6pt;margin-right:4px">${si + 1}.${sIdx + 1}</span>${escHtml(sub.title || "")}
            </div>
            ${firstLine ? `<div style="padding:2px 0 0">${firstLine}</div>` : ""}
          </div>
          ${restLines ? `<div style="padding:0 0 2px">${restLines}</div>` : ""}
        </div>`;
      };

      // ── Column override: ignore rowBreak, force N equal columns ──────────
      if (colOverride >= 1) {
        const n = Math.min(colOverride, subs.length);
        const forcedCols: Array<Array<{sub: SubItem; sIdx: number}>> = Array.from({length: n}, () => []);
        subs.forEach((sub, i) => forcedCols[i % n].push({sub, sIdx: i}));
        const colsHtml = forcedCols.map(colItems => {
          const content = colItems.map(({sub, sIdx}) => renderSubCard(sub, sIdx)).join("");
          return `<div style="flex:1;min-width:0">${content}</div>`;
        }).join("");
        return `<div style="display:flex;gap:6px;align-items:flex-start">${colsHtml}</div>`;
      }

      // ── Auto: rowBreak-based masonry ─────────────────────────────────────
      const subRows: SubItem[][] = [];
      let curRow: SubItem[] = [];
      for (const sub of subs) {
        if (sub.rowBreak && curRow.length > 0) { subRows.push(curRow); curRow = []; }
        curRow.push(sub);
        if (curRow.length === 3) { subRows.push(curRow); curRow = []; }
      }
      if (curRow.length > 0) subRows.push(curRow);

      const row1 = subRows[0] ?? [];
      const row1Len = row1.length;
      const assigned1 = row1.map((s: SubItem) => s.widthPercent ?? null);
      const fixed1 = assigned1.reduce((sum: number, w: number | null) => sum + (w ?? 0), 0);
      const free1 = assigned1.filter((w: number | null) => w === null).length;
      const freeW1 = free1 > 0 ? Math.max(10, (100 - fixed1) / free1) : 0;
      const row1Widths = assigned1.map((w: number | null) => w !== null ? w : freeW1);

      if (row1Len <= 1) {
        return subRows.map(row => {
          const items = row.map(sub => `<div style="flex:1;min-width:0">${renderSubCard(sub, subs.indexOf(sub))}</div>`).join("");
          return `<div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:4px">${items}</div>`;
        }).join("");
      }

      const columns: Array<Array<{sub: SubItem; sIdx: number}>> = Array.from({length: row1Len}, () => []);
      const overflowRows: SubItem[][] = [];
      for (const row of subRows) {
        if (row.length === row1Len) {
          row.forEach((sub, ci) => columns[ci].push({sub, sIdx: subs.indexOf(sub)}));
        } else {
          overflowRows.push(row);
        }
      }

      const columnsHtml = columns.map((colItems, ci) => {
        const content = colItems.map(({sub, sIdx}) => renderSubCard(sub, sIdx)).join("");
        return `<div style="flex:${row1Widths[ci]};min-width:0">${content}</div>`;
      }).join("");
      const overflowHtml = overflowRows.map(row => {
        const items = row.map(sub => `<div style="flex:1;min-width:0">${renderSubCard(sub, subs.indexOf(sub))}</div>`).join("");
        return `<div style="display:flex;gap:6px;align-items:flex-start;margin-top:4px">${items}</div>`;
      }).join("");

      return `<div style="display:flex;gap:6px;align-items:flex-start">${columnsHtml}</div>${overflowHtml}`;
    })();

    const descInner = section.description
      ? `<div class="desc-block" style="padding:3px 10px 5px 0;font-size:7.5pt;color:#555;line-height:1.5">${renderDesc(section.description)}</div>`
      : "";

    const firstLine = linesHtml.length > 0 ? linesHtml[0] : "";
    const restLines = linesHtml.slice(1).join("");
    // When no lines exist, anchor the header to the first subsection card so the
    // title is never left alone at the bottom of a page without any content below it.
    const hasLines = linesHtml.length > 0;

    return `<div id="section-${si}" style="margin-bottom:6px;border:1px solid #e0e0e0;border-left:2px solid ${color};border-radius:4px;overflow:hidden">
      <div style="break-inside:avoid;break-after:avoid">
        <div style="background:${headerBg};padding:5px 10px 5px 10px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="background:${color};color:white;border-radius:3px;padding:2px 6px;font-size:7pt;font-weight:bold;flex-shrink:0">${si + 1}</span>
            <span style="font-size:8.5pt;font-weight:bold;color:#2c3e50">${escHtml(section.title || "")}</span>
          </div>
          ${descInner}
        </div>
        ${firstLine ? `<div style="padding:3px 0 0">${firstLine}</div>` : ""}
      </div>
      ${restLines ? `<div style="padding:0">${restLines}</div>` : ""}
      ${subsHtml ? `<div style="padding:${hasLines ? "3px" : "4px"} 6px 6px">${subsHtml}</div>` : ""}
    </div>`;
  }).join("");

  const indexItemsHtml = sections.map((s, i) => {
    const plainDesc = s.description
      ? s.description.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, "").replace(/[*_`#[\]\\{}]/g, "").replace(/\s+/g, " ").trim().substring(0, 55) + (s.description.length > 55 ? "…" : "")
      : "";
    return `<a href="#section-${i}" class="idx-item" style="width:25%;padding:3px 5px;border-bottom:1px solid #f3f4f6;border-right:1px solid #f3f4f6;box-sizing:border-box;text-decoration:none;display:block;cursor:pointer;transition:background 0.15s">
      <div style="display:flex;align-items:baseline;gap:3px;margin-bottom:1px">
        <span style="font-size:6pt;color:#9ca3af;font-weight:bold;flex-shrink:0">${i + 1}.</span>
        <span style="font-size:6.5pt;font-weight:bold;color:#374151">${escHtml(s.title || "")}</span>
      </div>
      ${plainDesc ? `<div style="font-size:5.5pt;color:#9ca3af;line-height:1.3">${escHtml(plainDesc)}</div>` : ""}
    </a>`;
  }).join("");

  const indexHtml = `<div style="border:1px solid #e5e7eb;border-radius:4px;margin-bottom:8px;overflow:hidden">
    <div style="background:#f9fafb;border-bottom:1px solid #e5e7eb;padding:3px 8px">
      <span style="color:#9ca3af;font-size:6pt;font-weight:bold;letter-spacing:1.2px">INDEX</span>
    </div>
    <div style="display:flex;flex-wrap:wrap;background:#ffffff;padding:3px 4px">
      ${indexItemsHtml}
    </div>
  </div>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escHtml(data.title || "Cheatsheet")}</title>
${katexCss}
${katexJs}
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Verdana, sans-serif; background: white; color: #2c3e50; padding: 5mm 4mm; font-size: 8pt; }
  .text-line .katex { font-size: 0.95em; }
  .text-line p { margin: 0 0 2px; }
  .text-line table { border-collapse: collapse; width: 100%; margin: 2px 0; font-size: 7pt; }
  .text-line th, .text-line td { border: 1px solid #c8cdd4; padding: 2px 5px; text-align: left; }
  .text-line th { background: rgba(0,0,0,0.07); font-weight: 600; }
  .text-line tr:nth-child(even) td { background: rgba(0,0,0,0.03); }
  .idx-item:hover { background: #f0f4ff !important; }
  .idx-item:hover span { color: #2563eb !important; }
  .desc-block strong { font-weight: 600; }
  .desc-block em { font-style: italic; }
  .desc-block code { font-family: monospace; font-size: 0.88em; background: rgba(0,0,0,0.06); padding: 0 3px; border-radius: 2px; }
  code { font-family: monospace; font-size: 0.88em; background: #f3f4f6; padding: 0 2px; border-radius: 2px; }
  img { max-width: 100%; height: auto; display: block; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { padding: 3mm 2mm; }
    @page { margin: 3mm 2mm; size: A4; }
    .sub-row { break-inside: avoid; }
    .attribution { break-inside: avoid; }
  }
</style>
</head>
<body>
  <div style="background:linear-gradient(135deg,#1e3c72,#2a5298);color:white;padding:8px 14px;border-radius:4px;margin-bottom:8px;text-align:center">
    <div style="font-size:6pt;letter-spacing:1.5px;opacity:0.6;text-transform:uppercase;margin-bottom:2px">CHEATSHEET</div>
    <div style="font-size:13pt;font-weight:bold">${escHtml(data.title || "Untitled")}</div>
  </div>
  ${indexHtml}
  ${sectionsHtml}
  <div class="attribution" style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;padding:8px 0 4px;border-top:1px solid #e0e0e0;font-size:8pt;color:#6c757d">
    <span>Made with CheatSheetMaker</span>
    <span>·</span>
    <a href="https://www.linkedin.com/in/pablo-gonz%C3%A1lez-mart%C3%ADn-a026112a6/" style="display:inline-flex;align-items:center;gap:4px;color:#0077b5;text-decoration:none;font-weight:500">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0077b5" width="12" height="12"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      Pablo González Martín
    </a>
  </div>
</body>
</html>`;
}

export function PdfViewerPanel({ data }: Props) {
  const { t } = useLanguage();
  const [stableData, setStableData] = useState(data);
  const [colOverride, setColOverride] = useState<ColOverride>(0);
  const [printing, setPrinting] = useState(false);
  const [katexReady, setKatexReady] = useState(false);
  const [resolvedSrcs, setResolvedSrcs] = useState<Record<string, string>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const printAfterReady = useRef(false);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStableData(data), DEBOUNCE_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [data]);

  // Resolve image srcs to base64 once per stable data change
  useEffect(() => {
    const srcs = collectImageSrcs(stableData);
    if (srcs.length === 0) { setResolvedSrcs({}); return; }
    resolveImageSrcs(srcs).then(setResolvedSrcs);
  }, [stableData]);

  // Rebuild iframe content when data, column override, or resolved images change
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    setKatexReady(false);
    const html = buildPrintHtml(stableData, resolvedSrcs, colOverride);
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [stableData, resolvedSrcs, colOverride]);

  // Listen for KaTeX ready signal from iframe
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data === "katex-ready") {
        setKatexReady(true);
        if (printAfterReady.current) {
          printAfterReady.current = false;
          const iframe = iframeRef.current;
          if (iframe?.contentWindow) {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
          }
          setPrinting(false);
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function handleDownload() {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    setPrinting(true);
    if (katexReady) {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setPrinting(false);
    } else {
      // KaTeX not loaded yet — print as soon as it signals ready
      printAfterReady.current = true;
      // Fallback: if no signal arrives within 5s, print anyway
      setTimeout(() => {
        if (printAfterReady.current) {
          printAfterReady.current = false;
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setPrinting(false);
        }
      }, 5000);
    }
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        {/* Column override selector */}
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t("pdf_subsectionCols")}</span>
        <div className="flex gap-1">
          {COL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              title={opt.title}
              onClick={() => setColOverride(opt.value as ColOverride)}
              className={`h-7 px-2 rounded text-xs font-semibold transition-colors ${
                colOverride === opt.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={handleDownload}
          disabled={printing || !katexReady}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L9 11.586V4a1 1 0 011-1zm-7 12a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"/>
          </svg>
          {printing ? t("pdf_opening") : !katexReady ? t("pdf_loading") : t("pdf_download")}
        </button>
        <a
          href="https://www.linkedin.com/in/pablo-gonz%C3%A1lez-mart%C3%ADn-a026112a6/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-[#0077b5] hover:underline font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          Pablo González Martín
        </a>
      </div>

      <div className="relative flex-1 bg-gray-100">
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0 bg-white"
          title="PDF Preview"
        />
      </div>
    </div>
  );
}
