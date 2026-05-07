"use client";
import { useCallback } from "react";
import { api, setAccessToken } from "@/lib/api";
import { useEditorStore } from "@/store/editorStore";
import { useRouter } from "next/navigation";

export function useAuth() {
  const setToken = useEditorStore((s) => s.setAccessToken);
  const showNotification = useEditorStore((s) => s.showNotification);
  const router = useRouter();

  const login = useCallback(
    async (username: string, password: string) => {
      const data = await api.post<{ access_token: string }>("/auth/login", { username, password });
      setAccessToken(data.access_token);
      setToken(data.access_token);
      router.push("/editor");
    },
    [setToken, router]
  );

  const register = useCallback(
    async (username: string, email: string, password: string, confirm_password: string) => {
      const data = await api.post<{ access_token: string }>("/auth/register", {
        username,
        email,
        password,
        confirm_password,
      });
      setAccessToken(data.access_token);
      setToken(data.access_token);
      router.push("/editor");
    },
    [setToken, router]
  );

  const logout = useCallback(async () => {
    await api.post("/auth/logout").catch(() => {});
    setAccessToken(null);
    setToken(null);
    router.push("/login");
  }, [setToken, router]);

  const initAuth = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/auth/refresh", { method: "POST", credentials: "include" });
      if (!res.ok) return false;
      const data = await res.json();
      setAccessToken(data.access_token);
      setToken(data.access_token);
      return true;
    } catch {
      return false;
    }
  }, [setToken]);

  return { login, register, logout, initAuth };
}
