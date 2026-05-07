"use client";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useGroups } from "@/hooks/useGroups";
import { useEditorStore } from "@/store/editorStore";
import { useLanguage } from "@/lib/i18n";

const COLORS = [
  "#667eea", "#764ba2", "#f093fb", "#f5576c",
  "#4facfe", "#00f2fe", "#43e97b", "#38f9d7",
  "#fa709a", "#fee140", "#a18cd1", "#fbc2eb",
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CreateGroupModal({ open, onClose }: Props) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);
  const { createGroup } = useGroups();
  const showNotification = useEditorStore((s) => s.showNotification);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createGroup(name.trim(), color);
      showNotification(t("modal_groupCreated"), "success");
      setName("");
      setColor(COLORS[0]);
      onClose();
    } catch (err: unknown) {
      showNotification(err instanceof Error ? err.message : t("modal_groupFailed"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("modal_createGroup")}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded border border-gray-200"
          >{t("modal_cancel")}</button>
          <button
            form="create-group-form"
            type="submit"
            disabled={loading || !name.trim()}
            className="text-xs bg-gradient-primary text-white px-4 py-1.5 rounded font-medium disabled:opacity-50"
          >{loading ? t("modal_creating") : t("modal_create")}</button>
        </>
      }
    >
      <form id="create-group-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">{t("modal_groupName")}</label>
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("modal_groupNamePlaceholder")}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">{t("modal_groupColor")}</label>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-6 h-6 rounded-full transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  outline: color === c ? `3px solid ${c}` : "none",
                  outlineOffset: "2px",
                }}
              />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
