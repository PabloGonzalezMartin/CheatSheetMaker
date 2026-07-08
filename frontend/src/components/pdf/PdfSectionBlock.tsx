import { View, Text, StyleSheet } from "@react-pdf/renderer";
import type { Section, Subsection } from "@/types/cheatsheet";
import { getColorForIndex } from "@/components/renderer/sectionColors";
import { PdfCodeLine, splitTextSegments, PdfMarkdownTable, stripInlineMarkdown } from "./PdfCodeLine";
import type { RenderedLine } from "@/lib/latexToPng";

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
  /** When set, overrides rowBreak layout and forces all subsections into N equal columns */
  colOverride?: number;
}

export function PdfSectionBlock({ section, colorIndex, resolvedSrcs, renderedLines, colOverride }: Props) {
  const color = getColorForIndex(colorIndex);
  const accentColor = color.badgeColor;
  const headerBg = lightenHex(accentColor, 0.85);

  const subs = section.subsections ?? [];
  const hasLines = (section.lines ?? []).length > 0;
  const GAP = 4;

  // ── Column-override mode: ignore rowBreak, force N equal columns ──────────
  if (colOverride && colOverride > 1 && subs.length > 0) {
    const n = Math.min(colOverride, subs.length);
    const forcedCols: { sub: Subsection; globalIdx: number }[][] = Array.from({ length: n }, () => []);
    subs.forEach((sub, i) => forcedCols[i % n].push({ sub, globalIdx: i }));

    return (
      <View style={[styles.container, { borderLeftWidth: 2, borderLeftColor: accentColor }]}>
        <View wrap={false}>
          <View style={[styles.header, { backgroundColor: headerBg }]}>
            <View style={[styles.badge, styles.headerBadgeWrap, { backgroundColor: accentColor }]}>
              <Text style={styles.badgeText}>{colorIndex + 1}</Text>
            </View>
            <Text style={styles.title}>{(section.title || "Untitled").replace(/[^\x00-\x7F]/g, "")}</Text>
          </View>
          {(() => {
            const descriptionSegs = section.description ? splitTextSegments(section.description) : null;
            const descHasTable = descriptionSegs?.some((s) => s.kind === "table") ?? false;
            const plain = !descHasTable && section.description
              ? section.description.replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, "…").replace(/[*_`#[\]\\{}]/g, "").replace(/\s+/g, " ").trim()
              : null;
            if (descHasTable && descriptionSegs) {
              return (
                <View style={{ paddingHorizontal: 8, paddingBottom: 4 }}>
                  {descriptionSegs.map((seg, si) =>
                    seg.kind === "table" ? (
                      <PdfMarkdownTable key={si} headers={seg.headers} rows={seg.rows} accentColor={accentColor} />
                    ) : seg.content.trim() ? (
                      <Text key={si} style={[styles.description, { paddingHorizontal: 0, marginBottom: 2 }]}>{stripInlineMarkdown(seg.content)}</Text>
                    ) : null
                  )}
                </View>
              );
            }
            return plain ? <Text style={styles.description}>{plain}</Text> : null;
          })()}
        </View>
        {hasLines && (
          <View style={styles.body}>
            {section.lines.map((line, idx) => (
              <PdfCodeLine key={idx} line={line} index={idx} accentColor={accentColor} resolvedSrcs={resolvedSrcs} renderedLines={renderedLines} />
            ))}
          </View>
        )}
        <View style={styles.subsectionsBody}>
          <View style={styles.columnsRow}>
            {forcedCols.map((colItems, ci) => (
              <View key={ci} style={[styles.column, { flex: 1, marginRight: ci < forcedCols.length - 1 ? GAP : 0 }]}>
                {colItems.map(({ sub, globalIdx }) => (
                  <SubsectionCard key={sub._uiId ?? globalIdx} sub={sub} label={`${colorIndex + 1}.${globalIdx + 1}`} accentColor={accentColor} headerBg={headerBg} resolvedSrcs={resolvedSrcs} renderedLines={renderedLines} />
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  }

  // ── Default: rowBreak-based masonry (same logic as SectionBlock renderer) ─
  const subRows: Array<{ sub: Subsection; globalIdx: number }[]> = [];
  let curRow: { sub: Subsection; globalIdx: number }[] = [];
  for (let i = 0; i < subs.length; i++) {
    if (subs[i].rowBreak && curRow.length > 0) { subRows.push(curRow); curRow = []; }
    curRow.push({ sub: subs[i], globalIdx: i });
    if (curRow.length === 3) { subRows.push(curRow); curRow = []; }
  }
  if (curRow.length > 0) subRows.push(curRow);

  const row1 = subRows[0] ?? [];
  const row1Len = row1.length;
  const assigned1 = row1.map(r => r.sub.widthPercent ?? null);
  const fixed1 = assigned1.reduce<number>((s, w) => s + (w ?? 0), 0);
  const free1 = assigned1.filter(w => w === null).length;
  const freeW1 = free1 > 0 ? Math.max(10, (100 - fixed1) / free1) : 0;
  const row1Widths = assigned1.map(w => w !== null ? w : freeW1);

  const descriptionSegs = section.description ? splitTextSegments(section.description) : null;
  const descHasTable = descriptionSegs?.some((s) => s.kind === "table") ?? false;
  const plainDescription =
    !descHasTable && section.description
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
        {descHasTable && descriptionSegs ? (
          <View style={{ paddingHorizontal: 8, paddingBottom: 4 }}>
            {descriptionSegs.map((seg, si) =>
              seg.kind === "table" ? (
                <PdfMarkdownTable key={si} headers={seg.headers} rows={seg.rows} accentColor={accentColor} />
              ) : seg.content.trim() ? (
                <Text key={si} style={[styles.description, { paddingHorizontal: 0, marginBottom: 2 }]}>
                  {stripInlineMarkdown(seg.content)}
                </Text>
              ) : null
            )}
          </View>
        ) : plainDescription ? (
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

      {subs.length > 0 && (
        <View style={styles.subsectionsBody}>
          {row1Len <= 1 ? (
            // Single-column row1: render each row independently
            subRows.map((row, rIdx) => (
              <View key={rIdx} wrap={false} style={[styles.columnsRow, { marginBottom: rIdx < subRows.length - 1 ? GAP : 0 }]}>
                {row.map(({ sub, globalIdx }) => (
                  <View key={sub._uiId ?? globalIdx} style={[styles.column, { flex: 1 }]}>
                    <SubsectionCard sub={sub} label={`${colorIndex + 1}.${globalIdx + 1}`} accentColor={accentColor} headerBg={headerBg} resolvedSrcs={resolvedSrcs} renderedLines={renderedLines} />
                  </View>
                ))}
              </View>
            ))
          ) : (() => {
            // Multi-column masonry: items in the same column stack under each other
            const columns: Array<{ sub: Subsection; globalIdx: number }[]> =
              Array.from({ length: row1Len }, () => []);
            const overflowRows: typeof subRows = [];
            for (const row of subRows) {
              if (row.length === row1Len) {
                row.forEach(({ sub, globalIdx }, ci) => columns[ci].push({ sub, globalIdx }));
              } else {
                overflowRows.push(row);
              }
            }
            return (
              <View>
                <View style={styles.columnsRow}>
                  {columns.map((colItems, ci) => (
                    <View key={ci} style={[styles.column, { flex: row1Widths[ci], marginRight: ci < columns.length - 1 ? GAP : 0 }]}>
                      {colItems.map(({ sub, globalIdx }) => (
                        <SubsectionCard key={sub._uiId ?? globalIdx} sub={sub} label={`${colorIndex + 1}.${globalIdx + 1}`} accentColor={accentColor} headerBg={headerBg} resolvedSrcs={resolvedSrcs} renderedLines={renderedLines} />
                      ))}
                    </View>
                  ))}
                </View>
                {overflowRows.map((row, i) => (
                  <View key={`overflow-${i}`} wrap={false} style={[styles.columnsRow, { marginTop: GAP }]}>
                    {row.map(({ sub, globalIdx }) => (
                      <View key={sub._uiId ?? globalIdx} style={[styles.column, { flex: 1 }]}>
                        <SubsectionCard sub={sub} label={`${colorIndex + 1}.${globalIdx + 1}`} accentColor={accentColor} headerBg={headerBg} resolvedSrcs={resolvedSrcs} renderedLines={renderedLines} />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          })()}
        </View>
      )}
    </View>
  );
}
