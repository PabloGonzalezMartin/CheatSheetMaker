"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { getAccessToken } from "@/lib/api";
import { CheatsheetRenderer } from "@/components/renderer/CheatsheetRenderer";
import type { CheatsheetData } from "@/types/cheatsheet";
import { useLanguage } from "@/lib/i18n";

interface Props {
  data: CheatsheetData;
  onClose: () => void;
  onOpenPdf?: () => void;
}

export function PreviewReactModal({ data, onClose, onOpenPdf }: Props) {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [matchIdx, setMatchIdx] = useState(0);
  const matchIdxRef = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Count matches in the rendered React DOM
  const countMatches = useCallback(() => {
    if (!bodyRef.current) return 0;
    return bodyRef.current.querySelectorAll("[data-search-match='true']").length;
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      const count = countMatches();
      setMatchCount(count);
      setMatchIdx(0);
      matchIdxRef.current = 0;
      if (count > 0) {
        const els = bodyRef.current?.querySelectorAll("[data-search-match='true']");
        els?.[0]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 80);
    return () => clearTimeout(id);
  }, [query, countMatches]);

  const navigate = useCallback((dir: 1 | -1) => {
    if (!bodyRef.current) return;
    const els = Array.from(bodyRef.current.querySelectorAll("[data-search-match='true']"));
    if (!els.length) return;
    const next = ((matchIdxRef.current + dir) + els.length) % els.length;
    matchIdxRef.current = next;
    setMatchIdx(next);
    els[next].scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const handleDownloadHtml = () => {
    if (!data.id) return;
    const token = getAccessToken();
    window.open(`/api/export/html/${data.id}?token=${token}&download=1`, "_blank");
  };

  const handleDownloadJson = () => {
    if (!data.id) return;
    const token = getAccessToken();
    window.open(`/download-json/${data.id}?token=${token}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
      {/* Toolbar */}
      <div
        className="flex-shrink-0 bg-gradient-to-r from-[#1e3c72] to-[#2a5298] flex items-center gap-2 px-4 py-2"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-white font-semibold text-sm">{t("preview_title")}</span>

        {/* Search bar */}
        <div className="flex items-center gap-1 ml-3 bg-white/10 rounded px-2 py-0.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white/50 flex-shrink-0">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") navigate(e.shiftKey ? -1 : 1); }}
            placeholder={t("preview_search")}
            className="bg-transparent text-white text-xs placeholder-white/40 focus:outline-none w-36"
          />
          {query && (
            <span className="text-[10px] text-white/50 whitespace-nowrap">
              {matchCount === 0 ? t("preview_noMatches") : `${matchIdx + 1}/${matchCount}`}
            </span>
          )}
        </div>
        {query && (
          <>
            <button onClick={() => navigate(-1)} disabled={matchCount === 0} title="Previous"
              className="text-white/70 hover:text-white disabled:opacity-30 text-xs">↑</button>
            <button onClick={() => navigate(1)} disabled={matchCount === 0} title="Next"
              className="text-white/70 hover:text-white disabled:opacity-30 text-xs">↓</button>
          </>
        )}

        <div className="flex-1" />

        {/* Expand / Collapse all sections */}
        <div className="flex items-center rounded border border-white/20 overflow-hidden flex-shrink-0">
          <button
            onClick={() => {
              document.dispatchEvent(new CustomEvent("expand-all-sections"));
              // Fire after a tick so newly-mounted subsections are in the DOM
              requestAnimationFrame(() =>
                document.dispatchEvent(new CustomEvent("expand-all-subsections"))
              );
            }}
            title={t("preview_expandAll")}
            className="px-2 py-1 text-white/60 hover:text-white hover:bg-white/10 border-r border-white/20 text-xs"
          >▾▾</button>
          <button
            onClick={() => document.dispatchEvent(new CustomEvent("collapse-all-sections"))}
            title={t("preview_collapseAll")}
            className="px-2 py-1 text-white/60 hover:text-white hover:bg-white/10 text-xs"
          >▸▸</button>
        </div>

        {onOpenPdf && (
          <button onClick={onOpenPdf}
            className="text-white/80 hover:text-white text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded transition-colors">
            {t("preview_pdf")}
          </button>
        )}
        {data.id && (
          <>
            <button onClick={handleDownloadHtml}
              className="text-white/80 hover:text-white text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded transition-colors">
              {t("preview_downloadHtml")}
            </button>
            <button onClick={handleDownloadJson}
              className="text-white/80 hover:text-white text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded transition-colors">
              {t("preview_downloadJson")}
            </button>
          </>
        )}
        <button onClick={onClose} className="text-white/80 hover:text-white text-xl leading-none ml-2">&times;</button>
      </div>

      {/* Content */}
      <div
        ref={bodyRef}
        className="flex-1 overflow-y-auto bg-[#f0f2f5]"
        onClick={(e) => e.stopPropagation()}
      >
        <CheatsheetRenderer data={data} multiColumn={false} searchQuery={query} />
      </div>
    </div>
  );
}
