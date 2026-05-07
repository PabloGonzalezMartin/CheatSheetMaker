"use client";
import { useCallback } from "react";
import { api } from "@/lib/api";
import { useEditorStore } from "@/store/editorStore";
import type { Group } from "@/types/cheatsheet";

export function useGroups() {
  const store = useEditorStore();

  const loadGroups = useCallback(async () => {
    const groups = await api.get<Group[]>("/api/groups");
    store.setGroups(groups);
    return groups;
  }, [store]);

  const createGroup = useCallback(
    async (name: string, color: string) => {
      const res = await api.post<{ success: boolean; group: Group }>("/api/groups", { name, color });
      await loadGroups();
      return res.group;
    },
    [loadGroups]
  );

  const deleteGroup = useCallback(
    async (id: string) => {
      await api.delete(`/api/groups/${id}`);
      await loadGroups();
    },
    [loadGroups]
  );

  return { loadGroups, createGroup, deleteGroup };
}
