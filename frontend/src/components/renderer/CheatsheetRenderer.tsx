"use client";
import { useState, useRef } from "react";
import type { CheatsheetData } from "@/types/cheatsheet";
import { SectionBlock } from "./SectionBlock";
import { getColorForIndex } from "./sectionColors";

interface Props {
  data: CheatsheetData;
  className?: string;
  multiColumn?: boolean;
  searchQuery?: string;
}

export function CheatsheetRenderer({ data, className = "", multiColumn = false, searchQuery }: Props) {
  const [indexOpen, setIndexOpen] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  const handleIndexClick = (idx: number) => {
    const root = rootRef.current;
    if (!root) return;
    const targets = root.querySelectorAll("[data-section-block]");
    const target = targets[idx] as HTMLElement | undefined;
    if (!target) return;
    // Expand the section first
    target.dispatchEvent(new CustomEvent("expand-section"));
    // After re-render the subsections will be in the DOM — expand them then scroll
    requestAnimationFrame(() => {
      target.querySelectorAll("[data-subsection-container]").forEach((sub) => {
        sub.dispatchEvent(new CustomEvent("expand-subsection"));
      });
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // Strip markdown syntax for plain description preview
  const stripMd = (text: string) =>
    text
      .replace(/\$[^$]+\$/g, "…")
      .replace(/[*_`#>\[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  return (
    <div
      ref={rootRef}
      className={className}
      style={{
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        background: "#f0f2f5",
        minHeight: "100%",
      }}
    >
      {/* Header */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #e5e7eb", padding: "12px 20px" }}>
        <h1 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#111827", margin: 0, letterSpacing: "0.2px" }}>
          {data.title || "Untitled cheatsheet"}
        </h1>
      </div>

      {/* Index — always shown */}
      <div style={{ margin: "10px 12px 0", border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden", background: "#fff" }}>
        <div
          onClick={() => setIndexOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 14px",
            background: "#f9fafb",
            borderBottom: indexOpen ? "1px solid #e5e7eb" : "none",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <span style={{ color: "#6b7280", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase" }}>
            Index
          </span>
          <svg viewBox="0 0 10 10" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ width: "10px", height: "10px", transform: indexOpen ? "none" : "rotate(-90deg)", transition: "transform 0.15s" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 3.5L5 6.5 8 3.5" />
          </svg>
        </div>

        {indexOpen && (
          <div style={{ padding: "6px 8px 8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", alignItems: "stretch" }}>
            {data.sections.map((section, idx) => {
              const color = getColorForIndex(idx);
              const desc = section.description ? stripMd(section.description) : null;
              return (
                <a
                  key={section._uiId ?? idx}
                  href="#"
                  onClick={(e) => { e.preventDefault(); handleIndexClick(idx); }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "7px",
                    padding: "5px 8px",
                    borderRadius: "5px",
                    textDecoration: "none",
                    color: "inherit",
                    background: `${color.badgeColor}12`,
                    transition: "background 0.12s",
                  }}
                  className="index-item"
                >
                  <div style={{
                    flexShrink: 0,
                    width: "16px",
                    height: "16px",
                    marginTop: "1px",
                    borderRadius: "3px",
                    background: color.badgeColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.58rem",
                    fontWeight: 700,
                    color: "white",
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#1f2937", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {section.title || `Section ${idx + 1}`}
                    </div>
                    {desc && (
                      <div style={{
                        fontSize: "0.65rem",
                        color: "#6b7280",
                        marginTop: "1px",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        lineHeight: 1.4,
                      }}>
                        {desc}
                      </div>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Sections — masonry via CSS columns when multiColumn */}
      <div style={{ padding: "10px 12px", ...(multiColumn ? { columnCount: 2, columnGap: "10px", columnWidth: "420px" } : {}) }}>
        {data.sections.map((section, idx) => (
          <div key={section._uiId ?? idx} style={{ breakInside: "avoid", display: "inline-block", width: "100%" }}>
            <SectionBlock
              section={section}
              index={idx}
              searchQuery={searchQuery}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "12px 20px", background: "#ffffff", borderTop: "1px solid #e5e7eb", fontSize: "0.75rem", color: "#6c757d" }}>
        <span>Made with CheatSheetMaker</span>
        <span style={{ color: "#d1d5db" }}>·</span>
        <a
          href="https://www.linkedin.com/in/pablo-gonz%C3%A1lez-mart%C3%ADn-a026112a6/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: "5px", color: "#0077b5", textDecoration: "none", fontWeight: 500 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: "13px", height: "13px", flexShrink: 0 }}>
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          Pablo González Martín
        </a>
      </div>
    </div>
  );
}
