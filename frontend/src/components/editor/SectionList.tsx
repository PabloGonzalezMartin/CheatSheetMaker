"use client";
import { useState, useRef, useEffect } from "react";
import type { Section } from "@/types/cheatsheet";
import { WysiwygSectionCard } from "./WysiwygSectionCard";
import { useLanguage } from "@/lib/i18n";

interface Props {
  sections: Section[];
  cheatsheetId: string | undefined;
  onChange: (sections: Section[]) => void;
}

export function SectionList({ sections, cheatsheetId, onChange }: Props) {
  const { t } = useLanguage();
  const [dragSrcIdx, setDragSrcIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [landedIdx, setLandedIdx] = useState<number | null>(null);
  const landedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // While a section is being dragged, allow it to be dropped anywhere on the page
  // (e.g. onto the sidebar). Without this, child elements that don't handle
  // sectionjson will cancel the drag with a "not-allowed" cursor.
  useEffect(() => {
    if (dragSrcIdx === null) return;
    const allow = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("sectionjson")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }
    };
    document.addEventListener("dragover", allow);
    return () => document.removeEventListener("dragover", allow);
  }, [dragSrcIdx]);

  const updateSection = (idx: number, section: Section) => {
    const next = [...sections];
    next[idx] = section;
    onChange(next);
  };

  const removeSection = (idx: number) => {
    onChange(sections.filter((_, i) => i !== idx));
  };

  const insertAfter = (idx: number) => {
    const next = [...sections];
    next.splice(idx + 1, 0, {
      _uiId: crypto.randomUUID(),
      title: "",
      description: "",
      images: [],
      lines: [],
      subsections: [],
    });
    onChange(next);
  };

  const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
    if (!e.dataTransfer.types.includes("sectionindex") && !e.dataTransfer.types.includes("sectionjson")) return;
    e.preventDefault();
    if (dragOverIdx !== targetIdx) setDragOverIdx(targetIdx);
  };

  const handleDragLeave = (e: React.DragEvent, targetIdx: number) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverIdx((prev) => (prev === targetIdx ? null : prev));
    }
  };

  const handleDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    setDragOverIdx(null);
    setDragSrcIdx(null);
    const srcIdx = Number(e.dataTransfer.getData("sectionIndex"));
    if (isNaN(srcIdx) || srcIdx === targetIdx) return;
    const next = [...sections];
    const [moved] = next.splice(srcIdx, 1);
    const adjusted = srcIdx < targetIdx ? targetIdx - 1 : targetIdx;
    next.splice(adjusted, 0, moved);
    if (landedTimer.current) clearTimeout(landedTimer.current);
    setLandedIdx(adjusted);
    landedTimer.current = setTimeout(() => setLandedIdx(null), 500);
    onChange(next);
  };

  const handleDragEnd = () => {
    setDragSrcIdx(null);
    setDragOverIdx(null);
  };

  return (
    <div>
      {sections.map((section, idx) => {
        const isDragging = dragSrcIdx === idx;
        const isTarget = dragOverIdx === idx && dragSrcIdx !== idx;
        const hasLanded = landedIdx === idx;

        return (
          <div
            key={section._uiId ?? idx}
            className="group/slot relative"
            style={{ marginBottom: "14px" }}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragLeave={(e) => handleDragLeave(e, idx)}
            onDrop={(e) => handleDrop(e, idx)}
          >
            {/* Drop indicator line above target */}
            <div
              style={{
                height: "3px",
                borderRadius: "2px",
                marginBottom: isTarget ? "4px" : "0px",
                background: isTarget
                  ? "linear-gradient(90deg, #667eea 0%, #764ba2 100%)"
                  : "transparent",
                boxShadow: isTarget ? "0 0 6px rgba(102,126,234,0.45)" : "none",
                transition: "margin-bottom 0.12s ease, background 0.1s ease",
              }}
            />

            {/* Section card with drag visual feedback */}
            <div
              style={{
                opacity: isDragging ? 0.38 : 1,
                transform: isDragging ? "scale(0.985)" : "scale(1)",
                transition: "opacity 0.15s ease, transform 0.15s ease",
                transformOrigin: "top center",
              }}
              className={hasLanded ? "drop-landed" : ""}
            >
              <WysiwygSectionCard
                section={section}
                index={idx}
                total={sections.length}
                cheatsheetId={cheatsheetId}
                onChange={(s) => updateSection(idx, s)}
                onRemove={() => removeSection(idx)}
                dragHandleProps={{
                  draggable: true,
                  onDragStart: (e: React.DragEvent) => {
                    e.dataTransfer.setData("sectionIndex", String(idx));
                    e.dataTransfer.setData("sectionjson", JSON.stringify(section));
                    e.dataTransfer.effectAllowed = "all";
                    setTimeout(() => setDragSrcIdx(idx), 0);
                  },
                  onDragEnd: handleDragEnd,
                }}
              />
            </div>

            {/* Insert-section button — lives here so it isn't clipped by card's overflow:hidden */}
            <div
              className="absolute left-0 right-0 flex items-center justify-center pointer-events-none"
              style={{ bottom: "-10px", zIndex: 20 }}
            >
              <button
                onClick={(e) => { e.stopPropagation(); insertAfter(idx); }}
                className="pointer-events-auto opacity-0 group-hover/slot:opacity-100 bg-white border border-blue-300/70 text-blue-500 text-[10px] font-medium px-3 py-0.5 rounded-full hover:bg-blue-50 hover:border-blue-400 shadow-sm transition-all duration-150"
              >
                {t("sectionlist_insert")}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
