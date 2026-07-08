"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEditorStore } from "@/store/editorStore";
import { useCheatsheet } from "@/hooks/useCheatsheet";
import { useGroups } from "@/hooks/useGroups";
import { useAuth } from "@/hooks/useAuth";
import { CheatsheetList } from "./CheatsheetList";
import { CreateGroupModal } from "@/components/modals/CreateGroupModal";
import { MoveToGroupModal } from "@/components/modals/MoveToGroupModal";
import { ImportModal } from "@/components/modals/ImportModal";
import { PreviewReactModal } from "@/components/modals/PreviewReactModal";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import type { CheatsheetData } from "@/types/cheatsheet";
import { useLanguage, type Lang } from "@/lib/i18n";

const PdfModal = dynamic(() => import("@/components/modals/PdfModal").then((m) => m.PdfModal), { ssr: false });

export function Sidebar() {
  const router = useRouter();
  const { logout } = useAuth();
  const { loadCheatsheets } = useCheatsheet();
  const { loadGroups } = useGroups();
  const collapsed = useEditorStore((s) => s.sidebarCollapsed);
  const setCollapsed = useEditorStore((s) => s.setSidebarCollapsed);
  const setCurrentCheatsheet = useEditorStore((s) => s.setCurrentCheatsheet);
  const { t, lang, setLang } = useLanguage();

  const [sidebarWidth, setSidebarWidth] = useState(288);
  const isResizing = useRef(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [previewData, setPreviewData] = useState<CheatsheetData | null>(null);
  const [pdfData, setPdfData] = useState<CheatsheetData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSettings) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSettings]);

  const handlePreview = async (id: string) => {
    try {
      const data = await api.get<CheatsheetData>(`/api/cheatsheet/${id}`);
      data.sections = (data.sections || []).map((s) => ({
        ...s,
        _uiId: crypto.randomUUID(),
        subsections: (s.subsections || []).map((sub) => ({ ...sub, _uiId: crypto.randomUUID() })),
      }));
      setPreviewData(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved === "true") setCollapsed(true);
  }, [setCollapsed]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      setSidebarWidth(Math.max(180, Math.min(520, ev.clientX)));
    };
    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleToggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebarCollapsed", String(next));
  };

  const handleNewCheatsheet = (groupId?: string) => {
    setCurrentCheatsheet({
      title: "",
      group: groupId ?? "",
      sections: [{
        _uiId: crypto.randomUUID(),
        title: "",
        description: "",
        images: [],
        lines: [],
        subsections: [],
      }],
    });
    router.push("/editor");
  };

  return (
    <>
      <div
        className="flex flex-col bg-gradient-to-b from-[#1e3c72] to-[#2a5298] flex-shrink-0 relative"
        style={{
          width: collapsed ? 48 : sidebarWidth,
          minHeight: "100vh",
          transition: isResizing.current ? "none" : "width 0.3s ease",
        }}
      >
        {/* Header */}
        <div
          onClick={handleToggle}
          className="flex items-center justify-center px-3 py-3 border-b border-white/10 flex-shrink-0 cursor-pointer hover:bg-white/5 transition-colors"
          title={collapsed ? t("sidebar_expandSidebar") : t("sidebar_collapseSidebar")}
        >
          <img
            src="/logoCheatSheetMaker.svg"
            alt="CheatSheet Maker"
            className={`object-contain transition-all duration-300 ${collapsed ? "w-7" : "w-16"}`}
          />
        </div>

        {!collapsed && (
          <>
            {/* Action buttons */}
            <div className="px-2 py-2 flex gap-2 flex-shrink-0">
              <button
                onClick={() => handleNewCheatsheet()}
                className="flex-1 bg-white/15 hover:bg-white/25 text-white text-xs py-1.5 rounded-lg font-medium transition-colors"
              >
                {t("sidebar_new")}
              </button>
              <button
                onClick={() => setShowImport(true)}
                className="flex-1 bg-white/15 hover:bg-white/25 text-white text-xs py-1.5 rounded-lg font-medium transition-colors"
              >
                {t("sidebar_import")}
              </button>
            </div>

            {/* Groups header */}
            <div className="flex items-center justify-between px-2 py-1 flex-shrink-0">
              <span className="text-[11px] text-white/40 uppercase tracking-wider">{t("sidebar_groups")}</span>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="text-white/60 w-6 h-6 hover:text-white text-md"
                title={t("sidebar_newGroup")}
              >
                +
              </button>
            </div>

            {/* Cheatsheet list */}
            <CheatsheetList
              onMoveToGroup={(id) => setMoveTargetId(id)}
              onToggleShare={() => {}}
              onPreview={handlePreview}
              onNewInGroup={(groupId) => handleNewCheatsheet(groupId)}
            />

            {/* Live preview panel */}

            {/* User bar */}
            <div className="flex-shrink-0 border-t border-white/10 px-3 py-2 flex items-center justify-between relative" ref={settingsRef}>
              <span className="text-white/60 text-xs truncate">{t("sidebar_signedIn")}</span>
              <button
                onClick={() => setShowSettings((v) => !v)}
                className="gear-btn text-white/60 hover:text-white p-0.5 rounded transition-colors"
                title={t("settings_openSettings")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </button>

              {showSettings && (
                <div className="absolute bottom-full right-0 mb-1 w-44 rounded-lg shadow-xl border border-blue-200/60 overflow-hidden z-50" style={{ background: "linear-gradient(135deg, #e8f0fe 0%, #f0f6ff 100%)" }}>
                  <div className="px-3 py-2 border-b border-blue-200/50">
                    <p className="text-[10px] text-blue-400 uppercase tracking-wider mb-1.5">{t("settings_language")}</p>
                    <div className="flex gap-1.5">
                      {(["en", "es"] as Lang[]).map((l) => (
                        <button
                          key={l}
                          onClick={() => setLang(l)}
                          className={`flex-1 py-1 rounded text-xs font-semibold transition-colors ${lang === l ? "bg-blue-600 text-white" : "text-blue-400 hover:text-blue-700 hover:bg-blue-100"}`}
                        >
                          {t(l === "en" ? "settings_english" : "settings_spanish")}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowSettings(false); logout(); }}
                    className="w-full text-left px-3 py-2 text-xs text-blue-500 hover:text-blue-700 hover:bg-blue-100 transition-colors"
                  >
                    {t("sidebar_logout")}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Resize handle — right edge, only when expanded */}
        {!collapsed && (
          <div
            onMouseDown={handleResizeStart}
            title={t("sidebar_dragResize")}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: "5px",
              cursor: "col-resize",
              zIndex: 30,
            }}
            className="hover:bg-white/20 active:bg-white/30 transition-colors"
          />
        )}
      </div>

      <CreateGroupModal open={showCreateGroup} onClose={() => setShowCreateGroup(false)} />
      <MoveToGroupModal
        open={moveTargetId !== null}
        cheatsheetId={moveTargetId || ""}
        onClose={() => setMoveTargetId(null)}
      />
      <ImportModal open={showImport} onClose={() => setShowImport(false)} />
      {previewData && (
        <PreviewReactModal
          data={previewData}
          onClose={() => setPreviewData(null)}
          onOpenPdf={() => { setPdfData(previewData); setPreviewData(null); }}
        />
      )}
      {pdfData && (
        <PdfModal
          data={pdfData}
          open={true}
          onClose={() => setPdfData(null)}
          minimal={true}
        />
      )}
    </>
  );
}
