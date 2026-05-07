"use client";
import { useRef, useLayoutEffect } from "react";
import type { CodeLine } from "@/types/cheatsheet";
import { CommandEditor } from "./CommandEditor";
import { stripSyntaxTags } from "@/lib/syntaxHighlight";
import { useEditorStore } from "@/store/editorStore";
import { textMatches } from "@/lib/searchHighlight";

interface Props {
  line: CodeLine;
  onChange: (line: CodeLine) => void;
  onRemove: () => void;
  onInsertBefore: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

function useAutoResize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return ref;
}

export function CodeLineEditor({ line, onChange, onRemove, onInsertBefore, dragHandleProps }: Props) {
  const isText = line.type === "text";
  const textRef = useAutoResize(line.text || "");
  const commentRef = useAutoResize(line.comment || "");
  const searchQuery = useEditorStore((s) => s.searchQuery);
  const commandHasMatch = searchQuery ? textMatches(line.command ?? "", searchQuery) : false;
  const commentHasMatch = searchQuery ? textMatches(line.comment ?? "", searchQuery) : false;
  const textHasMatch = searchQuery ? textMatches(line.text ?? "", searchQuery) : false;
  const lineHasMatch = commandHasMatch || commentHasMatch || textHasMatch;

  const setType = (type: "code" | "text") => {
    if (type === "text") {
      onChange({ type: "text", text: stripSyntaxTags(line.command || "") });
    } else {
      onChange({ type: "code", command: line.text || "", comment: "" });
    }
  };

  return (
    <div
      className={`group relative flex items-start gap-1.5 py-1 px-1.5 rounded border bg-gray-50 transition-colors ${lineHasMatch ? "border-yellow-400" : "border-gray-200"}`}
      data-search-match={lineHasMatch ? "true" : undefined}
    >
      {/* Insert-before button */}
      <button
        onClick={onInsertBefore}
        className="absolute -top-2 left-0 hidden group-hover:flex text-[9px] text-gray-500 hover:text-primary px-1"
        title="Insert line above"
      >+ line</button>

      {/* Drag handle */}
      <div
        {...dragHandleProps}
        className="flex-shrink-0 mt-1.5 cursor-grab text-gray-400 hover:text-gray-600 text-xs select-none"
        title="Drag to reorder"
      >⠿</div>

      {/* Type toggle */}
      <div className="flex-shrink-0 flex border border-gray-300 rounded overflow-hidden">
        <button
          onClick={() => setType("code")}
          className={`px-1.5 py-0.5 text-[10px] font-mono transition-colors ${!isText ? "bg-gray-700 text-white" : "text-gray-500 hover:bg-gray-100"}`}
          title="Code line"
        >{"{}"}</button>
        <button
          onClick={() => setType("text")}
          className={`px-1.5 py-0.5 text-[10px] transition-colors ${isText ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100"}`}
          title="Text line"
        >T</button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isText ? (
          <textarea
            ref={textRef}
            autoFocus
            value={line.text || ""}
            onChange={(e) => onChange({ ...line, text: e.target.value })}
            placeholder="Text with **markdown** and $LaTeX$"
            rows={2}
            className={`w-full text-xs text-gray-700 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary placeholder-gray-400 ${textHasMatch ? "bg-yellow-50" : ""}`}
            style={{ minHeight: "40px", resize: "vertical", overflow: "hidden" }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = t.scrollHeight + "px";
            }}
          />
        ) : (
          <div className="flex gap-1.5 items-start">
            <CommandEditor
              value={line.command || ""}
              onChange={(v) => onChange({ ...line, command: v })}
              searchQuery={searchQuery}
            />
            <textarea
              ref={commentRef}
              value={line.comment || ""}
              onChange={(e) => onChange({ ...line, comment: e.target.value })}
              placeholder="# comment"
              rows={1}
              className={`w-32 flex-shrink-0 text-xs font-mono border border-gray-300 rounded px-2 py-1 text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary placeholder-gray-400 ${commentHasMatch ? "bg-yellow-50" : ""}`}
              style={{ minHeight: "28px", resize: "vertical" }}
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = t.scrollHeight + "px";
              }}
            />
          </div>
        )}
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="flex-shrink-0 mt-1 text-gray-400 hover:text-red-500 text-xs"
        title="Remove line"
      >✕</button>
    </div>
  );
}
