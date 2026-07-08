"use client";
import { useState } from "react";
import type { CheatsheetListItem, Group } from "@/types/cheatsheet";
import { CheatsheetItem } from "./CheatsheetItem";
import { useGroups } from "@/hooks/useGroups";
import { useCheatsheet } from "@/hooks/useCheatsheet";
import { useEditorStore } from "@/store/editorStore";
import { useLanguage } from "@/lib/i18n";

interface Props {
  group: Group;
  items: CheatsheetListItem[];
  onMoveToGroup: (id: string) => void;
  onToggleShare: (id: string) => void;
  onPreview: (id: string) => void;
  onNewInGroup: (groupId: string) => void;
}

export function GroupSection({ group, items, onMoveToGroup, onToggleShare, onPreview, onNewInGroup }: Props) {
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const { deleteGroup } = useGroups();
  const { moveToGroup, loadCheatsheets } = useCheatsheet();
  const showNotification = useEditorStore((s) => s.showNotification);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t("sidebar_deleteGroupConfirm").replace("{name}", group.name))) return;
    try {
      await deleteGroup(group.id);
      showNotification(t("sidebar_groupDeleted"), "success");
    } catch {
      showNotification(t("sidebar_groupDeleteFailed"), "error");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    const types = e.dataTransfer.types;
    if (types.includes("sectionjson")) { e.preventDefault(); return; } // let CheatsheetItem handle it
    if (!types.includes("cheatsheetid")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("sectionjson")) return; // let CheatsheetItem handle it
    e.preventDefault();
    setIsDragOver(false);
    const cheatsheetId = e.dataTransfer.getData("cheatsheetId");
    const currentGroup = e.dataTransfer.getData("cheatsheetGroup");
    if (!cheatsheetId || currentGroup === group.id) return;
    try {
      await moveToGroup(cheatsheetId, group.id);
      await loadCheatsheets();
    } catch {
      showNotification(t("sidebar_moveFailed"), "error");
    }
  };

  return (
    <div
      className={`mb-1 rounded-lg transition-colors ${isDragOver ? "ring-1 ring-white/40 bg-white/10" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/10 cursor-pointer group"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: group.color }}
        />
        <span className="flex-1 text-xs font-medium text-white/90 truncate">{group.name}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onNewInGroup(group.id); }}
          className="hidden group-hover:flex w-7 h-7 items-center justify-center text-white/50 hover:text-white text-sm font-bold leading-none"
          title={`${t("sidebar_newInGroup")} "${group.name}"`}
        >
          +
        </button>
        <button
          onClick={handleDelete}
          className="hidden group-hover:flex w-4 h-4 items-center justify-center text-white/50 hover:text-red-300 text-xs"
          title={t("sidebar_deleteGroup")}
        >
          🗑
        </button>
        <span className={`text-white/50 text-xs transition-transform ${collapsed ? "-rotate-90" : ""}`}>▼</span>
      </div>
      {!collapsed && (
        <div className="ml-2">
          {items.map((item) => (
            <CheatsheetItem key={item.id} item={item} onMoveToGroup={onMoveToGroup} onToggleShare={onToggleShare} onPreview={onPreview} />
          ))}
          {items.length === 0 && (
            <p className={`text-xs px-2 py-1 ${isDragOver ? "text-white/60" : "text-white/30"}`}>
              {isDragOver ? t("sidebar_dropHere") : t("sidebar_emptyGroup")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
