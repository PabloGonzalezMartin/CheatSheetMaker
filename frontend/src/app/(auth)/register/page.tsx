"use client";
import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/i18n";

export default function RegisterPage() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirm_password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form.username, form.email, form.password, form.confirm_password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-dark p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logoCheatSheetMaker.svg" alt="CheatSheet Maker" className="w-44 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">{t("auth_createAccount")}</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth_username")}</label>
            <input
              type="text"
              value={form.username}
              onChange={set("username")}
              required
              minLength={3}
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth_email")}</label>
            <input
              type="email"
              value={form.email}
              onChange={set("email")}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth_password")}</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={form.password}
                onChange={set("password")}
                required
                minLength={6}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs"
              >
                {showPw ? t("auth_hidePassword") : t("auth_showPassword")}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth_confirmPassword")}</label>
            <input
              type={showPw ? "text" : "password"}
              value={form.confirm_password}
              onChange={set("confirm_password")}
              required
              minLength={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-primary text-white py-2 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {loading ? t("auth_creating") : t("auth_createBtn")}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          {t("auth_haveAccount")}{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            {t("auth_signInBtn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
