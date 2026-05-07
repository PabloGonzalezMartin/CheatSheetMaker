"use client";
import katex from "katex";

export type RenderedLine = {
  png: string;
  widthPt: number;
  heightPt: number;
};

const FONT_SIZE_PX = 12;
const SCALE = 2;

function px2pt(px: number): number { return px * 0.75; }

function htmlEscape(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Render a single KaTeX expression to a non-tainted canvas image
// by using KaTeX SVG output (no foreignObject) as a blob image
function katexToImage(expr: string, displayMode: boolean, color: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    let svgStr: string;
    try {
      // KaTeX SVG output produces pure SVG paths — no foreignObject, so canvas won't be tainted
      svgStr = katex.renderToString(expr, {
        throwOnError: false,
        displayMode,
        output: "mathml", // mathml is text-only, won't taint
      });
    } catch {
      resolve(null);
      return;
    }

    // We can't use mathml directly. Use SVG output instead.
    try {
      svgStr = katex.renderToString(expr, {
        throwOnError: false,
        displayMode,
        output: "svg",
      });
    } catch {
      resolve(null);
      return;
    }

    // KaTeX SVG output has no foreignObject — safe to draw on canvas
    // Set a fill color on the SVG
    svgStr = svgStr.replace(/currentColor/g, color);

    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

type Segment =
  | { kind: "text"; value: string; bold: boolean; italic: boolean; code: boolean }
  | { kind: "math"; expr: string; display: boolean };

function parseLine(raw: string): Segment[] {
  const cleaned = raw.replace(/^#{1,6}\s*/gm, "").replace(/^>\s*/gm, "");
  const segments: Segment[] = [];
  const pattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = pattern.exec(cleaned)) !== null) {
    if (m.index > last) {
      pushTextSegments(segments, cleaned.slice(last, m.index));
    }
    const match = m[0];
    const display = match.startsWith("$$");
    const expr = display ? match.slice(2, -2).trim() : match.slice(1, -1).trim();
    segments.push({ kind: "math", expr, display });
    last = m.index + match.length;
  }
  if (last < cleaned.length) {
    pushTextSegments(segments, cleaned.slice(last));
  }
  return segments;
}

function pushTextSegments(out: Segment[], text: string) {
  // Handle **bold**, *italic*, `code` inline
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) {
      out.push({ kind: "text", value: part.slice(2, -2), bold: true, italic: false, code: false });
    } else if (part.startsWith("*") && part.endsWith("*")) {
      out.push({ kind: "text", value: part.slice(1, -1), bold: false, italic: true, code: false });
    } else if (part.startsWith("`") && part.endsWith("`")) {
      out.push({ kind: "text", value: part.slice(1, -1), bold: false, italic: false, code: true });
    } else {
      out.push({ kind: "text", value: part, bold: false, italic: false, code: false });
    }
  }
}

async function renderLineToCanvas(text: string): Promise<RenderedLine | null> {
  const segments = parseLine(text);
  const color = "#2c3e50";
  const fontFamily = "Segoe UI, Tahoma, Verdana, sans-serif";
  const fontSize = FONT_SIZE_PX;
  const lineHeight = fontSize * 1.6;
  const padX = 4;
  const padY = 2;

  // First pass: build all images and measure widths on a temp canvas
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d")!;

  type RenderedSegment =
    | { kind: "text"; value: string; bold: boolean; italic: boolean; code: boolean; width: number }
    | { kind: "math"; img: HTMLImageElement | null; svgW: number; svgH: number; display: boolean };

  // Resolve all math images in parallel
  const mathImgs = await Promise.all(
    segments.map((s) => s.kind === "math" ? katexToImage(s.expr, s.display, color) : Promise.resolve(null))
  );

  let totalWidth = padX * 2;
  let maxH = lineHeight;

  const rendered: RenderedSegment[] = segments.map((s, i) => {
    if (s.kind === "math") {
      const img = mathImgs[i];
      if (img) {
        // KaTeX SVG uses em units; scale to match font size
        const svgH = Math.ceil(img.naturalHeight * (fontSize / 10));
        const svgW = Math.ceil(img.naturalWidth * (fontSize / 10));
        totalWidth += svgW + 2;
        maxH = Math.max(maxH, svgH + padY * 2);
        return { kind: "math" as const, img, svgW, svgH, display: s.display };
      }
      return { kind: "math" as const, img: null, svgW: 0, svgH: 0, display: s.display };
    } else {
      let font = "";
      if (s.code) {
        font = `${fontSize * 0.9}px monospace`;
      } else {
        font = `${s.italic ? "italic " : ""}${s.bold ? "bold " : ""}${fontSize}px ${fontFamily}`;
      }
      tempCtx.font = font;
      const w = tempCtx.measureText(s.value).width;
      totalWidth += w;
      return { kind: "text" as const, value: s.value, bold: s.bold, italic: s.italic, code: s.code, width: w };
    }
  });

  const canvasW = Math.max(Math.ceil(totalWidth), 10);
  const canvasH = Math.max(Math.ceil(maxH + padY * 2), 10);

  const canvas = document.createElement("canvas");
  canvas.width = canvasW * SCALE;
  canvas.height = canvasH * SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(SCALE, SCALE);

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasW, canvasH);

  const baseline = canvasH / 2 + fontSize * 0.35;
  let x = padX;

  for (const seg of rendered) {
    if (seg.kind === "text") {
      if (seg.code) {
        ctx.fillStyle = "#374151";
        ctx.font = `${fontSize * 0.9}px monospace`;
      } else {
        ctx.fillStyle = color;
        ctx.font = `${seg.italic ? "italic " : ""}${seg.bold ? "bold " : ""}${fontSize}px ${fontFamily}`;
      }
      ctx.fillText(seg.value, x, baseline);
      x += seg.width;
    } else if (seg.kind === "math" && seg.img) {
      const imgY = canvasH / 2 - seg.svgH / 2;
      ctx.drawImage(seg.img, x, imgY, seg.svgW, seg.svgH);
      x += seg.svgW + 2;
    }
  }

  let png: string;
  try {
    png = canvas.toDataURL("image/png");
  } catch {
    return null;
  }

  return {
    png,
    widthPt: px2pt(canvasW),
    heightPt: px2pt(canvasH),
  };
}

export async function renderAllLatexLines(texts: string[]): Promise<Record<string, RenderedLine>> {
  if (typeof document === "undefined" || texts.length === 0) return {};

  const unique = Array.from(new Set(texts));
  const result: Record<string, RenderedLine> = {};

  const rendered = await Promise.all(unique.map((t) => renderLineToCanvas(t)));
  for (let i = 0; i < unique.length; i++) {
    const r = rendered[i];
    if (r) result[unique[i]] = r;
  }
  return result;
}

export async function renderLatexLineToPng(text: string): Promise<RenderedLine | null> {
  const map = await renderAllLatexLines([text]);
  return map[text] ?? null;
}
