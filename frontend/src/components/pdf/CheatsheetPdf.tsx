import { Document, Page, View, Text, Link, StyleSheet } from "@react-pdf/renderer";
import type { CheatsheetData } from "@/types/cheatsheet";
import type { RenderedLine } from "@/lib/latexToPng";
import { PdfSectionBlock } from "./PdfSectionBlock";


const styles = StyleSheet.create({
  page: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 24,
    fontFamily: "Helvetica",
  },
  header: {
    backgroundColor: "#1e3c72",
    padding: "6 14",
    marginBottom: 8,
    borderRadius: 4,
  },
  headerLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 6,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 2,
    textAlign: "center",
  },
  headerTitle: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 0.3,
  },

  /* ── Index ── */
  indexBox: {
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    marginBottom: 8,
    overflow: "hidden",
  },
  indexHeader: {
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    padding: "3 8",
    flexDirection: "row",
    alignItems: "center",
  },
  indexHeaderText: {
    color: "#9ca3af",
    fontSize: 6,
    fontWeight: "bold",
    letterSpacing: 1.2,
  },
  indexBody: {
    backgroundColor: "#ffffff",
    padding: "3 4",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  indexItem: {
    width: "25%",
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    borderRightWidth: 1,
    borderRightColor: "#f3f4f6",
  },
  indexItemRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
    marginBottom: 1,
  },
  indexNum: {
    fontSize: 6,
    color: "#9ca3af",
    fontWeight: "bold",
    flexShrink: 0,
  },
  indexTitle: {
    fontSize: 6.5,
    fontWeight: "bold",
    color: "#374151",
    lineHeight: 1.3,
    flex: 1,
  },
  indexDesc: {
    fontSize: 5.5,
    color: "#9ca3af",
    lineHeight: 1.3,
  },

  sectionsStack: {
    flexDirection: "column",
  },

  /* ── Footer ── */
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    gap: 4,
  },
  footerText: {
    fontSize: 6,
    color: "#6c757d",
  },
  footerDot: {
    fontSize: 6,
    color: "#d1d5db",
  },
  footerLink: {
    fontSize: 6,
    color: "#0077b5",
    textDecoration: "none",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
});

interface Props {
  data: CheatsheetData;
  resolvedSrcs: Record<string, string>;
  renderedLines?: Record<string, RenderedLine>;
  subsectionCols?: number;
}

export function CheatsheetPdf({ data, resolvedSrcs, renderedLines = {}, subsectionCols = 3 }: Props) {
  const hasDescriptions = (data.sections || []).some((s) => s.description);

  return (
    <Document title={data.title || "Cheatsheet"}>
      <Page size="A4" style={styles.page}>
        {/* Title header */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>CHEATSHEET</Text>
          <Text style={styles.headerTitle}>{data.title || "Untitled"}</Text>
        </View>

        {/* Index — only when at least one section has a description */}
        {hasDescriptions && (
          <View style={styles.indexBox}>
            <View style={styles.indexHeader}>
              <Text style={styles.indexHeaderText}>INDEX</Text>
            </View>
            <View style={styles.indexBody}>
              {(data.sections || []).map((section, idx) => (
                <View key={section._uiId ?? idx} style={styles.indexItem}>
                  <View style={styles.indexItemRow}>
                    <Text style={styles.indexNum}>{idx + 1}.</Text>
                    <Text style={styles.indexTitle}>
                      {section.title || `Section ${idx + 1}`}
                    </Text>
                  </View>
                  {section.description ? (
                    <Text style={styles.indexDesc}>
                      {(() => {
                        const plain = section.description
                          .replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$/g, "")
                          .replace(/[*_`#[\]\\{}]/g, "")
                          .replace(/\s+/g, " ")
                          .trim();
                        return plain.substring(0, 55) + (plain.length > 55 ? "…" : "");
                      })()}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Sections — single column, subsections inside use multi-column grid */}
        <View style={styles.sectionsStack}>
          {(data.sections || []).map((section, idx) => (
            <PdfSectionBlock key={section._uiId ?? idx} section={section} colorIndex={idx} resolvedSrcs={resolvedSrcs} renderedLines={renderedLines} subsectionCols={subsectionCols} />
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Made with CheatSheetMaker</Text>
          <Text style={styles.footerDot}>·</Text>
          <Link src="https://www.linkedin.com/in/pablo-gonz%C3%A1lez-mart%C3%ADn-a026112a6/" style={styles.footerLink}>
            <View style={{ width: 9, height: 9, backgroundColor: "#0077b5", borderRadius: 2, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "white", fontSize: 8, fontWeight: "bold" }}>in</Text>
            </View>
            <Text>Pablo González Martín</Text>
          </Link>
        </View>
      </Page>
    </Document>
  );
}
