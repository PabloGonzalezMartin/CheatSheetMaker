"use client";
import { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useCheatsheet } from "@/hooks/useCheatsheet";
import { useEditorStore } from "@/store/editorStore";
import { useRouter } from "next/navigation";
import type { CheatsheetData } from "@/types/cheatsheet";
import { useLanguage } from "@/lib/i18n";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = "paste" | "file";

export function ImportModal({ open, onClose }: Props) {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("paste");
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { saveCheatsheet } = useCheatsheet();
  const { loadCheatsheets } = useCheatsheet();
  const showNotification = useEditorStore((s) => s.showNotification);
  const setCurrentCheatsheet = useEditorStore((s) => s.setCurrentCheatsheet);

  const doImport = async (jsonStr: string) => {
    let data: CheatsheetData;
    try {
      data = JSON.parse(jsonStr);
    } catch {
      showNotification(t("modal_invalidJson"), "error");
      return;
    }
    if (!data.title || !Array.isArray(data.sections)) {
      showNotification(t("modal_invalidFormat"), "error");
      return;
    }
    // Remove id so it creates a new one
    delete data.id;
    // Add _uiIds
    data.sections = data.sections.map((s) => ({
      ...s,
      _uiId: crypto.randomUUID(),
      subsections: (s.subsections || []).map((sub) => ({ ...sub, _uiId: crypto.randomUUID() })),
    }));
    setLoading(true);
    try {
      setCurrentCheatsheet(data);
      await saveCheatsheet(data);
      await loadCheatsheets();
      showNotification(t("modal_importSuccess").replace("{title}", data.title), "success");
      onClose();
      router.push("/editor");
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : t("modal_importFailed"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = (e: React.FormEvent) => {
    e.preventDefault();
    doImport(pasteText.trim());
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    doImport(text);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("modal_import")}
      size="md"
    >
      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4 -mt-1">
        {(["paste", "file"] as Tab[]).map((tabOpt) => (
          <button
            key={tabOpt}
            onClick={() => setTab(tabOpt)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors capitalize ${
              tab === tabOpt
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >{tabOpt === "paste" ? t("modal_pasteJson") : t("modal_uploadFile")}</button>
        ))}
      </div>

      {tab === "paste" ? (
        <form onSubmit={handlePaste} className="space-y-3">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={t("modal_pasteHere")}
            rows={10}
            className="w-full text-xs font-mono border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
          <button
            type="submit"
            disabled={loading || !pasteText.trim()}
            className="w-full bg-gradient-primary text-white text-sm font-medium py-2 rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
          >{loading ? t("modal_importing") : t("modal_importBtn")}</button>
        </form>
      ) : (
        <div className="space-y-3">
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
          >
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFile}
            />
            <p className="text-sm text-gray-400">
              {loading ? t("modal_importing") : t("modal_dropFile")}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
