"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useCheatsheet } from "@/hooks/useCheatsheet";
import { useAuth } from "@/hooks/useAuth";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useGroups } from "@/hooks/useGroups";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { EditorHeader } from "./EditorHeader";
import { SectionList } from "./SectionList";
import { SectionNavigator } from "./SectionNavigator";
import { ImportJsonModal } from "@/components/modals/ImportJsonModal";
import { CheatsheetRenderer } from "@/components/renderer/CheatsheetRenderer";
import { getAccessToken } from "@/lib/api";
import { NotificationContainer } from "@/components/ui/Notification";
import type { Section } from "@/types/cheatsheet";
import { useLanguage } from "@/lib/i18n";

function PdfLoadingFallback() {
  const { t } = useLanguage();
  return <div className="h-full flex items-center justify-center bg-gray-100"><span className="text-gray-400 text-sm">{t("editor_loadingPdf")}</span></div>;
}

const PdfViewerPanel = dynamic(
  () => import("@/components/pdf/PdfViewerPanel").then((m) => m.PdfViewerPanel),
  { ssr: false, loading: () => <PdfLoadingFallback /> }
);

type ViewMode = "editor" | "preview" | "pdf";

interface Props {
  cheatsheetId?: string;
}

export function EditorPage({ cheatsheetId }: Props) {
  const { initAuth } = useAuth();
  const { loadCheatsheet, saveCheatsheet, loadCheatsheets } = useCheatsheet();
  const { loadGroups } = useGroups();
  const { t } = useLanguage();

  const currentCheatsheet = useEditorStore((s) => s.currentCheatsheet);
  const updateCurrentCheatsheet = useEditorStore((s) => s.updateCurrentCheatsheet);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const showNotification = useEditorStore((s) => s.showNotification);

  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [view, setView] = useState<ViewMode>("editor");
  const [previewSearchQuery, setPreviewSearchQuery] = useState("");
  const [showImportSection, setShowImportSection] = useState(false);
  const [autosave, setAutosave] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("autosave") === "true";
  });
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const savedJson = useRef<string>("");
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorScrollRef = useRef<HTMLElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  // { sectionIndex, offsetFromSectionTop } — captured before switching views
  const pendingScroll = useRef<{ idx: number; offset: number } | null>(null);

  // Init auth + load data
  useEffect(() => {
    initAuth().then((ok) => {
      if (!ok) { window.location.href = "/login"; return; }
      loadCheatsheets();
      loadGroups();
      if (cheatsheetId) {
        loadCheatsheet(cheatsheetId).catch(() => {
          showNotification(t("editor_errorLoad"), "error");
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cheatsheetId]);

  // Track dirty state
  useEffect(() => {
    const json = JSON.stringify(currentCheatsheet);
    if (savedJson.current === "") {
      savedJson.current = json;
      return;
    }
    setIsDirty(json !== savedJson.current);
  }, [currentCheatsheet]);

  const handleSectionChange = useCallback(
    (sections: Section[]) => {
      pushHistory(currentCheatsheet);
      updateCurrentCheatsheet({ sections });
    },
    [currentCheatsheet, pushHistory, updateCurrentCheatsheet]
  );

  const addSection = () => {
    pushHistory(currentCheatsheet);
    updateCurrentCheatsheet({
      sections: [
        ...currentCheatsheet.sections,
        {
          _uiId: crypto.randomUUID(),
          title: "",
          description: "",
          images: [],
          lines: [],
          subsections: [],
        },
      ],
    });
  };

  const handleSave = useCallback(async () => {
    if (!currentCheatsheet.title.trim()) {
      showNotification(t("editor_errorTitle"), "error");
      return;
    }
    setIsSaving(true);
    try {
      await saveCheatsheet(currentCheatsheet);
      savedJson.current = JSON.stringify(currentCheatsheet);
      setIsDirty(false);
      setLastSavedAt(new Date());
    } catch (e: unknown) {
      showNotification(e instanceof Error ? e.message : t("editor_errorSave"), "error");
    } finally {
      setIsSaving(false);
    }
  }, [currentCheatsheet, saveCheatsheet, showNotification]);

  // Autosave: debounce 3s after any dirty change, only for existing cheatsheets
  useEffect(() => {
    if (!autosave || !isDirty || !currentCheatsheet.id || isSaving) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { handleSave(); }, 3000);
    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  }, [autosave, isDirty, currentCheatsheet.id, isSaving, handleSave]);

  const handleAutosaveToggle = useCallback(() => {
    setAutosave((prev) => {
      const next = !prev;
      localStorage.setItem("autosave", String(next));
      return next;
    });
  }, []);

  const handleDownloadHtml = useCallback(() => {
    if (!currentCheatsheet.id) return;
    const token = getAccessToken();
    const url = `/api/export/html/${currentCheatsheet.id}?token=${token}&download=1`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentCheatsheet.title || "cheatsheet"}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [currentCheatsheet.id, currentCheatsheet.title]);

  // Capture the section closest to the top of the container, and how far from the container top it is
  const captureScroll = (container: HTMLElement) => {
    const blocks = container.querySelectorAll("[data-section-block]");
    const containerTop = container.getBoundingClientRect().top;
    let best = 0;
    let bestTop = 0;
    let bestDist = Infinity;
    blocks.forEach((el, i) => {
      const elTop = el.getBoundingClientRect().top - containerTop;
      // prefer the section whose top is closest to (but not too far below) the container top
      const dist = Math.abs(elTop);
      if (dist < bestDist) { bestDist = dist; best = i; bestTop = elTop; }
    });
    pendingScroll.current = { idx: best, offset: bestTop };
  };

  const handleViewChange = (next: ViewMode) => {
    if (next === view) return;
    if (next === "preview" && editorScrollRef.current) captureScroll(editorScrollRef.current);
    else if (next === "editor" && previewScrollRef.current) captureScroll(previewScrollRef.current);
    setView(next);
  };

  // After view change, restore scroll so the same section appears at the same visual offset
  useEffect(() => {
    if (pendingScroll.current === null) return;
    const { idx, offset } = pendingScroll.current;
    pendingScroll.current = null;
    const container = view === "preview" ? previewScrollRef.current : editorScrollRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      const blocks = container.querySelectorAll("[data-section-block]");
      const target = blocks[idx] as HTMLElement | undefined;
      if (!target) return;
      // scrollTop = section's offsetTop minus the offset it should appear at from container top
      const containerScrollTop = container.scrollTop;
      const sectionOffsetInContainer = target.getBoundingClientRect().top - container.getBoundingClientRect().top + containerScrollTop;
      container.scrollTop = sectionOffsetInContainer - offset;
    });
  }, [view]);

  useKeyboardShortcuts({ onSave: handleSave });

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <EditorHeader
          onSave={handleSave}
          onDownloadHtml={handleDownloadHtml}
          isSaving={isSaving}
          isDirty={isDirty}
          hasId={!!currentCheatsheet.id}
          view={view}
          onViewChange={handleViewChange}
          previewSearchQuery={previewSearchQuery}
          onPreviewSearchChange={setPreviewSearchQuery}
          autosave={autosave}
          onAutosaveToggle={handleAutosaveToggle}
          lastSavedAt={lastSavedAt}
        />

        <main
          ref={(el) => { editorScrollRef.current = el; }}
          className={`flex-1 min-h-0 ${view === "editor" ? "overflow-y-auto px-4 py-4 w-full" : "overflow-hidden"}`}
        >
          {view === "editor" && (
            <>
              <SectionList
                sections={currentCheatsheet.sections}
                cheatsheetId={currentCheatsheet.id}
                onChange={handleSectionChange}
              />
              <div className="mt-4 flex gap-2">
                <button
                  onClick={addSection}
                  className="flex-1 border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:text-primary hover:border-primary transition-colors"
                >
                  {t("editor_addSection")}
                </button>
                <button
                  onClick={() => setShowImportSection(true)}
                  className="flex-1 border-2 border-dashed border-gray-200 rounded-xl py-3 text-sm text-gray-400 hover:text-blue-500 hover:border-blue-400 transition-colors"
                >
                  {t("editor_importSection")}
                </button>
              </div>
            </>
          )}

          {view === "preview" && (
            <div ref={previewScrollRef} className="h-full overflow-y-auto bg-[#f0f2f5]">
              <CheatsheetRenderer
                data={currentCheatsheet}
                multiColumn={false}
                searchQuery={previewSearchQuery}
              />
            </div>
          )}

          {view === "pdf" && (
            <div className="h-full">
              <PdfViewerPanel data={currentCheatsheet} />
            </div>
          )}
        </main>
      </div>

      {(view === "editor" || view === "preview") && <SectionNavigator />}
      <NotificationContainer />

      <ImportJsonModal
        mode="section"
        open={showImportSection}
        onClose={() => setShowImportSection(false)}
        onImport={(section) => {
          pushHistory(currentCheatsheet);
          updateCurrentCheatsheet({ sections: [...currentCheatsheet.sections, section] });
        }}
      />
    </div>
  );
}
