import { View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { CodeLine } from "@/types/cheatsheet";
import { SYNTAX_COLORS } from "@/lib/theme";
import type { RenderedLine } from "@/lib/latexToPng";

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    minHeight: 14,
  },
  commandWrap: {
    fontFamily: "Courier",
    fontSize: 7,
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
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
