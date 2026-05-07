"use client";
import { useState } from "react";
import type { CodeLine } from "@/types/cheatsheet";
import { syntaxToHtml } from "@/lib/syntaxHighlight";
import { textMatches } from "@/lib/searchHighlight";
import { useEditorStore } from "@/store/editorStore";
import { CodeLineEditor } from "./CodeLineEditor";
import { withImageToken } from "@/lib/api";
import { ImageLightbox } from "@/components/renderer/ImageLightbox";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

interface Props {
  line: CodeLine;
  index: number;
  isEditing: boolean;
  onStartEdit: () => void;
  onChange: (line: CodeLine) => void;
  onRemove: () => void;
  onInsertBefore: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  accentColor?: string;
}

export function WysiwygCodeLineRow({
  line,
  index,
  isEditing,
  onStartEdit,
  onChange,
  onRemove,
  onInsertBefore,
  dragHandleProps,
  accentColor = "#667eea",
}: Props) {
  const searchQuery = useEditorStore((s) => s.searchQuery);
  const [lightbox, setLightbox] = useState(false);
  const [draggingWidth, setDraggingWidth] = useState<number | null>(null);

  const hasMatch = Boolean(
    searchQuery &&
    (textMatches(line.command ?? "", searchQuery) ||
      textMatches(line.comment ?? "", searchQuery) ||
      textMatches(line.text ?? "", searchQuery))
  );

  if (isEditing) {
    return (
      <div
        data-search-match={hasMatch ? "true" : undefined}
        className="border border-primary/40 rounded-md bg-white my-0.5"
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => e.preventDefault()}
      >
        <CodeLineEditor
          line={line}
          onChange={onChange}
          onRemove={() => { onRemove(); }}
          onInsertBefore={onInsertBefore}
          dragHandleProps={dragHandleProps}
        />
      </div>
    );
  }

  // Image line — inline display with resize and lightbox
  if (line.type === "image" && line.src) {
    const src = withImageToken(line.src);
    const displayWidth = draggingWidth ?? line.widthPercent ?? 100;
    return (
      <div
        className="group/line relative my-1"
        onPointerDown={(e) => e.stopPropagation()}
        onDragStart={(e) => e.stopPropagation()}
        draggable={false}
      >
        {lightbox && <ImageLightbox src={src} onClose={() => setLightbox(false)} />}
        {/* Drag handle overlay */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 z-10 cursor-grab opacity-0 group-hover/line:opacity-60 text-gray-400 select-none bg-white rounded shadow-sm px-0.5"
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: "0.85rem" }}
          >⠿</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
          <img
            src={src}
            alt="Inline image"
            className="img-zoomable rounded"
            onClick={() => setLightbox(true)}
            style={{ maxWidth: `${displayWidth}%`, height: "auto", display: "block" }}
          />
          {/* Width slider */}
          <div className="flex items-center gap-2 w-full px-2 opacity-0 group-hover/line:opacity-100 transition-opacity">
            <input
              type="range"
              min={10}
              max={100}
              value={displayWidth}
              onChange={(e) => setDraggingWidth(Number(e.target.value))}
              onPointerUp={(e) => {
                const v = Number((e.target as HTMLInputElement).value);
                setDraggingWidth(null);
                onChange({ ...line, widthPercent: v });
              }}
              className="flex-1 accent-primary cursor-pointer h-1"
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-[10px] text-gray-400 w-7 text-right flex-shrink-0">{displayWidth}%</span>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="text-[10px] text-red-400 hover:text-red-600 flex-shrink-0"
              title="Remove image"
            >✕</button>
          </div>
        </div>
      </div>
    );
  }

  const isText = line.type === "text";

  const handle = dragHandleProps ? (
    <div
      {...dragHandleProps}
      className="flex-shrink-0 cursor-grab opacity-0 group-hover/line:opacity-60 select-none text-gray-400"
      onClick={(e) => e.stopPropagation()}
      style={{ fontSize: "0.85rem", padding: "0 3px" }}
    >⠿</div>
  ) : null;

  if (isText) {
    const textBg = hasMatch
      ? "rgba(255,213,0,0.2)"
      : `${accentColor}0d`;
    return (
      <div
        data-search-match={hasMatch ? "true" : undefined}
        style={{
          display: "flex",
          alignItems: "flex-start",
          margin: "1px 0",
          borderRadius: "4px",
          background: textBg,
          position: "relative",
        }}
        className="group/line"
      >
        {handle && (
          <div style={{ paddingTop: "7px", paddingLeft: "4px", flexShrink: 0 }}>{handle}</div>
        )}
        <div
          className="prose prose-sm max-w-none flex-1 min-w-0"
          style={{ padding: "6px 10px", fontSize: "0.88rem", lineHeight: 1.5, color: "#2c3e50", cursor: "pointer" }}
          onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
        >
          {line.text ? (
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {line.text}
            </ReactMarkdown>
          ) : (
            <span style={{ color: "#aaa", fontStyle: "italic", fontSize: "0.8rem" }}>Empty text — click to edit</span>
          )}
        </div>
        {/* Hover action buttons */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover/line:opacity-100 transition-opacity flex-shrink-0 self-center pr-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
            title="Edit"
            className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-primary hover:bg-white/80 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path d="M13.488 2.513a1.75 1.75 0 00-2.475 0L6.75 6.774a2.75 2.75 0 00-.596.892l-.848 2.047a.75.75 0 00.98.98l2.047-.848a2.75 2.75 0 00.892-.596l4.261-4.263a1.75 1.75 0 000-2.474zM4.75 7.5a.75.75 0 000 1.5h.01a.75.75 0 000-1.5H4.75zM2 10.25A2.25 2.25 0 014.25 8h.5a.75.75 0 000-1.5h-.5A3.75 3.75 0 00.5 10.25v1.5A2.25 2.25 0 002.75 14h9.5A2.25 2.25 0 0014.5 11.75v-1.5a.75.75 0 00-1.5 0v1.5a.75.75 0 01-.75.75h-9.5a.75.75 0 01-.75-.75v-1.5z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            title="Delete line"
            className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-white/80 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-search-match={hasMatch ? "true" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "2px",
        padding: "3px 8px",
        fontFamily: "'Courier New', monospace",
        fontSize: "0.82rem",
        margin: "1px 0",
        borderRadius: "3px",
        backgroundColor: hasMatch ? "rgba(255,213,0,0.25)" : index % 2 === 0 ? "#f8f9fa" : "#fff",
        cursor: "pointer",
        minHeight: "24px",
      }}
      className="group/line hover:bg-[#e9ecef] transition-colors"
      onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
    >
      {handle}
      <span
        dangerouslySetInnerHTML={{ __html: syntaxToHtml(line.command || "") }}
        style={{ color: "#2c3e50", fontWeight: 500, flexGrow: 1, minWidth: 0, overflow: "hidden" }}
      />
      {line.comment && (
        <span style={{ color: "#6c757d", fontStyle: "italic", paddingLeft: 8, fontSize: "0.74rem", flexShrink: 0, maxWidth: "45%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          # {line.comment}
        </span>
      )}
      {!line.command && !line.comment && (
        <span style={{ color: "#aaa", fontStyle: "italic", fontSize: "0.78rem" }}>Empty — click to edit</span>
      )}
      {/* Hover action buttons */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover/line:opacity-100 transition-opacity flex-shrink-0 ml-1">
        <button
          onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
          title="Edit"
          className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-primary hover:bg-gray-200 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path d="M13.488 2.513a1.75 1.75 0 00-2.475 0L6.75 6.774a2.75 2.75 0 00-.596.892l-.848 2.047a.75.75 0 00.98.98l2.047-.848a2.75 2.75 0 00.892-.596l4.261-4.263a1.75 1.75 0 000-2.474zM4.75 7.5a.75.75 0 000 1.5h.01a.75.75 0 000-1.5H4.75zM2 10.25A2.25 2.25 0 014.25 8h.5a.75.75 0 000-1.5h-.5A3.75 3.75 0 00.5 10.25v1.5A2.25 2.25 0 002.75 14h9.5A2.25 2.25 0 0014.5 11.75v-1.5a.75.75 0 00-1.5 0v1.5a.75.75 0 01-.75.75h-9.5a.75.75 0 01-.75-.75v-1.5z" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title="Delete line"
          className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-gray-200 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
            <path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
