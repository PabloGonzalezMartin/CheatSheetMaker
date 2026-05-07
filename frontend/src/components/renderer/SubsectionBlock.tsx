"use client";
import { useState, useEffect, useRef } from "react";
import type { Subsection } from "@/types/cheatsheet";
import type { SectionColor } from "./sectionColors";
import { CodeLineDisplay } from "./CodeLineDisplay";
import { withImageToken } from "@/lib/api";
import { ImageLightbox } from "./ImageLightbox";
import { useEditorStore } from "@/store/editorStore";

interface Props {
  subsection: Subsection;
  sectionIndex: number;
  subsectionIndex: number;
  color: SectionColor;
  searchQuery?: string;
}

export function SubsectionBlock({ subsection, sectionIndex, subsectionIndex, color, searchQuery }: Props) {
  const label = `${sectionIndex + 1}.${subsectionIndex + 1}`;
  const expandedSubsections = useEditorStore((s) => s.expandedSubsections);
  const setSubsectionExpanded = useEditorStore((s) => s.setSubsectionExpanded);
  const initialCollapsed = subsection._uiId ? !expandedSubsections.has(subsection._uiId) : true;
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (subsection._uiId) setSubsectionExpanded(subsection._uiId, !collapsed);
  }, [collapsed, subsection._uiId, setSubsectionExpanded]);

  useEffect(() => {
    const handleExpandAll = () => setCollapsed(false);
    const handleCollapseAll = () => setCollapsed(true);
    document.addEventListener("expand-all-sections", handleExpandAll);
    document.addEventListener("collapse-all-sections", handleCollapseAll);
    document.addEventListener("expand-all-subsections", handleExpandAll);
    document.addEventListener("collapse-all-subsections", handleCollapseAll);
    return () => {
      document.removeEventListener("expand-all-sections", handleExpandAll);
      document.removeEventListener("collapse-all-sections", handleCollapseAll);
      document.removeEventListener("expand-all-subsections", handleExpandAll);
      document.removeEventListener("collapse-all-subsections", handleCollapseAll);
    };
  }, []);

  useEffect(() => {
    if (searchQuery?.trim()) setCollapsed(false);
  }, [searchQuery]);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const handleExpand = () => setCollapsed(false);
    const handleCollapse = () => setCollapsed(true);
    el.addEventListener("expand-subsection", handleExpand);
    el.addEventListener("collapse-subsection", handleCollapse);
    return () => {
      el.removeEventListener("expand-subsection", handleExpand);
      el.removeEventListener("collapse-subsection", handleCollapse);
    };
  }, []);

  return (
    <>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      <div
        ref={elRef}
        data-subsection-container
        style={{
          marginBottom: "10px",
          border: "1px solid #e0e0e0",
          borderLeft: `3px solid ${color.badgeColor}`,
          background: "#fafbfc",
          borderRadius: "6px",
          overflow: "hidden",
        }}
      >
        <div
          onClick={() => setCollapsed((c) => !c)}
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
          <div
            style={{
              padding: "1px 5px",
              borderRadius: "3px",
              background: color.badgeColor,
              fontSize: "0.68rem",
              fontWeight: 700,
              color: "white",
              letterSpacing: "0.3px",
              flexShrink: 0,
            }}
          >
            {label}
          </div>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#2c3e50", flex: 1 }}>
            {subsection.title}
          </span>
          <svg viewBox="0 0 10 10" fill="none" stroke="#999" strokeWidth="2" style={{ width: "9px", height: "9px", flexShrink: 0, transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform 0.15s" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 3.5L5 6.5 8 3.5"/>
          </svg>
        </div>

        {!collapsed && (
          <div style={{ padding: "4px 6px" }}>
            {subsection.lines.map((line, idx) => {
              if (line.type === "image" && line.src) {
                const src = withImageToken(line.src);
                return (
                  <div key={idx} style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
                    <img
                      src={src}
                      alt="Subsection image"
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
        )}
      </div>
    </>
  );
}
