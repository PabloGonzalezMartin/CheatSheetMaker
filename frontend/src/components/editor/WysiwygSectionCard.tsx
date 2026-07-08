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
  const [dropInsertIdx, setDropInsertIdx] = useState<number | null>(null);
  const [landedSubIdx, setLandedSubIdx] = useState<number | null>(null);
  const landedSubTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subsection resize state
  const [resizingIdx, setResizingIdx] = useState<number | null>(null);
  const subsRowRef = useRef<HTMLDivElement>(null);
  // Stable ref to always-current subsections — fixes stale closure in resize handler
  const subsRef = useRef(section.subsections);

  const outerRef = useRef<HTMLDivElement>(null);

  // Keep subsRef current so resize closure always reads latest widths
  useEffect(() => { subsRef.current = section.subsections; }, [section.subsections]);

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

  const addSubsection = () => {
    const cur = subsRef.current;
    if (cur.length === 0) {
      // Default to 3 equal columns in one row
      updateSubsections([
        { _uiId: crypto.randomUUID(), title: "", images: [], lines: [], widthPercent: 33.3 },
        { _uiId: crypto.randomUUID(), title: "", images: [], lines: [], widthPercent: 33.3 },
        { _uiId: crypto.randomUUID(), title: "", images: [], lines: [], widthPercent: 33.4 },
      ]);
    } else {
      // Just append — buildRows will chunk into rows of 3 at render time
      updateSubsections([...cur, { _uiId: crypto.randomUUID(), title: "", images: [], lines: [] }]);
    }
  };

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

  const handleSubDrop = (e: React.DragEvent, insertBefore: number) => {
    e.preventDefault();
    setDropInsertIdx(null);
    setDragSrcSubIdx(null);
    const srcIdx = Number(e.dataTransfer.getData("subIndex"));
    if (isNaN(srcIdx)) return;
    e.stopPropagation();
    const next = [...section.subsections];
    const [moved] = next.splice(srcIdx, 1);
    const adjusted = srcIdx < insertBefore ? insertBefore - 1 : insertBefore;
    next.splice(adjusted, 0, moved);
    if (landedSubTimer.current) clearTimeout(landedSubTimer.current);
    setLandedSubIdx(adjusted);
    landedSubTimer.current = setTimeout(() => setLandedSubIdx(null), 500);
    updateSubsections(next);
  };

  // Rows respect rowBreak flags; also auto-break at 3 items.
  function buildRows(subs: Subsection[]): { sub: Subsection; globalIdx: number }[][] {
    const rows: { sub: Subsection; globalIdx: number }[][] = [];
    let current: { sub: Subsection; globalIdx: number }[] = [];
    for (let i = 0; i < subs.length; i++) {
      if (subs[i].rowBreak && current.length > 0) { rows.push(current); current = []; }
      current.push({ sub: subs[i], globalIdx: i });
      if (current.length === 3) { rows.push(current); current = []; }
    }
    if (current.length > 0) rows.push(current);
    return rows;
  }

  // Row-1 widths from widthPercent on row-1 items; equal-share for any without.
  function getRow1Widths(subs: Subsection[]): number[] {
    const row1 = (buildRows(subs)[0] ?? []).map(r => r.sub);
    const assigned = row1.map((s) => s.widthPercent ?? null);
    const fixedTotal = assigned.reduce<number>((sum, w) => sum + (w ?? 0), 0);
    const freeCount = assigned.filter((w) => w === null).length;
    const freeW = freeCount > 0 ? Math.max(10, (100 - fixedTotal) / freeCount) : 0;
    return assigned.map((w) => (w !== null ? w : freeW));
  }

  // Normalize row-1 widths to sum to 100 and persist.
  function normalizeRow1(subs: Subsection[]): Subsection[] {
    const rows = buildRows(subs);
    const row1 = rows[0] ?? [];
    const widths = getRow1Widths(subs);
    const total = widths.reduce((s, w) => s + w, 0);
    return subs.map((s, i) => {
      const riPos = row1.findIndex(r => r.globalIdx === i);
      if (riPos === -1) return s;
      return { ...s, widthPercent: total > 0 ? Math.round((widths[riPos] / total) * 1000) / 10 : Math.round(1000 / row1.length) / 10 };
    });
  }

  // Strip widthPercent from row-1 items so they get equal shares after a structural change.
  function equalizeRow1(subs: Subsection[]): Subsection[] {
    const row1Indices = new Set((buildRows(subs)[0] ?? []).map(r => r.globalIdx));
    return subs.map((s, i) => row1Indices.has(i) ? { ...s, widthPercent: undefined } : s);
  }

  // ↵: start a new row at globalIdx. Items that follow it in its current row join it.
  // Clears rowBreak from up to 2 items after globalIdx so they join the new row.
  const sendToNewRow = (globalIdx: number) => {
    const subs = subsRef.current.map((s, i) => {
      if (i === globalIdx) return { ...s, rowBreak: true };
      if (i > globalIdx && i <= globalIdx + 2) return { ...s, rowBreak: undefined };
      return s;
    });
    updateSubsections(equalizeRow1(subs));
  };

  // ↑: merge the first item of a row back into the previous row.
  // If the merged row would have < 3 items, the item that follows in the same row needs
  // an explicit rowBreak so it stays as its own row (otherwise buildRows would absorb it).
  const mergeRowUp = (globalIdx: number) => {
    const rows = buildRows(subsRef.current);
    const rowIdx = rows.findIndex(r => r.some(x => x.globalIdx === globalIdx));
    if (rowIdx <= 0) return;
    const thisRow = rows[rowIdx];
    const prevRow = rows[rowIdx - 1];
    const colInRow = thisRow.findIndex(x => x.globalIdx === globalIdx);
    // After pulling idx into prevRow, how many items will the merged row have?
    const mergedLen = prevRow.length + 1;
    // The next item in this row (if any) needs rowBreak only when mergedLen < 3,
    // because otherwise it would auto-break naturally via the max-3 rule.
    const nextGlobalIdx = colInRow + 1 < thisRow.length ? thisRow[colInRow + 1].globalIdx : -1;
    const needsExplicitBreak = nextGlobalIdx !== -1 && mergedLen < 3;
    const subs = subsRef.current.map((s, i) => {
      if (i === globalIdx) return { ...s, rowBreak: undefined };
      if (needsExplicitBreak && i === nextGlobalIdx) return { ...s, rowBreak: true };
      return s;
    });
    updateSubsections(equalizeRow1(subs));
  };

  // rightIndices: columns to the right that absorb the change proportionally.
  // initLeftWidth / initRightWidths: caller supplies the widths so any row can be resized.
  // When the rightmost wraps, the drag re-anchors and continues with the remaining right cols.
  const handleResizeMouseDown = (
    e: React.MouseEvent,
    leftIdx: number,
    initialRightIndices: number[],
    initLeftWidth: number,
    initRightWidthsArg: number[],
  ) => {
    e.preventDefault();
    const containerWidth = subsRowRef.current?.getBoundingClientRect().width ?? 800;
    const WRAP_THRESHOLD = 15;

    let anchorX = e.clientX;
    let anchorLeftWidth = initLeftWidth;
    let rightIndices = [...initialRightIndices];
    // Explicit widths — never read from subsRef after an async state update (stale-closure risk)
    let anchorRightWidths = [...initRightWidthsArg];

    setResizingIdx(leftIdx);

    const cleanup = () => {
      setResizingIdx(null);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    const reanchor = (mouseX: number, newLeft: number, newRightIndices: number[], newRightWidths: number[]) => {
      anchorX = mouseX;
      anchorLeftWidth = newLeft;
      rightIndices = newRightIndices;
      anchorRightWidths = newRightWidths;
    };

    const onMouseMove = (me: MouseEvent) => {
      const delta = ((me.clientX - anchorX) / containerWidth) * 100;
      const startR = anchorRightWidths.reduce((s, w) => s + w, 0);
      const sumLR = anchorLeftWidth + startR;
      const rawL = anchorLeftWidth + delta;

      // Wrap left column if it shrinks below threshold
      if (rawL < WRAP_THRESHOLD && anchorLeftWidth >= WRAP_THRESHOLD) {
        const next = subsRef.current.map((s, i) => {
          if (i === leftIdx) return { ...s, rowBreak: true };
          if (i > leftIdx && i <= leftIdx + 2) return { ...s, rowBreak: undefined };
          return s;
        });
        updateSubsections(equalizeRow1(next));
        cleanup();
        return;
      }

      // Waterfall: rightmost column absorbs all shrinkage first (B stays fixed until C exhausted)
      const newRightWidths = [...anchorRightWidths];
      let remaining = delta;
      for (let i = newRightWidths.length - 1; i >= 0 && remaining !== 0; i--) {
        if (remaining > 0) {
          const canGive = Math.max(0, newRightWidths[i] - WRAP_THRESHOLD);
          const take = Math.min(remaining, canGive);
          newRightWidths[i] -= take;
          remaining -= take;
        } else {
          newRightWidths[i] -= remaining;
          remaining = 0;
        }
      }

      const rightmostPos = rightIndices.length - 1;

      if (newRightWidths[rightmostPos] <= WRAP_THRESHOLD) {
        if (rightIndices.length > 1) {
          // C wraps. wrappedL = how far A grew to exhaust C = anchorL + (C_anchor - threshold)
          const wrappedL = anchorLeftWidth + anchorRightWidths[rightmostPos] - WRAP_THRESHOLD;
          const wrapIdx = rightIndices[rightmostPos];
          const newRightIndices = rightIndices.slice(0, rightmostPos);
          const remainingSum = anchorRightWidths.slice(0, rightmostPos).reduce((s, w) => s + w, 0);
          const fillRatio = remainingSum > 0 ? (sumLR - wrappedL) / remainingSum : 1;
          const filledWidths = anchorRightWidths.slice(0, rightmostPos).map((w) => w * fillRatio);
          const next = subsRef.current.map((s, i) => {
            if (i === leftIdx) return { ...s, widthPercent: Math.round(wrappedL * 10) / 10 };
            const riPos = newRightIndices.indexOf(i);
            if (riPos !== -1) return { ...s, widthPercent: Math.round(filledWidths[riPos] * 10) / 10 };
            if (i === wrapIdx) return { ...s, rowBreak: true };
            if (i > wrapIdx && i <= wrapIdx + 2) return { ...s, rowBreak: undefined };
            return s;
          });
          updateSubsections(next);
          reanchor(me.clientX, wrappedL, newRightIndices, filledWidths);
          return;
        } else {
          // Last right column (B) wraps — drag ends
          const wrapIdx = rightIndices[0];
          const next = subsRef.current.map((s, i) => {
            if (i === wrapIdx) return { ...s, rowBreak: true };
            if (i > wrapIdx && i <= wrapIdx + 2) return { ...s, rowBreak: undefined };
            return s;
          });
          updateSubsections(equalizeRow1(next));
          cleanup();
          return;
        }
      }

      // Normal live update
      const newL = Math.max(WRAP_THRESHOLD, Math.min(sumLR - WRAP_THRESHOLD * rightIndices.length, rawL));
      const next = subsRef.current.map((s, i) => {
        if (i === leftIdx) return { ...s, widthPercent: Math.round(newL * 10) / 10 };
        const riPos = rightIndices.indexOf(i);
        if (riPos !== -1) return { ...s, widthPercent: Math.round(newRightWidths[riPos] * 10) / 10 };
        return s;
      });
      updateSubsections(next);
    };

    const onMouseUp = () => {
      cleanup();
      updateSubsections(normalizeRow1(subsRef.current));
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
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
              style={{ minHeight: "10px", lineHeight: 1, background: "white", border: "1px solid #d1d5db" }}
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
              className="group/desc relative rounded px-2 py-0.5 -mx-2 cursor-text hover:bg-black/5 transition-colors renderer-text-line"
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
            {/* Per-section subsection toolbar */}
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
              {/* Reset widths button — only visible when any subsection has a custom width */}
              {section.subsections.some((s) => s.widthPercent != null) && (
                <button
                  onClick={() => {
                    // Strip all width overrides — row1Widths will default to equal shares
                    updateSubsections(subsRef.current.map((s) => {
                      const { widthPercent: _w, colStart: _c, ...rest } = s;
                      return rest as Subsection;
                    }));
                  }}
                  className="flex items-center gap-0.5 text-[9px] text-gray-400 hover:text-orange-500 border border-gray-200 hover:border-orange-300 rounded px-1.5 py-0.5 transition-colors ml-auto"
                  title="Reset all subsection widths to equal"
                >
                  <svg className="w-2 h-2" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M1 5a4 4 0 1 0 4-4"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M1 2v3h3"/>
                  </svg>
                  Reset widths
                </button>
              )}
            </div>

            {/* Subsection grid — rowBreak flags define row boundaries, auto-break at 3 */}
            {(() => {
              const subs = section.subsections;
              const GAP = 6;
              const rows = buildRows(subs);
              const row1 = rows[0] ?? [];
              const row1Widths = getRow1Widths(subs);

              // Compute display widths for any row (equal-share for items without widthPercent)
              const getWidthsForRow = (row: typeof rows[0]): number[] => {
                const assigned = row.map(r => r.sub.widthPercent ?? null);
                const fixedTotal = assigned.reduce<number>((s, w) => s + (w ?? 0), 0);
                const freeCount = assigned.filter(w => w === null).length;
                const freeW = freeCount > 0 ? Math.max(10, (100 - fixedTotal) / freeCount) : 0;
                return assigned.map(w => w !== null ? w : freeW);
              };

              const renderCard = (
                sub: Subsection,
                globalIdx: number,
                colIdx: number,
                currentRow: typeof rows[0],
                rowWidths: number[],
                hideResizeHandle = false,
              ) => {
                const isLastInRow = colIdx === currentRow.length - 1;
                // ↵ shown when item has a predecessor in its row (colIdx > 0)
                const canSendToNewRow = colIdx > 0;
                // ↑ shown when item explicitly starts a new row via rowBreak flag
                const canMergeRowUp = sub.rowBreak === true;
                const isSubDragging = dragSrcSubIdx === globalIdx;
                const hasSubLanded = landedSubIdx === globalIdx;
                const showDropBefore = dropInsertIdx === globalIdx && dragSrcSubIdx !== globalIdx;
                const showDropAfter = dropInsertIdx === subs.length && globalIdx === subs.length - 1 && dragSrcSubIdx !== globalIdx;
                return (
                  <div
                    key={sub._uiId ?? globalIdx}
                    data-sub-card
                    style={{ position: "relative", minWidth: "80px", opacity: isSubDragging ? 0.35 : 1, transform: isSubDragging ? "scale(0.97)" : "scale(1)", transition: "opacity 0.12s ease, transform 0.12s ease" }}
                    className={hasSubLanded ? "drop-landed" : ""}
                    onDragOver={(e) => {
                      if (!e.dataTransfer.types.includes("subindex")) return;
                      e.preventDefault();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const insertIdx = e.clientX < rect.left + rect.width / 2 ? globalIdx : globalIdx + 1;
                      if (dropInsertIdx !== insertIdx) setDropInsertIdx(insertIdx);
                    }}
                    onDrop={(e) => { if (!e.dataTransfer.types.includes("subindex")) return; handleSubDrop(e, dropInsertIdx ?? subs.length); }}
                  >
                    {showDropBefore && <div style={{ position: "absolute", left: -4, top: 0, bottom: 0, width: 3, background: color.badgeColor, borderRadius: 2, zIndex: 10, boxShadow: `0 0 6px ${color.badgeColor}80` }} />}
                    {showDropAfter && <div style={{ position: "absolute", right: -4, top: 0, bottom: 0, width: 3, background: color.badgeColor, borderRadius: 2, zIndex: 10, boxShadow: `0 0 6px ${color.badgeColor}80` }} />}
                    <WysiwygSubsectionCard
                      subsection={sub}
                      sectionIndex={index}
                      subsectionIndex={globalIdx}
                      color={color}
                      cheatsheetId={cheatsheetId}
                      onChange={(s) => updateSubsection(globalIdx, s)}
                      onRemove={() => removeSubsection(globalIdx)}
                      dragHandleProps={{
                        draggable: true,
                        onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData("subIndex", String(globalIdx)); e.dataTransfer.effectAllowed = "move"; setTimeout(() => setDragSrcSubIdx(globalIdx), 0); },
                        onDragEnd: () => { setDragSrcSubIdx(null); setDropInsertIdx(null); },
                      }}
                      onSendToNewRow={canSendToNewRow ? () => sendToNewRow(globalIdx) : undefined}
                      onMergeRowUp={canMergeRowUp ? () => mergeRowUp(globalIdx) : undefined}
                    />
                    {!isLastInRow && !hideResizeHandle && (
                      <div
                        onMouseDown={(e) => {
                          // All columns to the right absorb change proportionally (waterfall)
                          const rightEntries = currentRow.slice(colIdx + 1);
                          const rightIds = rightEntries.map(r => r.globalIdx);
                          const rightWidths = rightEntries.map((_, k) => rowWidths[colIdx + 1 + k]);
                          handleResizeMouseDown(e, globalIdx, rightIds, rowWidths[colIdx], rightWidths);
                        }}
                        style={{ position: "absolute", top: 0, right: -4, bottom: 0, width: 8, cursor: "col-resize", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
                        title="Drag to resize"
                      >
                        <div style={{ width: 3, height: "40%", borderRadius: 2, background: resizingIdx === globalIdx ? color.badgeColor : "#d1d5db", transition: "background 0.15s" }} className="hover:!bg-blue-400" />
                      </div>
                    )}
                  </div>
                );
              };

              // Masonry: when row1 has >1 col, items belonging to the same column stack
              // under each other. Overflow rows (different count than row1) render below.
              // When row1 has exactly 1 item, everything is independent (no column stacking).
              const row1Len = row1.length;

              if (row1Len <= 1) {
                // Single-column row1 — keep simple row-per-row grid
                return (
                  <div ref={subsRowRef} style={{ marginTop: "4px" }}>
                    {rows.map((row, rIdx) => {
                      const rowWidths = rIdx === 0 ? row1Widths : getWidthsForRow(row);
                      const rowCols = rowWidths.map(w => `${w}fr`).join(" ");
                      return (
                        <div
                          key={row[0]?.sub._uiId ?? rIdx}
                          style={{ display: "grid", gridTemplateColumns: rowCols, gap: `${GAP}px`, alignItems: "start", marginBottom: rIdx < rows.length - 1 ? `${GAP}px` : 0 }}
                        >
                          {row.map(({ sub, globalIdx }, colIdx) =>
                            renderCard(sub, globalIdx, colIdx, row, rowWidths)
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }

              // Multi-column masonry — distribute items into column buckets
              const columns: { sub: Subsection; globalIdx: number }[][] =
                Array.from({ length: row1Len }, () => []);
              const overflowRows: typeof rows = [];

              for (const row of rows) {
                if (row.length === row1Len) {
                  row.forEach(({ sub, globalIdx }, ci) => columns[ci].push({ sub, globalIdx }));
                } else {
                  overflowRows.push(row);
                }
              }

              return (
                <div ref={subsRowRef} style={{ marginTop: "4px" }}>
                  {/* Masonry columns — each column stacks independently */}
                  <div style={{ display: "flex", gap: `${GAP}px`, alignItems: "flex-start" }}>
                    {columns.map((colItems, colIdx) => (
                      <div
                        key={`col-${colIdx}`}
                        style={{
                          flex: `${row1Widths[colIdx]}`,
                          minWidth: "80px",
                          position: "relative",
                          display: "flex",
                          flexDirection: "column",
                          gap: `${GAP}px`,
                        }}
                      >
                        {colItems.map(({ sub, globalIdx }) => {
                          const itemRow = rows.find(r => r.some(x => x.globalIdx === globalIdx))!;
                          const itemColInRow = itemRow.findIndex(x => x.globalIdx === globalIdx);
                          return renderCard(sub, globalIdx, itemColInRow, itemRow, row1Widths, true);
                        })}
                        {/* Column resize handle — between this column and the next */}
                        {colIdx < columns.length - 1 && (
                          <div
                            onMouseDown={(e) => {
                              const rightIds = row1.slice(colIdx + 1).map(r => r.globalIdx);
                              const rightWidths = row1Widths.slice(colIdx + 1);
                              handleResizeMouseDown(e, row1[colIdx].globalIdx, rightIds, row1Widths[colIdx], rightWidths);
                            }}
                            style={{ position: "absolute", top: 0, right: -4, bottom: 0, width: 8, cursor: "col-resize", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
                            title="Drag to resize"
                          >
                            <div style={{ width: 3, height: "40%", borderRadius: 2, background: resizingIdx === row1[colIdx].globalIdx ? color.badgeColor : "#d1d5db", transition: "background 0.15s" }} className="hover:!bg-blue-400" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Overflow rows — different column count, render independently below */}
                  {overflowRows.map((row, i) => {
                    const rowWidths = getWidthsForRow(row);
                    const rowCols = rowWidths.map(w => `${w}fr`).join(" ");
                    return (
                      <div
                        key={`overflow-${i}`}
                        style={{ display: "grid", gridTemplateColumns: rowCols, gap: `${GAP}px`, alignItems: "start", marginTop: `${GAP}px` }}
                      >
                        {row.map(({ sub, globalIdx }, colIdx) =>
                          renderCard(sub, globalIdx, colIdx, row, rowWidths)
                        )}
                      </div>
                    );
                  })}
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
