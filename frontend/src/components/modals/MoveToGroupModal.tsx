"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useCheatsheet } from "@/hooks/useCheatsheet";
import { useEditorStore } from "@/store/editorStore";
import { useLanguage } from "@/lib/i18n";

interface Props {
  open: boolean;
  cheatsheetId: string;
  onClose: () => void;
}

export function MoveToGroupModal({ open, cheatsheetId, onClose }: Props) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const groups = useEditorStore((s) => s.groups);
  const { moveToGroup, loadCheatsheets } = useCheatsheet();
  const showNotification = useEditorStore((s) => s.showNotification);

  const handleMove = async (groupId: string) => {
    setLoading(true);
    try {
      await moveToGroup(cheatsheetId, groupId);
      await loadCheatsheets();
      showNotification(t("modal_movedToGroup"), "success");
      onClose();
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : t("modal_moveFailed"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("modal_moveToGroup")} size="sm">
      <div className="space-y-1.5">
        <button
          disabled={loading}
          onClick={() => handleMove("")}
          className="w-full text-left text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center gap-2 transition-colors"
        >
          <span className="w-3 h-3 rounded-full bg-gray-300 flex-shrink-0" />
          {t("modal_noGroup")}
        </button>
        {groups.map((g) => (
          <button
            key={g.id}
            disabled={loading}
            onClick={() => handleMove(g.id)}
            className="w-full text-left text-sm px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center gap-2 transition-colors"
          >
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: g.color || "#667eea" }}
            />
            {g.name}
          </button>
        ))}
        {groups.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">{t("modal_noGroups")}</p>
        )}
      </div>
    </Modal>
  );
}
