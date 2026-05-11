"use client";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { Section, CodeLine, Subsection } from "@/types/cheatsheet";
import { getColorForIndex } from "@/components/renderer/sectionColors";
import { useEditorStore } from "@/store/editorStore";
import { textMatches } from "@/lib/searchHighlight";
import { api } from "@/lib/api";
import { ImportJsonModal } from "@/components/modals/ImportJsonModal";
import { useLanguage } from "@/lib/i18n";
import { WysiwygCodeLineRow } from "./WysiwygCodeLineRow";
import { WysiwygSubsectionCard } from "./WysiwygSubsectionCard";

interface Props {
  section: Section;
  index: number;
  total: number;
  cheatsheetId: string | undefined;
  onChange: (section: Section) => void;
  onRemove: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function WysiwygSectionCard({
  section,
  index,
  total,
  cheatsheetId,
  onChange,
  onRemove,
  dragHandleProps,
}: Props) {
  const searchQuery = useEditorStore((s) => s.searchQuery);
  const expandedSections = useEditorStore((s) => s.expandedSections);
  const setSectionExpanded = useEditorStore((s) => s.setSectionExpanded);
  const color = getColorForIndex(index);
  const { t } = useLanguage();

  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [editingLineIdx, setEditingLineIdx] = useState<number | null>(null);
  const [showImportSub, setShowImportSub] = useState(false);
  const [collapsed, setCollapsed] = useState(() =>
    section._uiId ? !expandedSections.has(section._uiId) : true
  );

  // Line drag state
  const [dragSrcLineIdx, setDragSrcLineIdx] = useState<number | null>(null);
  const [dragOverLineIdx, setDragOverLineIdx] = useState<number | null>(null);
  const [landedLineIdx, setLandedLineIdx] = useState<number | null>(null);
  const landedLineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subsection drag state
  const [dragSrcSubIdx, setDragSrcSubIdx] = useState<number | null>(null);
  const [dragOverSubIdx, setDragOverSubIdx] = useState<number | null>(null);
  const [landedSubIdx, setLandedSubIdx] = useState<number | null>(null);
  const landedSubTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const outerRef = useRef<HTMLDivElement>(null);

  // Keep store in sync with local collapse state
  useEffect(() => {
    if (section._uiId) setSectionExpanded(section._uiId, !collapsed);
  }, [collapsed, section._uiId, setSectionExpanded]);

  const sectionMatches =
    searchQuery &&
    (textMatches(section.title, searchQuery) ||
      textMatches(section.description ?? "", searchQuery) ||
      section.lines.some(
        (l) => textMatches(l.command ?? "", searchQuery) || textMatches(l.comment ?? "", searchQuery) || textMatches(l.text ?? "", searchQuery)
      ) ||
      section.subsections.some(
        (sub) =>
          textMatches(sub.title, searchQuery) ||
          sub.lines.some((l) => textMatches(l.command ?? "", searchQuery) || textMatches(l.comment ?? "", searchQuery) || textMatches(l.text ?? "", searchQuery))
      ));

  useEffect(() => {
    if (sectionMatches) setCollapsed(false);
  }, [sectionMatches]);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const handleExpand = () => {
      setCollapsed(false);
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
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

  // Close active line editor when clicking outside this section
  useEffect(() => {
    if (editingLineIdx === null) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (outerRef.current && !outerRef.current.contains(e.target as Node)) {
        setEditingLineIdx(null);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [editingLineIdx]);

  const imgInputRef = useRef<HTMLInputElement>(null);
  const [imgUploading, setImgUploading] = useState(false);

  const updateLines = (lines: CodeLine[]) => onChange({ ...section, lines });
  const updateSubsections = (subsections: Subsection[]) => onChange({ ...section, subsections });

  const addLine = () => updateLines([...section.lines, { type: "code", command: "", comment: "" }]);

  const handleImageUpload = async (file: File) => {
    if (!cheatsheetId) { alert(t("section_imageSaveFirst")); return; }
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) { alert(t("section_imageMax")); return; }
    setImgUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.uploadFile<{ url: string }>(`/api/cheatsheet/${cheatsheetId}/image`, fd);
      updateLines([...section.lines, { type: "image", src: res.url, widthPercent: 100 }]);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("section_imageUploadFailed"));
    } finally {
      setImgUploading(false);
    }
  };

  const insertLineBefore = (idx: number) => {
    const next = [...section.lines];
    next.splice(idx, 0, { type: "code", command: "", comment: "" });
    updateLines(next);
  };

  const removeLine = (idx: number) => {
    const next = section.lines.filter((_, i) => i !== idx);
    updateLines(next);
  };

  const updateLine = (idx: number, line: CodeLine) => {
    const next = [...section.lines];
    next[idx] = line;
    updateLines(next);
  };

  const addSubsection = () =>
    updateSubsections([
      ...section.subsections,
      { _uiId: crypto.randomUUID(), title: "", images: [], lines: [] },
    ]);

  const removeSubsection = (idx: number) => updateSubsections(section.subsections.filter((_, i) => i !== idx));

  const updateSubsection = (idx: number, sub: Subsection) => {
    const next = [...section.subsections];
    next[idx] = sub;
    updateSubsections(next);
  };

  const handleLineDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    setDragOverLineIdx(null);
    setDragSrcLineIdx(null);
    const srcIdx = Number(e.dataTransfer.getData("lineIndex"));
    if (isNaN(srcIdx) || srcIdx === targetIdx) return;
    e.stopPropagation();
    const next = [...section.lines];
    const [moved] = next.splice(srcIdx, 1);
    const adjusted = srcIdx < targetIdx ? targetIdx - 1 : targetIdx;
    next.splice(adjusted, 0, moved);
    if (landedLineTimer.current) clearTimeout(landedLineTimer.current);
    setLandedLineIdx(adjusted);
    landedLineTimer.current = setTimeout(() => setLandedLineIdx(null), 500);
    updateLines(next);
  };

  const handleSubDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    setDragOverSubIdx(null);
    setDragSrcSubIdx(null);
    const srcIdx = Number(e.dataTransfer.getData("subIndex"));
    if (isNaN(srcIdx) || srcIdx === targetIdx) return;
    e.stopPropagation();
    const next = [...section.subsections];
    const [moved] = next.splice(srcIdx, 1);
    const adjusted = srcIdx < targetIdx ? targetIdx - 1 : targetIdx;
    next.splice(adjusted, 0, moved);
    if (landedSubTimer.current) clearTimeout(landedSubTimer.current);
    setLandedSubIdx(adjusted);
    landedSubTimer.current = setTimeout(() => setLandedSubIdx(null), 500);
    updateSubsections(next);
  };

  return (
    <div
      ref={outerRef}
      id={`section-${index}`}
      data-section-block
      data-search-match={sectionMatches ? "true" : undefined}
      className="group/section relative"
      style={{
        border: sectionMatches ? "2px solid rgba(255,200,0,0.7)" : "1px solid #e0e0e0",
        borderRadius: "8px",
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      }}
    >
      {/* Section header */}
      <div
        style={{
          background: color.headerBg,
          borderBottom: collapsed ? "none" : "1px solid rgba(0,0,0,0.06)",
        }}
        onClick={() => setEditingLineIdx(null)}
      >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px" }}>
        {/* Drag handle */}
        <div
          {...dragHandleProps}
          className="flex-shrink-0 cursor-grab text-gray-400 hover:text-gray-600 select-none opacity-0 group-hover/section:opacity-60"
          title={t("section_dragReorder")}
          style={{ fontSize: "1rem" }}
        >⠿</div>

        {/* Collapse toggle */}
        <button
          onClick={() => {
            setCollapsed((c) => {
              if (c) {
                requestAnimationFrame(() => {
                  outerRef.current?.querySelectorAll("[data-subsection-container]").forEach((sub) => {
                    sub.dispatchEvent(new CustomEvent("collapse-subsection"));
                  });
                });
              }
              return !c;
            });
          }}
          className="flex-shrink-0 text-gray-400 hover:text-gray-700 w-4 h-4 flex items-center justify-center"
          title={collapsed ? t("section_expand") : t("section_collapse")}
        >
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className="w-2.5 h-2.5" style={{ transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform 0.15s" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 3.5L5 6.5 8 3.5"/>
          </svg>
        </button>

        {/* Section number badge — flat rectangle */}
        <div
          style={{
            padding: "1px 7px",
            borderRadius: "4px",
            background: color.badgeColor,
            fontSize: "0.72rem",
            fontWeight: 700,
            color: "white",
            letterSpacing: "0.4px",
            flexShrink: 0,
          }}
        >
          {index + 1}
        </div>

        {/* Title */}
        {editingTitle ? (
          <input
            autoFocus
            type="text"
            value={section.title}
            onChange={(e) => onChange({ ...section, title: e.target.value })}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingTitle(false); }}
            className="flex-1 text-sm font-semibold border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary bg-white min-w-0"
          />
        ) : (
          <span
            onClick={() => setEditingTitle(true)}
            style={{ fontSize: "0.88rem", fontWeight: 600, color: "#2c3e50", flex: 1, cursor: "text" }}
            title={t("section_clickEditTitle")}
          >
            {section.title || <em style={{ color: "#aaa", fontWeight: 400, fontSize: "0.82rem" }}>{t("section_untitled")}</em>}
          </span>
        )}

        {total > 1 && (
          <button
            onClick={onRemove}
            className="flex-shrink-0 text-gray-400 hover:text-red-500 text-xs opacity-0 group-hover/section:opacity-100 transition-opacity"
            title={t("section_remove")}
          >✕</button>
        )}
      </div>

        {/* Description — inside header block */}
        <div className="px-12 pb-1.5" onClick={(e) => e.stopPropagation()}>
          {editingDesc ? (
            <textarea
              autoFocus
              value={section.description || ""}
              onChange={(e) => onChange({ ...section, description: e.target.value })}
              onBlur={() => setEditingDesc(false)}
              onKeyDown={(e) => { if (e.key === "Escape") setEditingDesc(false); }}
              placeholder={t("section_descPlaceholder")}
              rows={2}
              className="w-full text-xs text-gray-700 rounded px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ minHeight: "36px", lineHeight: 1.5, background: "white", border: "1px solid #d1d5db" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 80) + "px";
              }}
            />
          ) : section.description ? (
            <div
              onClick={() => setEditingDesc(true)}
              title={t("section_clickEditDesc")}
              className="group/desc relative rounded px-2 py-0.5 -mx-2 cursor-text hover:bg-black/5 transition-colors"
              style={{ fontSize: "0.78rem", color: "#555", lineHeight: 1.5 }}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {section.description}
              </ReactMarkdown>
              <span className="absolute right-1 top-0.5 text-[9px] text-gray-400 opacity-0 group-hover/desc:opacity-100 transition-opacity select-none">✎</span>
            </div>
          ) : (
            <button
              onClick={() => setEditingDesc(true)}
              className="text-[10px] text-gray-300 hover:text-gray-400"
            >{t("section_addDesc")}</button>
          )}
        </div>
      </div>

      {/* Section body — hidden when collapsed */}
      {!collapsed && (
        <div className="p-2" onDragStart={(e) => e.stopPropagation()} onClick={() => setEditingLineIdx(null)}>

          {/* Code lines with drag visual feedback */}
          <div className="mt-1">
            {section.lines.map((line, idx) => {
              const isLineDragging = dragSrcLineIdx === idx;
              const isLineTarget = dragOverLineIdx === idx && dragSrcLineIdx !== idx;
              const hasLineLanded = landedLineIdx === idx;

              return (
                <div
                  key={idx}
                  className="relative group/linerow hover:z-10"
                  onDragOver={(e) => {
                    if (!e.dataTransfer.types.includes("lineindex")) return;
                    e.preventDefault();
                    if (dragOverLineIdx !== idx) setDragOverLineIdx(idx);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverLineIdx((prev) => (prev === idx ? null : prev));
                    }
                  }}
                  onDrop={(e) => handleLineDrop(e, idx)}
                >
                  {/* Insert above — centered, visible on hover */}
                  <button
                    className="absolute left-1/2 -translate-x-1/2 top-0 -translate-y-1/2 z-20 w-4 h-4 bg-white border border-blue-300/80 text-blue-500 text-[11px] font-bold rounded-full shadow-sm hover:bg-blue-50 opacity-0 group-hover/linerow:opacity-100 transition-opacity flex items-center justify-center leading-none pointer-events-none group-hover/linerow:pointer-events-auto"
                    onClick={(e) => { e.stopPropagation(); insertLineBefore(idx); }}
                    title={t("section_insertAbove")}
                  >+</button>

                  {/* Drop indicator — animated slot */}
                  <div
                    style={{
                      height: isLineTarget ? "22px" : "0px",
                      borderRadius: "4px",
                      marginBottom: isLineTarget ? "3px" : "0",
                      background: isLineTarget ? `${color.badgeColor}12` : "transparent",
                      border: isLineTarget ? `1.5px dashed ${color.badgeColor}70` : "1.5px dashed transparent",
                      transition: "height 0.15s ease, margin-bottom 0.15s ease, background 0.1s ease",
                      overflow: "hidden",
                    }}
                  />
                  <div
                    style={{
                      opacity: isLineDragging ? 0.35 : 1,
                      transform: isLineDragging ? "scale(0.98)" : "scale(1)",
                      transition: "opacity 0.12s ease, transform 0.12s ease",
                    }}
                    className={hasLineLanded ? "drop-landed" : ""}
                  >
                    <WysiwygCodeLineRow
                      line={line}
                      index={idx}
                      isEditing={editingLineIdx === idx}
                      onStartEdit={() => setEditingLineIdx(idx)}
                      onChange={(l) => updateLine(idx, l)}
                      onRemove={() => removeLine(idx)}
                      onInsertBefore={() => insertLineBefore(idx)}
                      accentColor={color.badgeColor}
                      dragHandleProps={{
                        draggable: true,
                        onDragStart: (e: React.DragEvent) => {
                          e.stopPropagation();
                          e.dataTransfer.setData("lineIndex", String(idx));
                          e.dataTransfer.effectAllowed = "move";
                          setTimeout(() => setDragSrcLineIdx(idx), 0);
                        },
                        onDragEnd: () => {
                          setDragSrcLineIdx(null);
                          setDragOverLineIdx(null);
                        },
                      }}
                    />
                  </div>

                  {/* Insert below — centered, visible on hover */}
                  <button
                    className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-20 w-4 h-4 bg-white border border-blue-300/80 text-blue-500 text-[11px] font-bold rounded-full shadow-sm hover:bg-blue-50 opacity-0 group-hover/linerow:opacity-100 transition-opacity flex items-center justify-center leading-none pointer-events-none group-hover/linerow:pointer-events-auto"
                    onClick={(e) => { e.stopPropagation(); insertLineBefore(idx + 1); }}
                    title={t("section_insertBelow")}
                  >+</button>
                </div>
              );
            })}
          </div>

          <div className="flex gap-1 mt-1 opacity-0 group-hover/section:opacity-100 transition-opacity">
            <button
              onClick={addLine}
              className="flex-1 text-[10px] text-gray-300 hover:text-primary border border-dashed border-gray-200 hover:border-primary/40 rounded px-2 py-0.5 transition-colors"
            >{t("section_addLine")}</button>
            <button
              onClick={() => imgInputRef.current?.click()}
              disabled={imgUploading}
              className="flex-1 text-[10px] text-gray-300 hover:text-blue-500 border border-dashed border-gray-200 hover:border-blue-300 rounded px-2 py-0.5 transition-colors disabled:opacity-50"
            >{imgUploading ? t("section_uploading") : t("section_image")}</button>
            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }}
            />
          </div>

          {/* Subsections */}
          {section.subsections.length > 0 && (
            <>
            {/* Per-section subsection expand/collapse controls */}
            <div className="flex items-center gap-1 mt-2 mb-1 pt-1 border-t border-gray-100">
              <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mr-0.5">{t("section_subsections")}</span>
              <button
                onClick={() => outerRef.current?.querySelectorAll("[data-subsection-container]").forEach(el => el.dispatchEvent(new CustomEvent("expand-subsection")))}
                className="flex items-center gap-0.5 text-[9px] text-gray-400 hover:text-blue-500 border border-gray-200 hover:border-blue-300 rounded px-1.5 py-0.5 transition-colors"
                title={t("section_expandAllSubs")}
              >
                <svg className="w-2 h-2" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 3.5L5 6.5 8 3.5"/>
                </svg>
                {t("section_all")}
              </button>
              <button
                onClick={() => outerRef.current?.querySelectorAll("[data-subsection-container]").forEach(el => el.dispatchEvent(new CustomEvent("collapse-subsection")))}
                className="flex items-center gap-0.5 text-[9px] text-gray-400 hover:text-blue-500 border border-gray-200 hover:border-blue-300 rounded px-1.5 py-0.5 transition-colors"
                title={t("section_collapseAllSubs")}
              >
                <svg className="w-2 h-2" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 2L6.5 5 3.5 8"/>
                </svg>
                {t("section_all")}
              </button>
            </div>
            {(() => {
                const numCols = section.subsections.length >= 3 ? 3 : section.subsections.length;
                return (
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", marginTop: "4px" }}>
                    {Array.from({ length: numCols }, (_, cIdx) => (
                      <div key={cIdx} style={{ flex: 1, minWidth: 0 }}>
                        {section.subsections.filter((_, i) => i % numCols === cIdx).map((sub) => {
                          const sIdx = section.subsections.indexOf(sub);
                          const isSubDragging = dragSrcSubIdx === sIdx;
                          const isSubTarget = dragOverSubIdx === sIdx && dragSrcSubIdx !== sIdx;
                          const hasSubLanded = landedSubIdx === sIdx;
                          return (
                            <div
                              key={sub._uiId ?? sIdx}
                              className="relative"
                              style={{ marginBottom: "6px" }}
                              onDragOver={(e) => {
                                if (!e.dataTransfer.types.includes("subindex")) return;
                                e.preventDefault();
                                if (dragOverSubIdx !== sIdx) setDragOverSubIdx(sIdx);
                              }}
                              onDragLeave={(e) => {
                                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                                  setDragOverSubIdx((prev) => (prev === sIdx ? null : prev));
                                }
                              }}
                              onDrop={(e) => handleSubDrop(e, sIdx)}
                            >
                              <div
                                style={{
                                  height: isSubTarget ? "32px" : "0px",
                                  borderRadius: "6px",
                                  marginBottom: isSubTarget ? "4px" : "0",
                                  background: isSubTarget ? `${color.badgeColor}10` : "transparent",
                                  border: isSubTarget ? `1.5px dashed ${color.badgeColor}60` : "1.5px dashed transparent",
                                  transition: "height 0.15s ease, margin-bottom 0.15s ease, background 0.1s ease",
                                  overflow: "hidden",
                                }}
                              />
                              <div
                                style={{
                                  opacity: isSubDragging ? 0.35 : 1,
                                  transform: isSubDragging ? "scale(0.97)" : "scale(1)",
                                  transition: "opacity 0.12s ease, transform 0.12s ease",
                                }}
                                className={hasSubLanded ? "drop-landed" : ""}
                              >
                                <WysiwygSubsectionCard
                                  subsection={sub}
                                  sectionIndex={index}
                                  subsectionIndex={sIdx}
                                  color={color}
                                  cheatsheetId={cheatsheetId}
                                  onChange={(s) => updateSubsection(sIdx, s)}
                                  onRemove={() => removeSubsection(sIdx)}
                                  dragHandleProps={{
                                    draggable: true,
                                    onDragStart: (e: React.DragEvent) => {
                                      e.dataTransfer.setData("subIndex", String(sIdx));
                                      e.dataTransfer.effectAllowed = "move";
                                      setTimeout(() => setDragSrcSubIdx(sIdx), 0);
                                    },
                                    onDragEnd: () => {
                                      setDragSrcSubIdx(null);
                                      setDragOverSubIdx(null);
                                    },
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}

          <div className={`flex gap-1.5 mt-1 transition-opacity ${showImportSub ? "opacity-100" : "opacity-0 group-hover/section:opacity-100"}`}>
            <button
              onClick={addSubsection}
              className="text-[10px] text-blue-400 hover:text-blue-600 border border-dashed border-blue-200 hover:border-blue-400 rounded px-2 py-0.5 flex-1"
            >{t("section_addSubsection")}</button>
            <button
              onClick={() => setShowImportSub(true)}
              className="text-[10px] text-blue-400 hover:text-blue-600 border border-dashed border-blue-200 hover:border-blue-400 rounded px-2 py-0.5 flex-1"
            >{t("section_importSubsection")}</button>
          </div>
        </div>
      )}

      <ImportJsonModal
        mode="subsection"
        open={showImportSub}
        onClose={() => setShowImportSub(false)}
        onImport={(sub) => updateSubsections([...section.subsections, sub])}
      />
    </div>
  );
}
