"use client";
import { create } from "zustand";
import type { CheatsheetData, CheatsheetListItem, Group } from "@/types/cheatsheet";

interface Notification {
  id: string;
  message: string;
  type: "success" | "error";
}

interface EditorStore {
  // Auth
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;

  // Cheatsheet list
  cheatsheets: CheatsheetListItem[];
  setCheatsheets: (list: CheatsheetListItem[]) => void;

  // Groups
  groups: Group[];
  setGroups: (groups: Group[]) => void;

  // Current editor state
  currentCheatsheet: CheatsheetData;
  setCurrentCheatsheet: (data: CheatsheetData) => void;
  updateCurrentCheatsheet: (partial: Partial<CheatsheetData>) => void;

  // Undo/redo
  historyStack: CheatsheetData[];
  redoStack: CheatsheetData[];
  pushHistory: (state: CheatsheetData) => void;
  undo: () => void;
  redo: () => void;

  // UI state
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  navigatorOpen: boolean;
  setNavigatorOpen: (v: boolean) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Collapse sync between editor and preview
  expandedSections: Set<string>;
  expandedSubsections: Set<string>;
  setSectionExpanded: (id: string, expanded: boolean) => void;
  setSubsectionExpanded: (id: string, expanded: boolean) => void;

  // Notifications
  notifications: Notification[];
  showNotification: (message: string, type: "success" | "error") => void;
  removeNotification: (id: string) => void;
}

const EMPTY_CHEATSHEET: CheatsheetData = {
  title: "",
  group: "",
  sections: [
    {
      _uiId: crypto.randomUUID(),
      title: "",
      description: "",
      images: [],
      lines: [],
      subsections: [],
    },
  ],
};

const MAX_HISTORY = 50;

export const useEditorStore = create<EditorStore>((set, get) => ({
  accessToken: null,
  setAccessToken: (token) => set({ accessToken: token }),

  cheatsheets: [],
  setCheatsheets: (list) => set({ cheatsheets: list }),

  groups: [],
  setGroups: (groups) => set({ groups }),

  currentCheatsheet: EMPTY_CHEATSHEET,
  setCurrentCheatsheet: (data) => set({ currentCheatsheet: data, historyStack: [], redoStack: [] }),
  updateCurrentCheatsheet: (partial) =>
    set((s) => ({ currentCheatsheet: { ...s.currentCheatsheet, ...partial } })),

  historyStack: [],
  redoStack: [],
  pushHistory: (state) =>
    set((s) => {
      const last = s.historyStack[s.historyStack.length - 1];
      if (last && JSON.stringify(last) === JSON.stringify(state)) return {};
      const newStack = [...s.historyStack, state].slice(-MAX_HISTORY);
      return { historyStack: newStack, redoStack: [] };
    }),
  undo: () =>
    set((s) => {
      if (s.historyStack.length === 0) return {};
      const prev = s.historyStack[s.historyStack.length - 1];
      return {
        historyStack: s.historyStack.slice(0, -1),
        redoStack: [s.currentCheatsheet, ...s.redoStack],
        currentCheatsheet: prev,
      };
    }),
  redo: () =>
    set((s) => {
      if (s.redoStack.length === 0) return {};
      const next = s.redoStack[0];
      return {
        redoStack: s.redoStack.slice(1),
        historyStack: [...s.historyStack, s.currentCheatsheet],
        currentCheatsheet: next,
      };
    }),

  sidebarCollapsed: false,
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  navigatorOpen: false,
  setNavigatorOpen: (v) => set({ navigatorOpen: v }),
  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),

  expandedSections: new Set<string>(),
  expandedSubsections: new Set<string>(),
  setSectionExpanded: (id, expanded) =>
    set((s) => {
      const next = new Set(s.expandedSections);
      expanded ? next.add(id) : next.delete(id);
      return { expandedSections: next };
    }),
  setSubsectionExpanded: (id, expanded) =>
    set((s) => {
      const next = new Set(s.expandedSubsections);
      expanded ? next.add(id) : next.delete(id);
      return { expandedSubsections: next };
    }),

  notifications: [],
  showNotification: (message, type) => {
    const id = crypto.randomUUID();
    set((s) => ({ notifications: [...s.notifications, { id, message, type }] }));
    setTimeout(() => get().removeNotification(id), 3500);
  },
  removeNotification: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
}));
