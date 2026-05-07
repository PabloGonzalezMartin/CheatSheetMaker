import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "CheatSheet Maker",
  description: "Create and manage HTML cheatsheets",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-800">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
