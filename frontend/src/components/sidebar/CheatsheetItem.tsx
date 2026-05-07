"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import type { CheatsheetListItem, CheatsheetData } from "@/types/cheatsheet";
import { useCheatsheet } from "@/hooks/useCheatsheet";
import { useEditorStore } from "@/store/editorStore";
import { api, getAccessToken } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";

interface Props {
  item: CheatsheetListItem;
  onMoveToGroup: (id: string) => void;
  onToggleShare: (id: string) => void;
  onPreview: (id: string) => void;
}

export function CheatsheetItem({ item, onMoveToGroup, onToggleShare, onPreview }: Props) {
  const router = useRouter();
  const { deleteCheatsheet, loadCheatsheets } = useCheatsheet();
  const showNotification = useEditorStore((s) => s.showNotification);
  const { t } = useLanguage();
  const [isDragOver, setIsDragOver] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleDelete = async () => {
    setMenuOpen(false);
    if (!confirm(t("item_deleteConfirm").replace("{title}", item.title || t("item_untitled")))) return;
    try {
      await deleteCheatsheet(item.id);
      showNotification(t("item_deleted"), "success");
    } catch {
      showNotification(t("item_deleteFailed"), "error");
    }
  };

  const tokenParam = () => `?token=${getAccessToken()}`;

  const menuActions = [
    {
      icon: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
          <path d="M11 2l3 3-8 8H3v-3L11 2z" />
        </svg>
      ),
      label: t("item_edit"),
      onClick: () => router.push(`/editor/${item.id}`),
    },
    {
      icon: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
          <path d="M13.5 8c0 0-2.5 4.5-5.5 4.5S2.5 8 2.5 8 5 3.5 8 3.5 13.5 8 13.5 8z" />
          <circle cx="8" cy="8" r="1.5" />
        </svg>
      ),
      label: t("item_share"),
      onClick: () => navigator.clipboard.writeText(`${window.location.origin}/shared/${item.id}`).then(() => showNotification(t("item_linkCopied"), "success")),
    },
    {
      icon: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
          <path d="M4 12h8M8 3v7M5 7l3 3 3-3" />
        </svg>
      ),
      label: t("item_downloadHtml"),
      onClick: () => window.open(`/api/export/html/${item.id}${tokenParam()}&download=1`),
    },
    {
      icon: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
          <rect x="3" y="2" width="10" height="12" rx="1" />
          <path d="M5 5h6M5 8h6M5 11h3" />
        </svg>
      ),
      label: t("item_downloadJson"),
      onClick: () => window.open(`/download-json/${item.id}${tokenParam()}`),
    },
    {
      icon: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
          <rect x="2" y="3" width="12" height="9" rx="1" />
          <path d="M5 14h6" />
        </svg>
      ),
      label: t("item_moveToGroup"),
      onClick: () => onMoveToGroup(item.id),
    },
    {
      icon: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5 text-red-400">
          <path d="M3 4h10M6 4V3h4v1M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4" />
        </svg>
      ),
      label: t("item_delete"),
      onClick: handleDelete,
      danger: true,
    },
  ];

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    const btn = menuBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 4, left: rect.left });
    setMenuOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("cheatsheetId", item.id);
    e.dataTransfer.setData("cheatsheetGroup", item.group || "");
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("sectionjson")) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    const json = e.dataTransfer.getData("sectionjson");
    if (!json) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    try {
      const section = JSON.parse(json);
      const target = await api.get<CheatsheetData>(`/api/cheatsheet/${item.id}`);
      const updatedSections = [
        ...(target.sections || []),
        { ...section, _uiId: crypto.randomUUID() },
      ];
      await api.post("/api/cheatsheet", { ...target, sections: updatedSections.map(({ _uiId, ...s }: { _uiId?: string, [key: string]: unknown }) => ({
        ...s,
        subsections: ((s.subsections as Array<{ _uiId?: string, [key: string]: unknown }>) || []).map(({ _uiId: _sid, ...sub }) => sub),
      })) });
      await loadCheatsheets();
      showNotification(t("item_sectionAdded").replace("{title}", item.title || t("item_untitled")), "success");
    } catch {
      showNotification(t("item_sectionAddFailed"), "error");
    }
  };

  return (
    <>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors cursor-grab active:cursor-grabbing ${
          isDragOver ? "bg-white/25 ring-1 ring-white/40" : "hover:bg-white/10"
        }`}
      >
        {/* Title */}
        <span
          className="flex-1 text-xs text-white/90 truncate cursor-pointer"
          title={item.title}
          onClick={() => router.push(`/editor/${item.id}`)}
        >
          {item.title || t("item_untitled")}
        </span>

        {/* Action buttons — visible on hover */}
        <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
          {/* Eye — preview only */}
          <button
            title={t("item_preview")}
            onClick={(e) => { e.stopPropagation(); onPreview(item.id); }}
            className="w-6 h-6 flex items-center justify-center rounded text-white/60 hover:text-white hover:bg-white/20 transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3.5 h-3.5">
              <path d="M13.5 8c0 0-2.5 4.5-5.5 4.5S2.5 8 2.5 8 5 3.5 8 3.5 13.5 8 13.5 8z" />
              <circle cx="8" cy="8" r="1.5" />
            </svg>
          </button>

          {/* Three dots — opens dropdown menu */}
          <button
            ref={menuBtnRef}
            title={t("item_moreOptions")}
            onClick={openMenu}
            className="w-6 h-6 flex items-center justify-center rounded text-white/60 hover:text-white hover:bg-white/20 transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <circle cx="4" cy="8" r="1.2" />
              <circle cx="8" cy="8" r="1.2" />
              <circle cx="12" cy="8" r="1.2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Dropdown menu via portal */}
      {menuOpen && createPortal(
        <div
          ref={menuRef}
          style={{ position: "fixed", top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
          className="bg-white rounded-lg shadow-xl border border-gray-100 py-1 min-w-[160px]"
        >
          {menuActions.map((a) => (
            <button
              key={a.label}
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false); a.onClick(); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors ${
                a.danger
                  ? "text-red-500 hover:bg-red-50"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className={a.danger ? "text-red-400" : "text-gray-400"}>{a.icon}</span>
              {a.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}
