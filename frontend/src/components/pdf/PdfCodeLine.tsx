import { View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { CodeLine } from "@/types/cheatsheet";
import { SYNTAX_COLORS } from "@/lib/theme";
import type { RenderedLine } from "@/lib/latexToPng";

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    minHeight: 14,
  },
  commandWrap: {
    fontFamily: "Courier",
    fontSize: 7,
    flex: 1,
    flexDirection: "row",
    flexWrap: "nowrap",
    overflow: "hidden",
  },
  segment: {
    fontFamily: "Courier",
    fontSize: 7,
    color: "#2c3e50",
  },
  comment: {
    fontFamily: "Courier",
    fontSize: 6,
    color: "#6c757d",
    fontStyle: "italic",
    paddingLeft: 8,
    maxWidth: "38%",
    flexShrink: 0,
    textAlign: "right",
    alignSelf: "center",
  },
  textLine: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginVertical: 1,
  },
  textContent: {
    fontSize: 7,
    color: "#2c3e50",
    lineHeight: 1.4,
  },
});

type Segment = { text: string; color: string; bold: boolean };

// ── Markdown table helpers ───────────────────────────────────────
type TextSegment = { kind: "text"; content: string } | { kind: "table"; headers: string[]; rows: string[][] };

function isSeparatorRow(row: string): boolean {
  return row.split("|").every((c) => /^\s*:?-+:?\s*$/.test(c.trim()) || c.trim() === "");
}

function parseRow(l: string): string[] {
  return l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

export function parseMarkdownTable(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text.trim().split("\n").map((l) => l.trim());
  if (lines.length < 2) return null;
  const headers = parseRow(lines[0]);
  if (!isSeparatorRow(lines[1])) return null;
  const rows = lines.slice(2).filter((l) => l.includes("|")).map(parseRow);
  return { headers, rows };
}

export function splitTextSegments(text: string): TextSegment[] {
  const lines = text.split("\n");
  const segments: TextSegment[] = [];
  let i = 0;
  while (i < lines.length) {
    // Look ahead: is this line a table header? (next non-empty line must be separator)
    if (lines[i].trim().includes("|")) {
      let sepIdx = i + 1;
      while (sepIdx < lines.length && lines[sepIdx].trim() === "") sepIdx++;
      if (sepIdx < lines.length && isSeparatorRow(lines[sepIdx])) {
        const headers = parseRow(lines[i]);
        const tableLines: string[] = [];
        let j = sepIdx + 1;
        while (j < lines.length && (lines[j].trim().includes("|") || lines[j].trim() === "")) {
          if (lines[j].trim().includes("|")) tableLines.push(lines[j]);
          j++;
        }
        segments.push({ kind: "table", headers, rows: tableLines.map(parseRow) });
        i = j;
        continue;
      }
    }
    // Accumulate plain text lines
    let textLines = "";
    while (i < lines.length && !(lines[i].trim().includes("|") && i + 1 < lines.length && isSeparatorRow(lines[i + 1]))) {
      textLines += (textLines ? "\n" : "") + lines[i];
      i++;
    }
    if (textLines.trim()) segments.push({ kind: "text", content: textLines });
  }
  return segments;
}

export function stripInlineMarkdown(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/[^\x00-\x7F]/g, "");
}

export function PdfMarkdownTable({ headers, rows, accentColor }: { headers: string[]; rows: string[][]; accentColor: string }) {
  const borderColor = "#c8cdd4";
  const colCount = headers.length;
  const colWidth = `${(100 / colCount).toFixed(1)}%`;
  const cellBase = { fontSize: 6.5, color: "#2c3e50", paddingHorizontal: 4, paddingVertical: 2 };

  return (
    <View style={{ marginVertical: 3, borderWidth: 1, borderColor }}>
      {/* Header row */}
      <View style={{ flexDirection: "row", backgroundColor: accentColor + "22" }}>
        {headers.map((h, i) => (
          <View key={i} style={{ width: colWidth, borderRightWidth: i < colCount - 1 ? 1 : 0, borderRightColor: borderColor, borderBottomWidth: 1, borderBottomColor: borderColor }}>
            <Text style={{ ...cellBase, fontFamily: "Helvetica-Bold" }}>{stripInlineMarkdown(h)}</Text>
          </View>
        ))}
      </View>
      {/* Data rows */}
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: "row", backgroundColor: ri % 2 === 0 ? "#ffffff" : "#f6f7f8" }}>
          {headers.map((_, ci) => (
            <View key={ci} style={{ width: colWidth, borderRightWidth: ci < colCount - 1 ? 1 : 0, borderRightColor: borderColor, borderBottomWidth: ri < rows.length - 1 ? 1 : 0, borderBottomColor: borderColor }}>
              <Text style={cellBase}>{stripInlineMarkdown(row[ci] ?? "")}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function parseSyntax(command: string): Segment[] {
  const segments: Segment[] = [];
  const pattern = /\{(method|param|str):([^}]+)\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(command)) !== null) {
    if (m.index > last) {
      segments.push({ text: command.slice(last, m.index), color: "#2c3e50", bold: false });
    }
    const color =
      m[1] === "method" ? SYNTAX_COLORS.method :
      m[1] === "param"  ? SYNTAX_COLORS.param  :
                          SYNTAX_COLORS.str;
    segments.push({ text: m[2], color, bold: m[1] === "method" });
    last = m.index + m[0].length;
  }
  if (last < command.length) {
    segments.push({ text: command.slice(last), color: "#2c3e50", bold: false });
  }
  return segments.length ? segments : [{ text: command, color: "#2c3e50", bold: false }];
}

interface Props {
  line: CodeLine;
  index: number;
  accentColor?: string;
  resolvedSrcs?: Record<string, string>;
  renderedLines?: Record<string, RenderedLine>;
  isInsideSubsection?: boolean;
}

export function PdfCodeLine({ line, index, accentColor = "#667eea", resolvedSrcs = {}, renderedLines = {}, isInsideSubsection = false }: Props) {
  if (line.type === "image" && line.src) {
    const src = resolvedSrcs[line.src] ?? line.src;
    const widthPct = line.widthPercent ?? 100;
    const imgWidth = isInsideSubsection ? `${Math.min(widthPct, 100)}%` : `${widthPct}%`;
    return (
      <View wrap={false} style={{ alignItems: "center", marginVertical: 4, width: "100%" }}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image
          src={src}
          style={{ width: imgWidth, ...(isInsideSubsection ? { maxHeight: 160 } : {}) }}
          // @ts-ignore
          objectFit="contain"
        />
      </View>
    );
  }

  if (line.type === "text") {
    const text = line.text || "";
    const segs = splitTextSegments(text);
    const hasTable = segs.some((s) => s.kind === "table");

    if (hasTable) {
      return (
        <View style={[styles.textLine, { backgroundColor: accentColor + "08" }]}>
          {segs.map((seg, si) =>
            seg.kind === "table" ? (
              <PdfMarkdownTable key={si} headers={seg.headers} rows={seg.rows} accentColor={accentColor} />
            ) : seg.content.trim() ? (
              <Text key={si} style={[styles.textContent, { marginBottom: 2 }]}>
                {stripInlineMarkdown(seg.content)}
              </Text>
            ) : null
          )}
        </View>
      );
    }

    const hasLatex = /\$/.test(text);

    if (hasLatex) {
      const rendered = renderedLines[text];
      if (rendered) {
        const maxW = isInsideSubsection ? 155 : 460;
        const scale = rendered.widthPt > maxW ? maxW / rendered.widthPt : 1;
        const w = rendered.widthPt * scale;
        const h = rendered.heightPt * scale;
        return (
          <View wrap={false} style={[styles.textLine, { backgroundColor: "#ffffff" }]}>
            <Image src={rendered.png} style={{ width: w, height: h }} />
          </View>
        );
      }
      const plain = text.replace(/\$\$?[^$]+\$\$?/g, "…").replace(/[*_`]/g, "");
      return (
        <View style={[styles.textLine, { backgroundColor: accentColor + "10" }]}>
          <Text style={styles.textContent}>{plain}</Text>
        </View>
      );
    }

    // Plain text (no LaTeX)
    const plain = text.replace(/[*_`]/g, "").replace(/[^\x00-\x7F]/g, "");
    return (
      <View style={[styles.textLine, { backgroundColor: accentColor + "10" }]}>
        <Text style={styles.textContent}>{plain}</Text>
      </View>
    );
  }

  const segments = parseSyntax(line.command || "");

  return (
    <View wrap={false} style={[styles.row, { backgroundColor: index % 2 === 0 ? "#f8f9fa" : "#ffffff" }]}>
      <Text style={styles.commandWrap}>
        {segments.map((seg, i) => (
          <Text
            key={i}
            style={[styles.segment, { color: seg.color, fontFamily: seg.bold ? "Courier-Bold" : "Courier" }]}
          >
            {seg.text}
          </Text>
        ))}
      </Text>
      {line.comment ? <Text style={styles.comment}>{line.comment}</Text> : null}
    </View>
  );
}
