"use client";
import { useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useCheatsheet } from "@/hooks/useCheatsheet";
import { GroupSection } from "./GroupSection";
import { CheatsheetItem } from "./CheatsheetItem";
import { useLanguage } from "@/lib/i18n";

interface Props {
  onMoveToGroup: (id: string) => void;
  onToggleShare: (id: string) => void;
  onPreview: (id: string) => void;
  onNewInGroup: (groupId: string) => void;
}

export function CheatsheetList({ onMoveToGroup, onToggleShare, onPreview, onNewInGroup }: Props) {
  const { t } = useLanguage();
  const cheatsheets = useEditorStore((s) => s.cheatsheets);
  const groups = useEditorStore((s) => s.groups);
  const showNotification = useEditorStore((s) => s.showNotification);
  const { moveToGroup, loadCheatsheets } = useCheatsheet();

  const [isDragOver, setIsDragOver] = useState(false);

  const ungrouped = cheatsheets.filter((c) => !c.group);

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
    if (!cheatsheetId || currentGroup === "") return;
    try {
      await moveToGroup(cheatsheetId, "");
      await loadCheatsheets();
    } catch {
      showNotification(t("sidebar_moveFailed"), "error");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
      {groups.map((group) => {
        const items = cheatsheets.filter((c) => c.group === group.id);
        return (
          <GroupSection
            key={group.id}
            group={group}
            items={items}
            onMoveToGroup={onMoveToGroup}
            onToggleShare={onToggleShare}
            onPreview={onPreview}
            onNewInGroup={onNewInGroup}
          />
        );
      })}

      {/* Ungrouped drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-lg transition-colors ${isDragOver ? "ring-1 ring-white/40 bg-white/10" : ""}`}
      >
        {groups.length > 0 && (ungrouped.length > 0 || isDragOver) && (
          <p className={`text-[11px] uppercase tracking-wider px-2 pt-2 pb-1 ${isDragOver ? "text-white/60" : "text-white/40"}`}>
            {isDragOver ? t("sidebar_dropToUngroup") : t("sidebar_ungrouped")}
          </p>
        )}
        {ungrouped.map((item) => (
          <CheatsheetItem key={item.id} item={item} onMoveToGroup={onMoveToGroup} onToggleShare={onToggleShare} onPreview={onPreview} />
        ))}
        {isDragOver && ungrouped.length === 0 && (
          <p className="text-xs text-white/50 px-2 py-1">{t("sidebar_dropHereUngroup")}</p>
        )}
      </div>

      {cheatsheets.length === 0 && (
        <p className="text-xs text-white/30 text-center py-8">{t("sidebar_noCheatsheets")}</p>
      )}
    </div>
  );
}
