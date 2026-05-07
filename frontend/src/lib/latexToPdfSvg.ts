/**
 * Parses strings containing LaTeX ($...$ or $$...$$) and inline markdown into segments.
 * LaTeX rendering is done server-side via /latex-render (mathjax-node → SVG).
 */

export type LatexExpr = { expr: string; display: boolean };
export type ResolvedLatex = { uri: string; width: number; height: number; depth?: number };

export type TextSegment =
  | { kind: "text"; value: string; bold?: boolean; italic?: boolean; code?: boolean }
  | { kind: "latex"; expr: string; display: boolean };

export function collectExprs(segments: TextSegment[]): LatexExpr[] {
  const seen = new Set<string>();
  const out: LatexExpr[] = [];
  for (const seg of segments) {
    if (seg.kind === "latex") {
      const key = `${seg.display}:${seg.expr}`;
      if (!seen.has(key)) { seen.add(key); out.push({ expr: seg.expr, display: seg.display }); }
    }
  }
  return out;
}

export function latexKey(expr: string, display: boolean): string {
  return `${display}:${expr}`;
}

function parseInlineMarkdown(text: string): Array<{ value: string; bold: boolean; italic: boolean; code: boolean }> {
  const out: Array<{ value: string; bold: boolean; italic: boolean; code: boolean }> = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (m.index > last) out.push({ value: text.slice(last, m.index), bold: false, italic: false, code: false });
    if (m[0].startsWith("**")) out.push({ value: m[2], bold: true, italic: false, code: false });
    else if (m[0].startsWith("*"))  out.push({ value: m[3], bold: false, italic: true, code: false });
    else                             out.push({ value: m[4], bold: false, italic: false, code: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ value: text.slice(last), bold: false, italic: false, code: false });
  return out.length ? out : [{ value: text, bold: false, italic: false, code: false }];
}

export function parseLatexSegments(raw: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const cleaned = raw.replace(/^#{1,6}\s*/gm, "").replace(/^>\s*/gm, "").replace(/[^\x00-\x7F]/g, "");
  const pattern = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(cleaned)) !== null) {
    if (m.index > last) {
      for (const chunk of parseInlineMarkdown(cleaned.slice(last, m.index))) {
        if (chunk.value) segments.push({ kind: "text", ...chunk });
      }
    }
    const match = m[0];
    const display = match.startsWith("$$");
    const expr = display ? match.slice(2, -2).trim() : match.slice(1, -1).trim();
    segments.push({ kind: "latex", expr, display });
    last = m.index + match.length;
  }
  if (last < cleaned.length) {
    for (const chunk of parseInlineMarkdown(cleaned.slice(last))) {
      if (chunk.value) segments.push({ kind: "text", ...chunk });
    }
  }
  if (segments.length === 0) {
    const plain = cleaned.replace(/[*_`]/g, "");
    if (plain.trim()) segments.push({ kind: "text", value: plain, bold: false, italic: false, code: false });
  }
  return segments;
}
