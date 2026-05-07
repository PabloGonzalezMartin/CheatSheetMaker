"use client";
import { useState, useEffect, useRef } from "react";
import type { Subsection, CodeLine } from "@/types/cheatsheet";
import type { SectionColor } from "@/components/renderer/sectionColors";
import { useEditorStore } from "@/store/editorStore";
import { textMatches } from "@/lib/searchHighlight";
import { WysiwygCodeLineRow } from "./WysiwygCodeLineRow";
import { api } from "@/lib/api";
import { ImportJsonModal } from "@/components/modals/ImportJsonModal";
import { useLanguage } from "@/lib/i18n";

interface Props {
  subsection: Subsection;
  sectionIndex: number;
  subsectionIndex: number;
  color: SectionColor;
  cheatsheetId: string | undefined;
  onChange: (sub: Subsection) => void;
  onRemove: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function WysiwygSubsectionCard({
  subsection,
  sectionIndex,
  subsectionIndex,
  color,
  cheatsheetId,
  onChange,
  onRemove,
  dragHandleProps,
}: Props) {
  const searchQuery = useEditorStore((s) => s.searchQuery);
  const expandedSubsections = useEditorStore((s) => s.expandedSubsections);
  const setSubsectionExpanded = useEditorStore((s) => s.setSubsectionExpanded);
  const { t } = useLanguage();
  const label = `${sectionIndex + 1}.${subsectionIndex + 1}`;

  const [editingTitle, setEditingTitle] = useState(false);
  const [editingLineIdx, setEditingLineIdx] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [collapsed, setCollapsed] = useState(() =>
    subsection._uiId ? !expandedSubsections.has(subsection._uiId) : true
  );

  // Line drag state
  const [dragSrcLineIdx, setDragSrcLineIdx] = useState<number | null>(null);
  const [dragOverLineIdx, setDragOverLineIdx] = useState<number | null>(null);
  const [landedLineIdx, setLandedLineIdx] = useState<number | null>(null);
  const landedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (subsection._uiId) setSubsectionExpanded(subsection._uiId, !collapsed);
  }, [collapsed, subsection._uiId, setSubsectionExpanded]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const matches =
        textMatches(subsection.title, searchQuery) ||
        subsection.lines.some(
          (l) => textMatches(l.command ?? "", searchQuery) || textMatches(l.comment ?? "", searchQuery) || textMatches(l.text ?? "", searchQuery)
        );
      if (matches) setCollapsed(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  useEffect(() => {
    if (editingLineIdx === null) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditingLineIdx(null);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [editingLineIdx]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleExpand = () => setCollapsed(false);
    const handleCollapse = () => setCollapsed(true);
    const handleExpandAll = () => setCollapsed(false);
    const handleCollapseAll = () => setCollapsed(true);
    el.addEventListener("expand-subsection", handleExpand);
    el.addEventListener("collapse-subsection", handleCollapse);
    document.addEventListener("expand-all-subsections", handleExpandAll);
    document.addEventListener("collapse-all-subsections", handleCollapseAll);
    return () => {
      el.removeEventListener("expand-subsection", handleExpand);
      el.removeEventListener("collapse-subsection", handleCollapse);
      document.removeEventListener("expand-all-subsections", handleExpandAll);
      document.removeEventListener("collapse-all-subsections", handleCollapseAll);
    };
  }, []);

  const imgInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const updateLines = (lines: CodeLine[]) => onChange({ ...subsection, lines });

  const handleImageUpload = async (file: File) => {
    if (!cheatsheetId) { alert(t("section_imageSaveFirst")); return; }
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) { alert(t("section_imageMax")); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.uploadFile<{ url: string }>(`/api/cheatsheet/${cheatsheetId}/image`, fd);
      updateLines([...subsection.lines, { type: "image", src: res.url, widthPercent: 100 }]);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : t("section_imageUploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const addLine = () => updateLines([...subsection.lines, { type: "code", command: "", comment: "" }]);

  const insertLineBefore = (idx: number) => {
    const next = [...subsection.lines];
    next.splice(idx, 0, { type: "code", command: "", comment: "" });
    updateLines(next);
  };

  const removeLine = (idx: number) => {
    const next = subsection.lines.filter((_, i) => i !== idx);
    updateLines(next);
  };

  const updateLine = (idx: number, line: CodeLine) => {
    const next = [...subsection.lines];
    next[idx] = line;
    updateLines(next);
  };

  const handleLineDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    setDragOverLineIdx(null);
    setDragSrcLineIdx(null);
    const srcIdx = Number(e.dataTransfer.getData("lineIndex"));
    if (isNaN(srcIdx) || srcIdx === targetIdx) return;
    e.stopPropagation();
    const next = [...subsection.lines];
    const [moved] = next.splice(srcIdx, 1);
    const adjusted = srcIdx < targetIdx ? targetIdx - 1 : targetIdx;
    next.splice(adjusted, 0, moved);
    if (landedTimer.current) clearTimeout(landedTimer.current);
    setLandedLineIdx(adjusted);
    landedTimer.current = setTimeout(() => setLandedLineIdx(null), 500);
    updateLines(next);
  };

  return (
    <div
      ref={containerRef}
      data-subsection-container
      style={{
        marginBottom: "8px",
        border: "1px solid #e0e0e0",
        borderLeft: `3px solid ${color.badgeColor}`,
        background: "#fafbfc",
        borderRadius: "6px",
        overflow: "hidden",
        position: "relative",
      }}
      className="group/sub"
    >
      {/* Header */}
      <div
        onClick={() => setEditingLineIdx(null)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "4px 8px",
          background: color.headerBg,
          borderBottom: collapsed ? "none" : "1px solid rgba(0,0,0,0.04)",
        }}
      >
        {/* Drag handle */}
        <div
          {...dragHandleProps}
          className="flex-shrink-0 cursor-grab text-gray-400 hover:text-gray-600 text-xs select-none opacity-0 group-hover/sub:opacity-60"
          title={t("section_dragReorder")}
          style={{ fontSize: "0.9rem" }}
        >⠿</div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex-shrink-0 text-gray-400 hover:text-gray-700 w-3 h-3 flex items-center justify-center"
          title={collapsed ? t("subsection_expand") : t("subsection_collapse")}
        >
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" className="w-2 h-2" style={{ transform: collapsed ? "rotate(-90deg)" : "none", transition: "transform 0.15s" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 3.5L5 6.5 8 3.5"/>
          </svg>
        </button>

        {/* Badge — flat rectangle */}
        <div
          style={{
            padding: "1px 5px",
            borderRadius: "3px",
            background: color.badgeColor,
            fontSize: "0.65rem",
            fontWeight: 700,
            color: "white",
            letterSpacing: "0.3px",
            flexShrink: 0,
          }}
        >
          {label}
        </div>

        {/* Title */}
        {editingTitle ? (
          <input
            autoFocus
            type="text"
            value={subsection.title}
            onChange={(e) => onChange({ ...subsection, title: e.target.value })}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingTitle(false); }}
            className="flex-1 text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary bg-white min-w-0"
          />
        ) : (
          <span
            onClick={() => setEditingTitle(true)}
            style={{ fontSize: "0.82rem", fontWeight: 600, color: "#2c3e50", flex: 1, cursor: "text" }}
            title={t("section_clickEditTitle")}
          >
            {subsection.title || <em style={{ color: "#aaa", fontWeight: 400 }}>{t("subsection_untitled")}</em>}
          </span>
        )}

        <button
          onClick={onRemove}
          className="flex-shrink-0 text-gray-400 hover:text-red-500 text-xs opacity-0 group-hover/sub:opacity-100 transition-opacity"
          title={t("subsection_remove")}
        >✕</button>
      </div>

      {/* Lines — hidden when collapsed */}
      {!collapsed && (
        <div
          style={{ padding: "3px 6px" }}
          onDragStart={(e) => e.stopPropagation()}
          onClick={() => setEditingLineIdx(null)}
        >
          {subsection.lines.map((line, idx) => {
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
                {/* Insert above */}
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
                {/* Insert below */}
                <button
                  className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-20 w-4 h-4 bg-white border border-blue-300/80 text-blue-500 text-[11px] font-bold rounded-full shadow-sm hover:bg-blue-50 opacity-0 group-hover/linerow:opacity-100 transition-opacity flex items-center justify-center leading-none pointer-events-none group-hover/linerow:pointer-events-auto"
                  onClick={(e) => { e.stopPropagation(); insertLineBefore(idx + 1); }}
                  title={t("section_insertBelow")}
                >+</button>
              </div>
            );
          })}
          <div className={`flex gap-1 mt-1 transition-opacity ${showImport ? "opacity-100" : "opacity-0 group-hover/sub:opacity-100"}`}>
            <button
              onClick={addLine}
              className="flex-1 text-[10px] text-gray-400 hover:text-primary border border-dashed border-gray-200 hover:border-primary/40 rounded py-0.5 transition-colors"
            >{t("subsection_addLine")}</button>
            <button
              onClick={() => imgInputRef.current?.click()}
              disabled={uploading}
              className="flex-1 text-[10px] text-gray-400 hover:text-blue-500 border border-dashed border-gray-200 hover:border-blue-300 rounded py-0.5 transition-colors disabled:opacity-50"
              title={t("section_image")}
            >{uploading ? t("section_uploading") : t("section_image")}</button>
            <button
              onClick={() => setShowImport(true)}
              className="flex-1 text-[10px] text-blue-400 hover:text-blue-600 border border-dashed border-blue-200 hover:border-blue-400 rounded py-0.5 transition-colors"
            >{t("subsection_import")}</button>
            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.target.value = ""; }}
            />
          </div>
        </div>
      )}

      <ImportJsonModal
        mode="subsection"
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={(imported) => onChange({ ...subsection, lines: [...subsection.lines, ...imported.lines] })}
      />
    </div>
  );
}
