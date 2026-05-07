"use client";
import { useEffect } from "react";
import { useEditorStore } from "@/store/editorStore";

interface Handlers {
  onSave?: () => void;
}

export function useKeyboardShortcuts({ onSave }: Handlers = {}) {
  const store = useEditorStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        onSave?.();
      }
      if (e.ctrlKey && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      }
      if (e.ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
        e.preventDefault();
        store.redo();
      }
      if (e.ctrlKey && e.key === "g") {
        e.preventDefault();
        store.setNavigatorOpen(!store.navigatorOpen);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [store, onSave]);
}
