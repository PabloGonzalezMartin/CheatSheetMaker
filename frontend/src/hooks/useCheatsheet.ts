"use client";
import { useCallback } from "react";
import { api } from "@/lib/api";
import { useEditorStore } from "@/store/editorStore";
import type { CheatsheetData, CheatsheetListItem, CodeLine, ImageData } from "@/types/cheatsheet";

export function useCheatsheet() {
  const store = useEditorStore();

  const loadCheatsheets = useCallback(async () => {
    const list = await api.get<CheatsheetListItem[]>("/api/cheatsheets");
    store.setCheatsheets(list);
    return list;
  }, [store]);

  const loadCheatsheet = useCallback(
    async (id: string) => {
      const data = await api.get<CheatsheetData>(`/api/cheatsheet/${id}`);
      data.sections = (data.sections || []).map((s) => ({
        ...s,
        _uiId: crypto.randomUUID(),
        lines: normalizeLines(s.lines, s.images),
        images: [],
        subsections: (s.subsections || []).map((sub) => ({
          ...sub,
          _uiId: crypto.randomUUID(),
          lines: normalizeLines(sub.lines, sub.images),
          images: [],
        })),
      }));
      store.setCurrentCheatsheet(data);
      return data;
    },
    [store]
  );

  const saveCheatsheet = useCallback(
    async (data: CheatsheetData) => {
      // Strip _uiId before sending
      const clean = stripUiIds(data);
      const res = await api.post<{ success: boolean; id: string }>("/api/cheatsheet", clean);
      if (res.success) {
        store.updateCurrentCheatsheet({ id: res.id });
        await loadCheatsheets();
      }
      return res;
    },
    [store, loadCheatsheets]
  );

  const deleteCheatsheet = useCallback(
    async (id: string) => {
      await api.delete(`/api/cheatsheet/${id}`);
      await loadCheatsheets();
    },
    [loadCheatsheets]
  );

  const toggleShare = useCallback(async (id: string) => {
    return api.put<{ success: boolean; is_public: boolean; share_url: string | null }>(
      `/api/cheatsheet/${id}/share`
    );
  }, []);

  const moveToGroup = useCallback(async (id: string, groupId: string) => {
    return api.put(`/api/cheatsheet/${id}/group`, { group: groupId });
  }, []);

  return { loadCheatsheets, loadCheatsheet, saveCheatsheet, deleteCheatsheet, toggleShare, moveToGroup };
}

// Ensures every line has a type, and migrates legacy images[] to line-level image entries
function normalizeLines(lines: CodeLine[] | undefined, images: ImageData[] | undefined): CodeLine[] {
  const normalized: CodeLine[] = (lines || []).map((l) => ({
    ...l,
    type: l.type ?? "code",
  }));
  // Append legacy images that aren't already in lines
  for (const img of images || []) {
    if (img.src && !normalized.some((l) => l.type === "image" && l.src === img.src)) {
      normalized.push({ type: "image", src: img.src, widthPercent: img.widthPercent ?? 100 });
    }
  }
  return normalized;
}

function stripUiIds(data: CheatsheetData): CheatsheetData {
  return {
    ...data,
    sections: data.sections.map(({ _uiId, ...s }) => ({
      ...s,
      subsections: (s.subsections || []).map(({ _uiId, ...sub }) => sub),
    })),
  };
}
