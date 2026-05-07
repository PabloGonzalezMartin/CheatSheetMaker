import { View, Text, StyleSheet } from "@react-pdf/renderer";
import type { Section, Subsection } from "@/types/cheatsheet";
import { getColorForIndex } from "@/components/renderer/sectionColors";
import { PdfCodeLine } from "./PdfCodeLine";
import type { RenderedLine } from "@/lib/latexToPng";

const PAGE_H = 560;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  headerBadgeWrap: { marginRight: 5 },
  badge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "white", fontSize: 6, fontWeight: "bold" },
  title: { fontSize: 8, fontWeight: "bold", color: "#2c3e50", flex: 1 },
  body: { paddingHorizontal: 4, paddingBottom: 4 },
  description: {
    fontSize: 7,
    color: "#6b7280",
    paddingHorizontal: 8,
    paddingVertical: 1.5,
    marginBottom: 1,
    lineHeight: 1.5,
  },
  subsectionsBody: { paddingHorizontal: 4, paddingBottom: 4, paddingTop: 0 },
  columnsRow: { flexDirection: "row", alignItems: "flex-start" },
  column: { flexDirection: "column" },
  subsectionCard: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 3,
    marginBottom: 4,
  },
  subsectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  subsectionBadge: {
    fontSize: 6,
    color: "white",
    fontWeight: "bold",
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    marginRight: 3,
  },
  subsectionTitle: { fontSize: 7, fontWeight: "bold", color: "#2c3e50", flex: 1 },
  subsectionBody: { paddingHorizontal: 3, paddingBottom: 3 },
});

function lightenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.round(((num >> 16) & 0xff) + (255 - ((num >> 16) & 0xff)) * amount));
  const g = Math.min(255, Math.round(((num >> 8) & 0xff) + (255 - ((num >> 8) & 0xff)) * amount));
  const b = Math.min(255, Math.round((num & 0xff) + (255 - (num & 0xff)) * amount));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function estimateHeight(sub: Subsection, colWidthPt: number): number {
  const charsPerLine = Math.floor(colWidthPt / 5.2);
  let h = 18;
  for (const line of sub.lines ?? []) {
    if (line.type === "image") {
      h += 80;
    } else if (line.type === "text") {
      const chars = (line.text || "").length;
      h += Math.max(10, Math.ceil(chars / (charsPerLine * 1.4)) * 10) + 2;
    } else {
      const chars = (line.command || "").length;
      h += Math.max(12, Math.ceil(chars / charsPerLine) * 10);
    }
  }
  return h + 8;
}

interface SubsectionCardProps {
  sub: Subsection;
  label: string;
  accentColor: string;
  headerBg: string;
  resolvedSrcs: Record<string, string>;
  renderedLines: Record<string, RenderedLine>;
}

function SubsectionCard({ sub, label, accentColor, headerBg, resolvedSrcs, renderedLines }: SubsectionCardProps) {
  return (
    <View wrap={false} style={[styles.subsectionCard, { borderLeftWidth: 2, borderLeftColor: accentColor }]}>
      <View style={[styles.subsectionHeader, { backgroundColor: headerBg }]}>
        <Text style={[styles.subsectionBadge, { backgroundColor: accentColor }]}>{label}</Text>
        <Text style={styles.subsectionTitle}>{(sub.title || "Untitled").replace(/[^\x00-\x7F]/g, "")}</Text>
      </View>
      <View style={styles.subsectionBody}>
        {(sub.lines ?? []).map((line, lIdx) => (
          <PdfCodeLine key={lIdx} line={line} index={lIdx} accentColor={accentColor} resolvedSrcs={resolvedSrcs} renderedLines={renderedLines} isInsideSubsection />
        ))}
      </View>
    </View>
  );
}

interface Props {
  section: Section;
  colorIndex: number;
  resolvedSrcs: Record<string, string>;
  renderedLines: Record<string, RenderedLine>;
  subsectionCols?: number;
}

export function PdfSectionBlock({ section, colorIndex, resolvedSrcs, renderedLines, subsectionCols = 3 }: Props) {
  const color = getColorForIndex(colorIndex);
  const accentColor = color.badgeColor;
  const headerBg = lightenHex(accentColor, 0.85);

  const subs = section.subsections ?? [];
  const hasLines = (section.lines ?? []).length > 0;

  const cols = Math.min(subsectionCols, Math.max(1, subs.length));
  const gutterPct = 1;
  const colWidthPct = (100 - gutterPct * (cols - 1)) / cols;
  const colWidthPt = Math.floor((557 - 4 * (cols - 1)) / cols);

  const chunks: Array<{ colItems: Array<Array<{ sub: Subsection; globalIdx: number }>> }> = [];
  let remaining = subs.map((sub, idx) => ({ sub, idx }));

  while (remaining.length > 0) {
    const colHeights = Array(cols).fill(0) as number[];
    const colItems: Array<Array<{ sub: Subsection; globalIdx: number }>> = Array.from({ length: cols }, () => []);
    const consumed: number[] = [];

    for (let i = 0; i < remaining.length; i++) {
      const { sub, idx } = remaining[i];
      const h = estimateHeight(sub, colWidthPt);
      const shortest = colHeights.indexOf(Math.min(...colHeights));
      if (colHeights[shortest] + h > PAGE_H && consumed.length > 0) break;
      colItems[shortest].push({ sub, globalIdx: idx });
      colHeights[shortest] += h;
      consumed.push(i);
    }

    chunks.push({ colItems });
    for (let i = consumed.length - 1; i >= 0; i--) {
      remaining.splice(consumed[i], 1);
    }
  }

  // Strip LaTeX from description for plain text rendering in PDF
  const plainDescription = section.description
    ? section.description
        .replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, "…")
        .replace(/[*_`#[\]\\{}]/g, "")
        .replace(/\s+/g, " ")
        .trim()
    : null;

  return (
    <View style={[styles.container, { borderLeftWidth: 2, borderLeftColor: accentColor }]}>
      <View wrap={false}>
        <View style={[styles.header, { backgroundColor: headerBg }]}>
          <View style={[styles.badge, styles.headerBadgeWrap, { backgroundColor: accentColor }]}>
            <Text style={styles.badgeText}>{colorIndex + 1}</Text>
          </View>
          <Text style={styles.title}>{(section.title || "Untitled").replace(/[^\x00-\x7F]/g, "")}</Text>
        </View>
        {plainDescription ? (
          <Text style={styles.description}>{plainDescription}</Text>
        ) : null}
      </View>

      {hasLines && (
        <View style={styles.body}>
          {section.lines.map((line, idx) => (
            <PdfCodeLine key={idx} line={line} index={idx} accentColor={accentColor} resolvedSrcs={resolvedSrcs} renderedLines={renderedLines} />
          ))}
        </View>
      )}

      {chunks.length > 0 && (
        <View style={styles.subsectionsBody}>
          {chunks.map((chunk, chunkIdx) => (
            <View key={chunkIdx} wrap={false} style={styles.columnsRow}>
              {chunk.colItems.map((items, cIdx) => (
                <View
                  key={cIdx}
                  style={[
                    styles.column,
                    {
                      width: `${colWidthPct}%`,
                      marginRight: cIdx < cols - 1 ? `${gutterPct}%` : 0,
                    },
                  ]}
                >
                  {items.map(({ sub, globalIdx }) => (
                    <SubsectionCard
                      key={sub._uiId ?? globalIdx}
                      sub={sub}
                      label={`${colorIndex + 1}.${globalIdx + 1}`}
                      accentColor={accentColor}
                      headerBg={headerBg}
                      resolvedSrcs={resolvedSrcs}
                      renderedLines={renderedLines}
                    />
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
