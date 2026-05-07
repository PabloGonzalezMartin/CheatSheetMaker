"use client";
import { useRef, useLayoutEffect, useCallback } from "react";
import { syntaxToHtml, htmlToSyntax } from "@/lib/syntaxHighlight";
import { injectEditorMarks } from "@/lib/searchHighlight";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchQuery?: string;
}

export function CommandEditor({ value, onChange, placeholder = "command", searchQuery = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);
  const searchQueryRef = useRef(searchQuery);
  searchQueryRef.current = searchQuery;

  const autoResize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, []);

  // Sync value → DOM, then inject search marks when not focused
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const current = htmlToSyntax(el.innerHTML);
    if (current !== value) {
      el.innerHTML = syntaxToHtml(value);
    }
    autoResize();
    if (searchQuery && document.activeElement !== el) {
      injectEditorMarks(el, searchQuery);
    } else if (!searchQuery) {
      injectEditorMarks(el, "");
    }
  }, [value, autoResize, searchQuery]);

  const handleInput = useCallback(() => {
    if (isComposing.current || !ref.current) return;
    onChange(htmlToSyntax(ref.current.innerHTML));
    autoResize();
  }, [onChange, autoResize]);

  // Clear marks on focus (avoids cursor disruption while typing)
  const handleFocus = useCallback(() => {
    const el = ref.current;
    if (el) injectEditorMarks(el, "");
  }, []);

  // Re-inject marks on blur
  const handleBlur = useCallback(() => {
    const el = ref.current;
    if (el && searchQueryRef.current) injectEditorMarks(el, searchQueryRef.current);
  }, []);

  const insertSpan = (type: "method" | "param" | "str") => {
    const el = ref.current;
    if (!el) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    const selectedText = range.toString();

    const span = document.createElement("span");
    span.className = `hl-${type}`;
    span.setAttribute("data-type", type);
    span.contentEditable = "true";

    if (selectedText) {
      // Wrap the selected text
      span.textContent = selectedText;
      range.deleteContents();
      range.insertNode(span);
      // Place cursor after span
      const newRange = document.createRange();
      newRange.setStartAfter(span);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    } else {
      // No selection — insert span with ZWS, place cursor inside so typing enters span
      span.textContent = "\u200b";
      range.insertNode(span);
      const newRange = document.createRange();
      newRange.setStart(span.firstChild!, 1);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    }

    onChange(htmlToSyntax(el.innerHTML));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Shift+Enter — insert explicit line break
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const br = document.createElement("br");
        range.insertNode(br);
        // Move cursor after the <br>
        const newRange = document.createRange();
        newRange.setStartAfter(br);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
        if (ref.current) onChange(htmlToSyntax(ref.current.innerHTML));
      }
      return;
    }

    // Plain Enter — block (no new block elements)
    if (e.key === "Enter") {
      e.preventDefault();
      return;
    }

    // Space exits a syntax span — insert space AFTER the span, cursor outside it
    if (e.key === " ") {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const node = sel.anchorNode;
        const parentSpan = node?.parentElement?.closest("[data-type]");
        if (parentSpan) {
          e.preventDefault();
          const space = document.createTextNode(" ");
          parentSpan.after(space);
          const newRange = document.createRange();
          newRange.setStartAfter(space);
          newRange.collapse(true);
          sel.removeAllRanges();
          sel.addRange(newRange);
          if (ref.current) onChange(htmlToSyntax(ref.current.innerHTML));
        }
      }
    }
  };

  return (
    <div className="relative flex-1 min-w-0">
      {/* Contenteditable */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onCompositionStart={() => { isComposing.current = true; }}
        onCompositionEnd={() => { isComposing.current = false; handleInput(); }}
        style={{ minHeight: "28px", overflowY: "hidden", paddingRight: "56px" }}
        className="command-editor w-full font-mono text-xs text-gray-800 bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary whitespace-pre-wrap break-words"
        spellCheck={false}
      />

      {/* Syntax buttons — top-right overlay */}
      <div className="absolute top-0.5 right-0.5 flex gap-0.5">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); insertSpan("method"); }}
          className="px-1 py-0.5 text-[10px] font-mono rounded border border-red-300 text-red-600 hover:bg-red-50 bg-white"
          title="Method (red)"
        >M</button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); insertSpan("param"); }}
          className="px-1 py-0.5 text-[10px] font-mono rounded border border-orange-300 text-orange-600 hover:bg-orange-50 bg-white"
          title="Parameter (orange)"
        >P</button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); insertSpan("str"); }}
          className="px-1 py-0.5 text-[10px] font-mono rounded border border-green-300 text-green-600 hover:bg-green-50 bg-white"
          title="String (green)"
        >S</button>
      </div>
    </div>
  );
}
