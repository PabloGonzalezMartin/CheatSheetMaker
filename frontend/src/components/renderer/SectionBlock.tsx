"use client";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Section } from "@/types/cheatsheet";
import { getColorForIndex } from "./sectionColors";
import { CodeLineDisplay } from "./CodeLineDisplay";
import { SubsectionBlock } from "./SubsectionBlock";
import { withImageToken } from "@/lib/api";
import { ImageLightbox } from "./ImageLightbox";
import { useEditorStore } from "@/store/editorStore";

interface Props {
  section: Section;
  index: number;
  searchQuery?: string;
}

export function SectionBlock({ section, index, searchQuery }: Props) {
  const color = getColorForIndex(index);
  const expandedSections = useEditorStore((s) => s.expandedSections);
  const setSectionExpanded = useEditorStore((s) => s.setSectionExpanded);
  // If the editor has a record for this section, mirror it; otherwise start collapsed
  const initialCollapsed = section._uiId ? !expandedSections.has(section._uiId) : true;
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const elRef = useRef<HTMLDivElement>(null);

  // Keep store in sync
  useEffect(() => {
    if (section._uiId) setSectionExpanded(section._uiId, !collapsed);
  }, [collapsed, section._uiId, setSectionExpanded]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const handleExpand = () => setCollapsed(false);
    const handleExpandAll = () => setCollapsed(false);
    const handleCollapseAll = () => setCollapsed(true);
    el.addEventListener("expand-section", handleExpand);
    document.addEventListener("expand-all-sections", handleExpandAll);
    document.addEventListener("collapse-all-sections", handleCollapseAll);
    return () => {
      el.removeEventListener("expand-section", handleExpand);
      document.removeEventListener("expand-all-sections", handleExpandAll);
      document.removeEventListener("collapse-all-sections", handleCollapseAll);
    };
  }, []);

  useEffect(() => {
    if (searchQuery?.trim()) setCollapsed(false);
  }, [searchQuery]);

  return (
    <>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <div
        ref={elRef}
        id={`section-${index}`}
        data-section-block
        style={{
          border: "1px solid #e0e0e0",
          borderRadius: "8px",
          overflow: "hidden",
          background: "#fff",
          marginBottom: "8px",
        }}
      >
        <div
          onClick={() => {
            setCollapsed((c) => {
              const expanding = c; // c is current collapsed state; if true, we're expanding
              if (expanding) {
                // After re-render, collapse all subsections inside this section
                requestAnimationFrame(() => {
                  elRef.current?.querySelectorAll("[data-subsection-container]").forEach((sub) => {
                    sub.dispatchEvent(new CustomEvent("collapse-subsection"));
                  });
                });
              }
              return !c;
            });
          }}
          style={{
            background: color.headerBg,
            borderBottom: collapsed ? "none" : "1px solid #e0e0e0",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 14px" }}>
            <div
              style={{
                padding: "2px 8px",
                borderRadius: "4px",
                background: color.badgeColor,
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "white",
                letterSpacing: "0.4px",
                flexShrink: 0,
              }}
            >
              {index + 1}
            </div>
            <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#2c3e50", flex: 1 }}>
              {section.title || <em style={{ color: "#aaa", fontWeight: 400 }}>Untitled section</em>}
            </span>
            <svg viewBox="0 0 10 10" fill="none" stroke="#999" strokeWidth="2" style={{ width: "10px", height: "10px", flexShrink: 0, transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform 0.15s" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 3.5L5 6.5 8 3.5"/>
            </svg>
          </div>
          {section.description && (
            <div
              style={{ padding: "0 14px 8px 46px", fontSize: "0.8rem", color: "#555", lineHeight: 1.5 }}
              className="renderer-text-line"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {section.description}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {!collapsed && (
          <div style={{ padding: "6px 14px 10px" }}>

            {/* Lines (code, text, image) */}
            <div>
              {section.lines.map((line, idx) => {
                if (line.type === "image" && line.src) {
                  const src = withImageToken(line.src);
                  return (
                    <div key={idx} style={{ display: "flex", justifyContent: "center", margin: "6px 0" }}>
                      <img
                        src={src}
                        alt="Section image"
                        className="img-zoomable"
                        onClick={() => setLightboxSrc(src)}
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
                return (
                  <CodeLineDisplay key={idx} line={line} index={idx} searchQuery={searchQuery} accentColor={color.badgeColor} />
                );
              })}
            </div>

            {section.subsections?.length > 0 && (
              <div style={{ margin: "10px 0 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "6px", paddingTop: "4px", borderTop: "1px solid #f0f0f0" }}>
                <span style={{ fontSize: "0.68rem", color: "#aaa", fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", marginRight: "2px" }}>Subsections</span>
                <button
                  onClick={() => document.dispatchEvent(new CustomEvent("expand-all-subsections"))}
                  title="Expand all subsections"
                  style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: "0.68rem", color: "#9ca3af", background: "white", border: "1px solid #e5e7eb", borderRadius: "4px", padding: "1px 6px", cursor: "pointer", lineHeight: 1.6 }}
                >
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "8px", height: "8px" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 3.5L5 6.5 8 3.5"/>
                  </svg>
                  All
                </button>
                <button
                  onClick={() => document.dispatchEvent(new CustomEvent("collapse-all-subsections"))}
                  title="Collapse all subsections"
                  style={{ display: "flex", alignItems: "center", gap: "2px", fontSize: "0.68rem", color: "#9ca3af", background: "white", border: "1px solid #e5e7eb", borderRadius: "4px", padding: "1px 6px", cursor: "pointer", lineHeight: 1.6 }}
                >
                  <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: "8px", height: "8px", transform: "rotate(-90deg)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2 3.5L5 6.5 8 3.5"/>
                  </svg>
                  All
                </button>
              </div>
              {(() => {
                const numCols = section.subsections.length >= 3 ? 3 : section.subsections.length;
                const cols: typeof section.subsections[] = Array.from({ length: numCols }, () => []);
                section.subsections.forEach((sub, i) => cols[i % numCols].push(sub));
                return (
                  <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    {cols.map((colSubs, cIdx) => (
                      <div key={cIdx} style={{ flex: 1, minWidth: 0 }}>
                        {colSubs.map((sub) => {
                          const sIdx = section.subsections.indexOf(sub);
                          return (
                            <SubsectionBlock
                              key={sub._uiId ?? sIdx}
                              subsection={sub}
                              sectionIndex={index}
                              subsectionIndex={sIdx}
                              color={color}
                              searchQuery={searchQuery}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })()}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
