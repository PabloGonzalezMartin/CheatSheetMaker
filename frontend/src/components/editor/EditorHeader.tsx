"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useEditorStore } from "@/store/editorStore";
import { getAccessToken } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n/en";

type ViewMode = "editor" | "preview" | "pdf";

interface Props {
  onSave: () => void;
  onDownloadHtml: () => void;
  isSaving: boolean;
  isDirty: boolean;
  hasId: boolean;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  previewSearchQuery: string;
  onPreviewSearchChange: (q: string) => void;
  autosave: boolean;
  onAutosaveToggle: () => void;
  lastSavedAt: Date | null;
}

export function EditorHeader({
  onSave, onDownloadHtml, isSaving, isDirty, hasId,
  view, onViewChange, previewSearchQuery, onPreviewSearchChange,
  autosave, onAutosaveToggle, lastSavedAt,
}: Props) {
  const currentCheatsheet = useEditorStore((s) => s.currentCheatsheet);
  const updateCurrentCheatsheet = useEditorStore((s) => s.updateCurrentCheatsheet);
  const searchQuery = useEditorStore((s) => s.searchQuery);
  const setSearchQuery = useEditorStore((s) => s.setSearchQuery);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const historyStack = useEditorStore((s) => s.historyStack);
  const redoStack = useEditorStore((s) => s.redoStack);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const navigatorOpen = useEditorStore((s) => s.navigatorOpen);
  const setNavigatorOpen = useEditorStore((s) => s.setNavigatorOpen);
  const groups = useEditorStore((s) => s.groups);

  const [searchOpen, setSearchOpen] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [matchIdx, setMatchIdx] = useState(0);
  const [previewMatchCount, setPreviewMatchCount] = useState(0);
  const [previewMatchIdx, setPreviewMatchIdx] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const previewSearchInputRef = useRef<HTMLInputElement>(null);
  const matchIdxRef = useRef(0);
  const previewMatchIdxRef = useRef(0);
  const exportRef = useRef<HTMLDivElement>(null);

  const { t } = useLanguage();
  const isNew = !currentCheatsheet.id;

  const handleDownloadJson = () => {
    if (!currentCheatsheet.id) return;
    window.open(`/download-json/${currentCheatsheet.id}?token=${getAccessToken()}`, "_blank");
  };

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportOpen]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
    else { setSearchQuery(""); setMatchCount(0); setMatchIdx(0); }
  }, [searchOpen, setSearchQuery]);

  const navigateToEl = useCallback((el: Element) => {
    const sectionEl = el.closest("[id^='section-']");
    if (sectionEl) sectionEl.dispatchEvent(new CustomEvent("expand-section"));

    const subEl = el.closest("[data-subsection-container]");
    if (subEl) subEl.dispatchEvent(new CustomEvent("expand-subsection"));

    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        el.scrollIntoView({ behavior: "smooth", block: "center" })
      )
    );
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setMatchCount(0); setMatchIdx(0); matchIdxRef.current = 0; return; }
    const id = setTimeout(() => {
      const els = document.querySelectorAll("[data-search-match='true']");
      setMatchCount(els.length);
      setMatchIdx(0);
      matchIdxRef.current = 0;
      if (els[0]) navigateToEl(els[0]);
    }, 80);
    return () => clearTimeout(id);
  }, [searchQuery, navigateToEl]);

  const navigate = useCallback((dir: 1 | -1) => {
    const els = Array.from(document.querySelectorAll("[data-search-match='true']"));
    if (!els.length) return;
    const next = ((matchIdxRef.current + dir) + els.length) % els.length;
    matchIdxRef.current = next;
    setMatchIdx(next);
    navigateToEl(els[next]);
  }, [navigateToEl]);

  // Preview search: count matches and auto-navigate on query change
  useEffect(() => {
    if (view !== "preview") return;
    if (!previewSearchQuery.trim()) { setPreviewMatchCount(0); setPreviewMatchIdx(0); previewMatchIdxRef.current = 0; return; }
    const id = setTimeout(() => {
      const els = document.querySelectorAll("[data-search-match='true']");
      setPreviewMatchCount(els.length);
      setPreviewMatchIdx(0);
      previewMatchIdxRef.current = 0;
      if (els[0]) navigateToEl(els[0]);
    }, 80);
    return () => clearTimeout(id);
  }, [previewSearchQuery, view, navigateToEl]);

  // Focus preview input when switching to preview with an active query
  useEffect(() => {
    if (view === "preview") previewSearchInputRef.current?.focus();
    else { setPreviewMatchCount(0); setPreviewMatchIdx(0); previewMatchIdxRef.current = 0; }
  }, [view]);

  const navigatePreview = useCallback((dir: 1 | -1) => {
    const els = Array.from(document.querySelectorAll("[data-search-match='true']"));
    if (!els.length) return;
    const next = ((previewMatchIdxRef.current + dir) + els.length) % els.length;
    previewMatchIdxRef.current = next;
    setPreviewMatchIdx(next);
    navigateToEl(els[next]);
  }, [navigateToEl]);

  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2">
      {/* Title */}
      <input
        type="text"
        value={currentCheatsheet.title}
        onChange={(e) => updateCurrentCheatsheet({ title: e.target.value })}
        onBlur={() => pushHistory(currentCheatsheet)}
        placeholder={t("header_titlePlaceholder")}
        className="flex-1 text-base font-semibold text-gray-800 placeholder-gray-300 min-w-0 rounded-md px-2 py-0.5 border border-transparent hover:border-gray-200 focus:border-blue-300 focus:outline-none focus:ring-0 transition-colors bg-transparent hover:bg-gray-50 focus:bg-white"
      />

      {/* Group selector — editor only */}
      {view === "editor" && (
        <label className="flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
          {t("header_group")}
          <select
            value={currentCheatsheet.group || ""}
            onChange={(e) => { pushHistory(currentCheatsheet); updateCurrentCheatsheet({ group: e.target.value }); }}
            className="border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary text-gray-600 bg-white text-xs"
          >
            <option value="">{t("header_groupNone")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </label>
      )}

      {/* Editor-only controls */}
      {view === "editor" && (
        <>
          <div className="w-px h-5 bg-gray-200 flex-shrink-0" />

          {/* Undo / Redo */}
          <button onClick={undo} disabled={historyStack.length === 0} title={t("header_undo")}
            className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed px-1 flex-shrink-0">↩</button>
          <button onClick={redo} disabled={redoStack.length === 0} title={t("header_redo")}
            className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed px-1 flex-shrink-0">↪</button>

          <div className="w-px h-5 bg-gray-200 flex-shrink-0" />

          {/* Search */}
          {searchOpen ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearchOpen(false);
                  if (e.key === "Enter") navigate(e.shiftKey ? -1 : 1);
                }}
                placeholder={t("header_search")}
                className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary w-36"
              />
              {searchQuery && (
                <span className="text-[10px] text-gray-400 whitespace-nowrap">
                  {matchCount === 0 ? t("header_noMatches") : `${matchIdx + 1}/${matchCount}`}
                </span>
              )}
              <button onClick={() => navigate(-1)} disabled={matchCount === 0} title={t("header_previous")}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs px-0.5">↑</button>
              <button onClick={() => navigate(1)} disabled={matchCount === 0} title={t("header_next")}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs px-0.5">↓</button>
              <button onClick={() => setSearchOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-xs px-0.5">✕</button>
            </div>
          ) : (
            <button onClick={() => setSearchOpen(true)} title={t("header_searchIn")}
              className="text-xs text-gray-400 hover:text-gray-700 px-1 py-1 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
            </button>
          )}

          {/* Section navigator icon */}
          <button onClick={() => setNavigatorOpen(!navigatorOpen)} title={t("header_sectionNavigator")}
            className={`p-1 rounded transition-colors flex-shrink-0 ${navigatorOpen ? "bg-primary/10 text-primary" : "text-gray-400 hover:text-gray-700"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Expand / Collapse all — icons only */}
          <div className="flex items-center rounded-md border border-gray-200 overflow-hidden text-gray-400 flex-shrink-0">
            <button
              onClick={() => {
                document.dispatchEvent(new CustomEvent("expand-all-sections"));
                requestAnimationFrame(() => document.dispatchEvent(new CustomEvent("expand-all-subsections")));
              }}
              title={t("header_expandAll")}
              className="p-1.5 hover:bg-gray-100 hover:text-gray-700 border-r border-gray-200 flex items-center"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 3.5L5 6.5 8 3.5"/>
              </svg>
            </button>
            <button
              onClick={() => document.dispatchEvent(new CustomEvent("collapse-all-sections"))}
              title={t("header_collapseAll")}
              className="p-1.5 hover:bg-gray-100 hover:text-gray-700 flex items-center"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 2L6.5 5 3.5 8"/>
              </svg>
            </button>
          </div>
        </>
      )}

      {/* Preview mode controls */}
      {view === "preview" && (
        <>
          {/* Section navigator icon */}
          <button onClick={() => setNavigatorOpen(!navigatorOpen)} title={t("header_sectionNavigator")}
            className={`p-1 rounded transition-colors flex-shrink-0 ${navigatorOpen ? "bg-primary/10 text-primary" : "text-gray-400 hover:text-gray-700"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z" clipRule="evenodd" />
            </svg>
          </button>

          <div className="flex items-center gap-1 flex-shrink-0">
            <input
              ref={previewSearchInputRef}
              type="text"
              value={previewSearchQuery}
              onChange={(e) => onPreviewSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onPreviewSearchChange("");
                if (e.key === "Enter") navigatePreview(e.shiftKey ? -1 : 1);
              }}
              placeholder={t("header_search")}
              className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary w-36"
            />
            {previewSearchQuery && (
              <span className="text-[10px] text-gray-400 whitespace-nowrap">
                {previewMatchCount === 0 ? t("header_noMatches") : `${previewMatchIdx + 1}/${previewMatchCount}`}
              </span>
            )}
            <button onClick={() => navigatePreview(-1)} disabled={previewMatchCount === 0} title={t("header_previous")}
              className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs px-0.5">↑</button>
            <button onClick={() => navigatePreview(1)} disabled={previewMatchCount === 0} title={t("header_next")}
              className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs px-0.5">↓</button>
            {previewSearchQuery && (
              <button onClick={() => onPreviewSearchChange("")}
                className="text-gray-400 hover:text-gray-700 text-xs px-0.5">✕</button>
            )}
          </div>
          {/* Expand / Collapse all for preview */}
          <div className="flex items-center rounded-md border border-gray-200 overflow-hidden text-gray-400 flex-shrink-0">
            <button
              onClick={() => {
                document.dispatchEvent(new CustomEvent("expand-all-sections"));
                requestAnimationFrame(() => document.dispatchEvent(new CustomEvent("expand-all-subsections")));
              }}
              title={t("header_expandAll")}
              className="p-1.5 hover:bg-gray-100 hover:text-gray-700 border-r border-gray-200 flex items-center"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 3.5L5 6.5 8 3.5"/>
              </svg>
            </button>
            <button
              onClick={() => document.dispatchEvent(new CustomEvent("collapse-all-sections"))}
              title={t("header_collapseAll")}
              className="p-1.5 hover:bg-gray-100 hover:text-gray-700 flex items-center"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 2L6.5 5 3.5 8"/>
              </svg>
            </button>
          </div>
        </>
      )}

      <div className="w-px h-5 bg-gray-200 flex-shrink-0" />

      {/* View pill switcher */}
      <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
        {(["editor", "preview", "pdf"] as const).map((v) => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className={`px-3 py-1 text-xs font-medium transition-colors border-r last:border-r-0 border-gray-200 ${
              view === v ? "bg-primary text-white" : "bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            }`}
          >
            {v === "editor" ? t("header_edit") : v === "preview" ? t("header_preview") : t("header_pdf")}
          </button>
        ))}
      </div>

      {/* Export dropdown */}
      <div ref={exportRef} className="relative flex-shrink-0">
        <button
          onClick={() => setExportOpen((o) => !o)}
          className="flex items-center gap-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded px-3 py-1 font-medium transition-colors"
        >
          {t("header_export")}
          <svg className="w-3 h-3" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {exportOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-44 text-xs">
            <button
              onClick={() => { onDownloadHtml(); setExportOpen(false); }}
              disabled={!hasId}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("header_downloadHtml")}
            </button>
            <button
              onClick={() => { handleDownloadJson(); setExportOpen(false); }}
              disabled={!hasId}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t("header_downloadJson")}
            </button>
            <div className="h-px bg-gray-100 my-1" />
            <button
              onClick={() => { onViewChange("pdf"); setExportOpen(false); }}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-red-600 hover:text-red-700"
            >
              {t("header_openPdf")}
            </button>
          </div>
        )}
      </div>

      {/* Autosave toggle + Save button */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Autosave toggle */}
        <button
          onClick={onAutosaveToggle}
          suppressHydrationWarning
          title={autosave ? t("header_autosaveOn") : t("header_autosaveOff")}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${
            autosave
              ? "border-emerald-300 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              : "border-gray-200 bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
            <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd" />
          </svg>
          {t("header_auto")}
        </button>

        {/* Save button — icon only */}
        <button
          onClick={onSave}
          disabled={isSaving || (!isDirty && !isNew)}
          title={
            isSaving ? t("header_saving") :
            isNew ? t("header_saveNew") :
            isDirty ? t("header_saveDirty") :
            lastSavedAt ? `Saved ${formatTime(lastSavedAt, t)}` : t("header_saveClean")
          }
          className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-all flex-shrink-0 ${
            isSaving
              ? "bg-[#2a5298]/70 text-white cursor-wait"
              : isNew || isDirty
              ? "bg-gradient-to-br from-[#1e3c72] to-[#2a5298] hover:opacity-90 text-white shadow-sm"
              : "bg-[#2a5298]/10 text-[#2a5298]/40 cursor-default"
          }`}
        >
          {isSaving ? (
            <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              {/* Floppy-disk save icon */}
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M3.5 2A1.5 1.5 0 002 3.5v13A1.5 1.5 0 003.5 18h13a1.5 1.5 0 001.5-1.5V6.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0012.378 1H3.5zM6 6.5A.5.5 0 016.5 6h7a.5.5 0 01.5.5v2a.5.5 0 01-.5.5h-7A.5.5 0 016 8.5v-2zM10 17a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
              {/* Dirty dot indicator */}
              {isDirty && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-yellow-300" />
              )}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function formatTime(date: Date, t: (k: TranslationKey) => string): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return t("header_justNow");
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
