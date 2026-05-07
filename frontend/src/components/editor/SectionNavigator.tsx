"use client";
import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { getColorForIndex } from "@/components/renderer/sectionColors";

export function SectionNavigator() {
  const navigatorOpen = useEditorStore((s) => s.navigatorOpen);
  const setNavigatorOpen = useEditorStore((s) => s.setNavigatorOpen);
  const sections = useEditorStore((s) => s.currentCheatsheet.sections);
  const ref = useRef<HTMLDivElement>(null);

  // Which sections are expanded inside the navigator panel (showing their subsections)
  const [expandedInNav, setExpandedInNav] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!navigatorOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setNavigatorOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [navigatorOpen, setNavigatorOpen]);

  if (!navigatorOpen) return null;

  const navigateToSection = (sectionIdx: number) => {
    const el = document.getElementById(`section-${sectionIdx}`);
    if (el) {
      // expand-section handler already expands + scrolls
      el.dispatchEvent(new CustomEvent("expand-section"));
    }
    setNavigatorOpen(false);
  };

  const navigateToSubsection = (sectionIdx: number, subIdx: number) => {
    // Expand the parent section first
    const sectionEl = document.getElementById(`section-${sectionIdx}`);
    if (sectionEl) {
      sectionEl.dispatchEvent(new CustomEvent("expand-section"));
    }
    setNavigatorOpen(false);

    // After React re-renders the now-expanded section, locate the subsection and expand + scroll
    setTimeout(() => {
      const subEls = document.querySelectorAll(
        `#section-${sectionIdx} [data-subsection-container]`
      );
      const subEl = subEls[subIdx] as HTMLElement | undefined;
      if (subEl) {
        subEl.dispatchEvent(new CustomEvent("expand-subsection"));
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            subEl.scrollIntoView({ behavior: "smooth", block: "center" })
          )
        );
      }
    }, 80);
  };

  const toggleNavExpand = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedInNav((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div
      ref={ref}
      className="fixed top-14 right-4 z-40 bg-white border border-gray-200 rounded-xl shadow-xl w-72 max-h-[72vh] overflow-y-auto"
      style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.13)" }}
    >
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 px-3 py-2 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Navigator</span>
        <button
          onClick={() => setNavigatorOpen(false)}
          className="text-gray-400 hover:text-gray-600 text-xs w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100"
        >✕</button>
      </div>

      {/* List */}
      <div className="py-1">
        {sections.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No sections yet</p>
        ) : (
          sections.map((section, idx) => {
            const color = getColorForIndex(idx);
            const hasSubsections = (section.subsections?.length ?? 0) > 0;
            const isExpanded = expandedInNav.has(idx);

            return (
              <div key={section._uiId ?? idx}>
                {/* Section row */}
                <div className="flex items-center">
                  <button
                    onClick={() => navigateToSection(idx)}
                    className="flex-1 min-w-0 text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2 transition-colors"
                  >
                    <span
                      className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded text-white"
                      style={{ backgroundColor: color.badgeColor }}
                    >
                      {idx + 1}
                    </span>
                    <span className="truncate text-gray-700 font-medium">
                      {section.title || <em className="text-gray-400 font-normal">Untitled</em>}
                    </span>
                  </button>

                  {hasSubsections && (
                    <button
                      onClick={(e) => toggleNavExpand(idx, e)}
                      className="flex-shrink-0 w-7 h-full py-1.5 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors text-[11px]"
                      title={isExpanded ? "Hide subsections" : "Show subsections"}
                    >
                      {isExpanded ? "▾" : "▸"}
                    </button>
                  )}
                </div>

                {/* Subsection rows */}
                {isExpanded && hasSubsections && (
                  <div
                    className="ml-7 border-l-2 mb-0.5"
                    style={{ borderColor: color.badgeColor + "50" }}
                  >
                    {section.subsections.map((sub, sIdx) => (
                      <button
                        key={sub._uiId ?? sIdx}
                        onClick={() => navigateToSubsection(idx, sIdx)}
                        className="w-full text-left px-2.5 py-1 text-[11px] hover:bg-gray-50 flex items-center gap-1.5 transition-colors"
                      >
                        <span
                          className="flex-shrink-0 text-[9px] font-bold px-1 py-0.5 rounded text-white"
                          style={{ backgroundColor: color.badgeColor }}
                        >
                          {idx + 1}.{sIdx + 1}
                        </span>
                        <span className="truncate text-gray-600">
                          {sub.title || <em className="text-gray-400">Untitled</em>}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
