"use client";
import type { CheatsheetData, CodeLine } from "@/types/cheatsheet";
import { useState, useEffect, useRef } from "react";
import { withImageToken } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

interface Props {
  data: CheatsheetData;
}

const DEBOUNCE_MS = 800;
const COL_OPTIONS = [1, 2, 3] as const;
type ColOption = typeof COL_OPTIONS[number];

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

function buildPrintHtml(data: CheatsheetData, subsectionCols: ColOption, resolvedSrcs: Record<string, string> = {}): string {
  const katexCss = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">`;
  const katexJs = `<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" onload="renderMathInElement(document.body,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false},{left:'\\\\(',right:'\\\\)',display:false},{left:'\\\\[',right:'\\\\]',display:true}]});window.parent.postMessage('katex-ready','*');"></script>`;

  function escHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderMd(text: string): string {
    // For plain text lines — escape HTML first, then apply markdown inline.
    return escHtml(text)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
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
    const cols = Math.min(subsectionCols, subs.length || 1);

    const linesHtml = (section.lines ?? []).map((line, li) => {
      if (line.type === "image" && line.src) {
        const imgSrc = resolvedSrcs[line.src];
        if (!imgSrc) return "";
        const w = line.widthPercent ? `${line.widthPercent}%` : "100%";
        return `<div style="text-align:center;margin:4px 0"><img src="${imgSrc}" style="max-width:${w};border-radius:4px"></div>`;
      }
      if (line.type === "text") {
        return `<div class="text-line" style="background:${color}11;padding:3px 8px;margin:1px 0;border-radius:3px;font-size:7.5pt;color:#2c3e50;line-height:1.2">${renderMd(line.text || "")}</div>`;
      }
      const cmd = renderCmd(line.command || "");
      const cmt = line.comment ? `<span style="color:#6c757d;font-style:italic;font-size:7pt;float:right;max-width:38%;text-align:right">${escHtml(line.comment)}</span>` : "";
      const rowBg = li % 2 === 0 ? "#f8f9fa" : "#ffffff";
      return `<div style="font-family:monospace;font-size:7.5pt;padding:2px 8px;color:#2c3e50;background:${rowBg};margin:0">${cmt}<span>${cmd}</span></div>`;
    }).join("");

    const subsHtml = subs.length === 0 ? "" : (() => {
      const columns: typeof subs[] = Array.from({ length: cols }, () => []);
      subs.forEach((s, i) => columns[i % cols].push(s));
      const colsHtml = columns.map((colSubs) => {
        const subsContent = colSubs.map((sub) => {
          const sIdx = subs.indexOf(sub);
          const subLines = (sub.lines ?? []).map((line, li) => {
            if (line.type === "image" && line.src) {
              const imgSrc = resolvedSrcs[line.src];
              if (!imgSrc) return "";
              return `<div style="text-align:center;margin:2px 0"><img src="${imgSrc}" style="max-width:100%;border-radius:3px"></div>`;
            }
            if (line.type === "text") {
              return `<div class="text-line" style="padding:3px 6px;font-size:7.5pt;color:#2c3e50;line-height:1.5;background:${color}11;margin:1px 0;border-radius:2px">${renderMd(line.text || "")}</div>`;
            }
            const cmd = renderCmd(line.command || "");
            const cmt = line.comment ? `<span style="color:#6c757d;font-style:italic;font-size:7pt;float:right">${escHtml(line.comment)}</span>` : "";
            const rowBg = li % 2 === 0 ? "#f8f9fa" : "#ffffff";
            return `<div style="font-family:monospace;font-size:7.5pt;padding:2px 6px;color:#2c3e50;background:${rowBg};margin:0">${cmt}<span>${cmd}</span></div>`;
          }).join("");
          return `<div style="margin-bottom:4px;border:1px solid #e0e0e0;border-left:2px solid ${color};border-radius:3px;overflow:hidden;break-inside:avoid">
            <div style="background:${headerBg};padding:3px 6px;font-size:7pt;font-weight:bold;color:#2c3e50">
              <span style="background:${color};color:white;border-radius:2px;padding:1px 4px;font-size:6pt;margin-right:4px">${si + 1}.${sIdx + 1}</span>${escHtml(sub.title || "")}
            </div>
            <div style="padding:2px 0">${subLines}</div>
          </div>`;
        }).join("");
        return `<div style="flex:1;min-width:0">${subsContent}</div>`;
      }).join("");
      return `<div style="display:flex;gap:6px;align-items:flex-start">${colsHtml}</div>`;
    })();

    const descInner = section.description
      ? `<div class="desc-block" style="padding:3px 10px 5px 0;font-size:7.5pt;color:#555;line-height:1.5">${renderDesc(section.description)}</div>`
      : "";

    return `<div style="margin-bottom:6px;border:1px solid #e0e0e0;border-left:2px solid ${color};border-radius:4px;overflow:hidden;break-inside:avoid">
      <div style="background:${headerBg};padding:5px 10px ${section.description ? "5px" : "5px"} 10px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="background:${color};color:white;border-radius:3px;padding:2px 6px;font-size:7pt;font-weight:bold;flex-shrink:0">${si + 1}</span>
          <span style="font-size:8.5pt;font-weight:bold;color:#2c3e50">${escHtml(section.title || "")}</span>
        </div>
        ${descInner}
      </div>
      ${linesHtml ? `<div style="padding:3px 0 0">${linesHtml}</div>` : ""}
      ${subsHtml ? `<div style="padding:${linesHtml ? "3px" : "4px"} 6px 6px">${subsHtml}</div>` : ""}
    </div>`;
  }).join("");

  const indexItemsHtml = sections.map((s, i) => {
    const plainDesc = s.description
      ? s.description.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, "").replace(/[*_`#[\]\\{}]/g, "").replace(/\s+/g, " ").trim().substring(0, 55) + (s.description.length > 55 ? "…" : "")
      : "";
    return `<div style="width:25%;padding:3px 5px;border-bottom:1px solid #f3f4f6;border-right:1px solid #f3f4f6;box-sizing:border-box">
      <div style="display:flex;align-items:baseline;gap:3px;margin-bottom:1px">
        <span style="font-size:6pt;color:#9ca3af;font-weight:bold;flex-shrink:0">${i + 1}.</span>
        <span style="font-size:6.5pt;font-weight:bold;color:#374151">${escHtml(s.title || "")}</span>
      </div>
      ${plainDesc ? `<div style="font-size:5.5pt;color:#9ca3af;line-height:1.3">${escHtml(plainDesc)}</div>` : ""}
    </div>`;
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
  .desc-block strong { font-weight: 600; }
  .desc-block em { font-style: italic; }
  .desc-block code { font-family: monospace; font-size: 0.88em; background: rgba(0,0,0,0.06); padding: 0 3px; border-radius: 2px; }
  code { font-family: monospace; font-size: 0.88em; background: #f3f4f6; padding: 0 2px; border-radius: 2px; }
  img { max-width: 100%; height: auto; display: block; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { padding: 3mm 2mm; }
    @page { margin: 3mm 2mm; size: A4; }
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
  <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px;padding-top:6px;border-top:1px solid #e0e0e0;font-size:6pt;color:#6c757d">
    <span>Made with CheatSheetMaker</span>
    <span>·</span>
    <a href="https://www.linkedin.com/in/pablo-gonz%C3%A1lez-mart%C3%ADn-a026112a6/" style="display:inline-flex;align-items:center;gap:3px;color:#0077b5;text-decoration:none">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0077b5" width="9" height="9"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
      Pablo González Martín
    </a>
  </div>
</body>
</html>`;
}

export function PdfViewerPanel({ data }: Props) {
  const { t } = useLanguage();
  const [stableData, setStableData] = useState(data);
  const [subsectionCols, setSubsectionCols] = useState<ColOption>(3);
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

  // Rebuild iframe content when data, cols, or resolved images change
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    setKatexReady(false);
    const html = buildPrintHtml(stableData, subsectionCols, resolvedSrcs);
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [stableData, subsectionCols, resolvedSrcs]);

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
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t("pdf_subsectionCols")}</span>
        <div className="flex gap-1">
          {COL_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setSubsectionCols(n)}
              className={`w-8 h-8 rounded text-sm font-semibold transition-colors ${
                subsectionCols === n ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {n}
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
