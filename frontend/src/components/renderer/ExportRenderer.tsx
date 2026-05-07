import React from "react";
import type { CheatsheetData, Section, Subsection, CodeLine } from "@/types/cheatsheet";
import { SECTION_COLORS } from "./sectionColors";

// Pure static component — no hooks, no "use client" — safe for renderToStaticMarkup

function getColor(i: number) {
  return SECTION_COLORS[i % SECTION_COLORS.length];
}

function applySyntax(text: string): string {
  if (!text) return "";
  return text
    .replace(/\{method:([^}]+)\}/g, '<span class="hl-method">$1</span>')
    .replace(/\{param:([^}]+)\}/g, '<span class="hl-param">$1</span>')
    .replace(/\{str:([^}]+)\}/g, '<span class="hl-str">$1</span>');
}

function stripTags(text: string): string {
  if (!text) return "";
  return text
    .replace(/\{method:([^}]+)\}/g, "$1")
    .replace(/\{param:([^}]+)\}/g, "$1")
    .replace(/\{str:([^}]+)\}/g, "$1");
}

function resolveImgSrc(src: string, resolvedSrcs: Record<string, string>): string {
  return resolvedSrcs[src] ?? src;
}

function CodeLineRow({ line, index, accentColor, resolvedSrcs }: {
  line: CodeLine; index: number; accentColor: string; resolvedSrcs: Record<string, string>;
}) {
  if (line.type === "image" && line.src) {
    const src = resolveImgSrc(line.src, resolvedSrcs);
    return (
      <div style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
        <img
          src={src}
          alt="Inline image"
          className="export-zoomable"
          style={{
            maxWidth: line.widthPercent ? `${line.widthPercent}%` : "100%",
            height: "auto",
            borderRadius: "6px",
            display: "block",
          }}
        />
      </div>
    );
  }

  if (line.type === "text") {
    return (
      <div
        className="export-text-line"
        style={{
          padding: "6px 10px",
          fontSize: "0.88rem",
          margin: "3px 0",
          borderRadius: "4px",
          borderLeft: `3px solid ${accentColor}`,
          background: `${accentColor}0d`,
          lineHeight: 1.5,
          color: "#2c3e50",
        }}
        data-md={Buffer.from(line.text || "").toString("base64")}
      />
    );
  }

  const plain = stripTags(line.command || "");
  return (
    <div
      className="export-code-line"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "4px 10px",
        fontFamily: "'Courier New', monospace",
        fontSize: "0.82rem",
        margin: "1px 0",
        borderRadius: "4px",
        backgroundColor: index % 2 === 0 ? "#f8f9fa" : "#ffffff",
      }}
    >
      <span
        style={{ color: "#2c3e50", fontWeight: 500, flexShrink: 0, flexGrow: 1 }}
        dangerouslySetInnerHTML={{ __html: applySyntax(line.command || "") }}
      />
      {line.comment && (
        <span style={{ color: "#6c757d", fontStyle: "italic", paddingLeft: "10px", fontSize: "0.76rem", flexShrink: 0 }}>
          {line.comment}
        </span>
      )}
      <button
        className="export-copy-btn"
        data-code={plain}
        style={{
          flexShrink: 0,
          marginLeft: "6px",
          padding: "1px 5px",
          fontSize: "0.65rem",
          fontFamily: "inherit",
          color: "#9ca3af",
          background: "#f3f4f6",
          border: "1px solid #e5e7eb",
          borderRadius: "3px",
          cursor: "pointer",
          opacity: 0,
          lineHeight: 1.4,
          whiteSpace: "nowrap",
        }}
      >
        copy
      </button>
    </div>
  );
}

function SubsectionStatic({ sub, sectionIndex, subIndex, color, resolvedSrcs }: {
  sub: Subsection; sectionIndex: number; subIndex: number;
  color: ReturnType<typeof getColor>; resolvedSrcs: Record<string, string>;
}) {
  const label = `${sectionIndex + 1}.${subIndex + 1}`;
  return (
    <div
      style={{
        breakInside: "avoid",
        pageBreakInside: "avoid",
        display: "block",
        width: "100%",
        marginBottom: "10px",
        border: "1px solid #e0e0e0",
        borderLeft: `3px solid ${color.badgeColor}`,
        background: "#fafbfc",
        borderRadius: "6px",
        overflow: "hidden",
      }}
    >
      <div
        className="export-subsection-header"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "5px 10px",
          background: color.headerBg,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ padding: "1px 5px", borderRadius: "3px", background: color.badgeColor, fontSize: "0.65rem", fontWeight: 700, color: "white", letterSpacing: "0.3px", flexShrink: 0 }}>
          {label}
        </div>
        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#2c3e50", flex: 1 }}>{sub.title}</span>
        <span style={{ fontSize: "0.65rem", color: "#999", flexShrink: 0 }}>▼</span>
      </div>
      <div style={{ padding: "4px 6px" }}>
        {sub.lines.map((line, idx) => (
          <CodeLineRow key={idx} line={line} index={idx} accentColor={color.badgeColor} resolvedSrcs={resolvedSrcs} />
        ))}
      </div>
    </div>
  );
}

function SectionStatic({ section, index, resolvedSrcs }: {
  section: Section; index: number; resolvedSrcs: Record<string, string>;
}) {
  const color = getColor(index);
  return (
    <div
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: "8px",
        overflow: "hidden",
        background: "#fff",
        marginBottom: "8px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      <div
        className="export-section-header"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "8px 14px",
          background: color.headerBg,
          borderBottom: "1px solid #e0e0e0",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ padding: "2px 8px", borderRadius: "4px", background: color.badgeColor, fontSize: "0.75rem", fontWeight: 700, color: "white", letterSpacing: "0.4px", flexShrink: 0 }}>
          {index + 1}
        </div>
        <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#2c3e50", flex: 1 }}>
          {section.title || "Untitled section"}
        </span>
        <span style={{ fontSize: "0.7rem", color: "#999", flexShrink: 0 }}>▼</span>
      </div>

      <div style={{ padding: "6px 14px 10px" }}>
        {section.description && (
          <div
            className="export-description"
            style={{
              fontSize: "0.82rem",
              color: "#374151",
              marginBottom: "8px",
              lineHeight: 1.6,
              padding: "7px 12px",
              borderRadius: "5px",
              borderLeft: `3px solid ${color.badgeColor}`,
              background: `${color.badgeColor}12`,
            }}
            data-md={Buffer.from(section.description).toString("base64")}
          />
        )}

        <div>
          {section.lines.map((line, idx) => (
            <CodeLineRow key={idx} line={line} index={idx} accentColor={color.badgeColor} resolvedSrcs={resolvedSrcs} />
          ))}
        </div>

        {section.subsections?.length > 0 && (
          <div style={{ columnCount: 3, columnGap: "12px", margin: "10px 0 0" }}>
            {section.subsections.map((sub, sIdx) => (
              <SubsectionStatic
                key={sub._uiId ?? sIdx}
                sub={sub}
                sectionIndex={index}
                subIndex={sIdx}
                color={color}
                resolvedSrcs={resolvedSrcs}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  fontSize: "0.72rem",
  padding: "3px 10px",
  borderRadius: "5px",
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  color: "#6b7280",
  cursor: "pointer",
  fontWeight: 500,
  fontFamily: "inherit",
};

export interface ExportRendererProps {
  data: CheatsheetData;
  // Map of /images/... path → base64 data URI
  resolvedSrcs: Record<string, string>;
}

export function ExportRenderer({ data, resolvedSrcs }: ExportRendererProps) {
  const hasDescriptions = data.sections.some((s) => s.description);

  return (
    <div style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", background: "#f0f2f5", minHeight: "100vh" }}>
      {/* Top bar */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb", padding: "12px 20px", display: "flex", alignItems: "center", gap: "12px", position: "sticky", top: 0, zIndex: 100 }}>
        <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827", margin: 0, flex: 1 }}>
          {data.title || "Untitled cheatsheet"}
        </h1>
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          <button className="export-btn-action" style={btnStyle}>▾ Expand all</button>
          <button className="export-btn-action" style={btnStyle}>▸ Collapse all</button>
          <button className="export-btn-action" style={btnStyle}>Print / PDF</button>
        </div>
      </div>

      {/* Index */}
      {hasDescriptions && (
        <div style={{ margin: "10px 12px 0", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden", background: "#fff" }}>
          <div
            className="export-index-header"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 14px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", cursor: "pointer", userSelect: "none" }}
          >
            <span style={{ color: "#6b7280", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase" }}>Index</span>
            <span style={{ color: "#9ca3af", fontSize: "0.65rem" }}>▼</span>
          </div>
          <div style={{ padding: "6px 10px 8px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "2px 8px" }}>
            {data.sections.map((section, idx) => (
              <a key={idx} href={`#section-${idx}`} className="export-index-item"
                style={{ display: "flex", alignItems: "baseline", gap: "5px", padding: "3px 4px", borderRadius: "4px", textDecoration: "none", color: "inherit" }}
              >
                <span style={{ flexShrink: 0, fontSize: "0.65rem", fontWeight: 700, color: "#9ca3af", minWidth: "16px" }}>{idx + 1}.</span>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {section.title || `Section ${idx + 1}`}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Sections */}
      <div style={{ padding: "10px 12px" }}>
        {data.sections.map((section, idx) => (
          <div key={idx} id={`section-${idx}`}>
            <SectionStatic section={section} index={idx} resolvedSrcs={resolvedSrcs} />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "12px 20px", background: "#ffffff", borderTop: "1px solid #e5e7eb", fontSize: "0.82rem", color: "#6c757d" }}>
        <span>Made with CheatSheetMaker</span>
        <span style={{ color: "#d1d5db" }}>·</span>
        <a href="https://www.linkedin.com/in/pablo-gonz%C3%A1lez-mart%C3%ADn-a026112a6/" target="_blank" rel="noopener" style={{ display: "flex", alignItems: "center", gap: "5px", color: "#0077b5", textDecoration: "none", fontWeight: 500 }}>
          Pablo González Martín
        </a>
      </div>
    </div>
  );
}
