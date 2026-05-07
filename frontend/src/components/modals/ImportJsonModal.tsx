"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Section, Subsection } from "@/types/cheatsheet";
import { useLanguage } from "@/lib/i18n";

interface SectionProps {
  mode: "section";
  open: boolean;
  onClose: () => void;
  onImport: (section: Section) => void;
}

interface SubsectionProps {
  mode: "subsection";
  open: boolean;
  onClose: () => void;
  onImport: (subsection: Subsection) => void;
}

type Props = SectionProps | SubsectionProps;

function addUiIds(section: Section): Section {
  return {
    ...section,
    _uiId: crypto.randomUUID(),
    subsections: (section.subsections || []).map((sub) => ({
      ...sub,
      _uiId: crypto.randomUUID(),
    })),
  };
}

const SECTION_PLACEHOLDER = `{
  "title": "My Section",
  "description": "Optional description",
  "lines": [
    { "type": "code", "command": "git init", "comment": "init repo" }
  ],
  "subsections": []
}`;

const SUBSECTION_PLACEHOLDER = `{
  "title": "My Subsection",
  "lines": [
    { "type": "code", "command": "git init", "comment": "init repo" },
    { "type": "text", "text": "Some **markdown** text" }
  ]
}`;

export function ImportJsonModal(props: Props) {
  const { t } = useLanguage();
  const { mode, open, onClose } = props;
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [open]);

  const handleClose = () => {
    setText("");
    setError("");
    onClose();
  };

  const handleImport = () => {
    setError("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      setError("Invalid JSON — check for missing commas or brackets.");
      return;
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      setError("Expected a JSON object { ... }");
      return;
    }

    const obj = parsed as Record<string, unknown>;

    if (mode === "section") {
      if (!Array.isArray(obj.lines) && !Array.isArray(obj.subsections)) {
        setError('Must have at least a "lines" or "subsections" array.');
        return;
      }
      const section: Section = {
        title: typeof obj.title === "string" ? obj.title : "",
        description: typeof obj.description === "string" ? obj.description : "",
        images: Array.isArray(obj.images) ? obj.images : [],
        lines: Array.isArray(obj.lines) ? obj.lines : [],
        subsections: Array.isArray(obj.subsections) ? obj.subsections : [],
      };
      (props as SectionProps).onImport(addUiIds(section));
    } else {
      if (!Array.isArray(obj.lines)) {
        setError('Must have a "lines" array.');
        return;
      }
      const subsection: Subsection = {
        _uiId: crypto.randomUUID(),
        title: typeof obj.title === "string" ? obj.title : "",
        images: Array.isArray(obj.images) ? obj.images : [],
        lines: obj.lines,
      };
      (props as SubsectionProps).onImport(subsection);
    }

    handleClose();
  };

  if (!open) return null;

  const isSection = mode === "section";
  const placeholder = isSection ? SECTION_PLACEHOLDER : SUBSECTION_PLACEHOLDER;
  const canImport = text.trim().length > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(2px)" }}
      onClick={handleClose}
    >
      <div
        className="rounded-2xl shadow-2xl w-full mx-4 flex flex-col overflow-hidden"
        style={{ maxWidth: "560px", maxHeight: "90vh", background: "#f0f4ff" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4" style={{ background: "#667eea" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">
                {isSection ? t("modal_importSection") : t("modal_importSubsection")}
              </h2>
              <p className="text-xs text-white/60 mt-0.5">
                {t("modal_pasteJsonObj")}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors text-lg leading-none"
            >×</button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 flex-1 overflow-y-auto">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => { setText(e.target.value); setError(""); }}
              placeholder={placeholder}
              rows={12}
              className="w-full text-xs font-mono bg-white border border-blue-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 resize-none transition-colors placeholder-gray-300"
              style={{ lineHeight: 1.6 }}
              spellCheck={false}
            />
            {text.trim().length > 0 && (
              <button
                onClick={() => { setText(""); setError(""); textareaRef.current?.focus(); }}
                className="absolute top-2.5 right-2.5 w-5 h-5 flex items-center justify-center rounded-md text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors text-sm"
                title={t("modal_clear")}
              >×</button>
            )}
          </div>

          {error && (
            <div className="mt-2 flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              <span className="mt-0.5 flex-shrink-0">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Schema hint */}
          <div className="mt-3 text-[10px] text-primary/60 leading-relaxed">
            {isSection
              ? <>Required: <code className="bg-blue-100 px-1 rounded">lines</code> or <code className="bg-blue-100 px-1 rounded">subsections</code> array. Optional: <code className="bg-blue-100 px-1 rounded">title</code>, <code className="bg-blue-100 px-1 rounded">description</code>.</>
              : <>Required: <code className="bg-blue-100 px-1 rounded">lines</code> array. Optional: <code className="bg-blue-100 px-1 rounded">title</code>.</>
            }
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3 flex items-center justify-between border-t border-blue-100">
          <button
            onClick={handleClose}
            className="text-xs px-4 py-2 rounded-lg text-primary/60 hover:text-primary hover:bg-primary/10 transition-colors"
          >
            {t("modal_cancel")}
          </button>
          <button
            onClick={handleImport}
            disabled={!canImport}
            className="text-xs px-5 py-2 text-white rounded-lg font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
            style={{ background: "#667eea" }}
          >
            {isSection ? t("modal_importSectionBtn") : t("modal_importSubsectionBtn")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
