"use client";
import { useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import { CheatsheetRenderer } from "@/components/renderer/CheatsheetRenderer";
import { useLanguage } from "@/lib/i18n";

const RENDER_W = 1200;
const PANEL_W = 256;
const SCALE = PANEL_W / RENDER_W;
const RENDER_H = 1600;
const PANEL_H = Math.round(RENDER_H * SCALE);

export function LivePreviewPanel() {
  const cheatsheet = useEditorStore((s) => s.currentCheatsheet);
  const { t } = useLanguage();
  const [open, setOpen] = useState(true);

  return (
    <div className="flex-shrink-0 border-t border-white/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <span className="text-[10px] text-white/50 uppercase tracking-wider font-medium">{t("livepreview_title")}</span>
        <span className="text-white/40 text-[10px]">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="px-2 pb-2">
          <div
            className="overflow-hidden rounded border border-white/10 bg-white"
            style={{ width: `${PANEL_W}px`, height: `${PANEL_H}px` }}
          >
            <div
              style={{
                width: `${RENDER_W}px`,
                height: `${RENDER_H}px`,
                transform: `scale(${SCALE})`,
                transformOrigin: "top left",
                pointerEvents: "none",
              }}
            >
              <CheatsheetRenderer data={cheatsheet} multiColumn={false} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
