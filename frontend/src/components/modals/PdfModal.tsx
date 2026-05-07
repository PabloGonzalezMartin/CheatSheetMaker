"use client";
import { useEffect, useState } from "react";
import { PDFViewer } from "@react-pdf/renderer";
import { CheatsheetPdf } from "@/components/pdf/CheatsheetPdf";
import type { CheatsheetData, CodeLine } from "@/types/cheatsheet";
import { withImageToken } from "@/lib/api";

interface Props {
  data: CheatsheetData;
  open: boolean;
  onClose: () => void;
  minimal?: boolean;
}

function collectImageSrcs(data: CheatsheetData): string[] {
  const srcs = new Set<string>();
  const scanLines = (lines: CodeLine[]) => {
    for (const line of lines) {
      if (line.type === "image" && line.src) srcs.add(line.src);
    }
  };
  for (const section of data.sections ?? []) {
    scanLines(section.lines ?? []);
    for (const sub of section.subsections ?? []) scanLines(sub.lines ?? []);
  }
  return Array.from(srcs);
}

async function fetchAsBase64(src: string): Promise<string> {
  const url = withImageToken(src);
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function PdfModal({ data, open, onClose, minimal = false }: Props) {
  const [resolvedSrcs, setResolvedSrcs] = useState<Record<string, string>>({});

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const srcs = collectImageSrcs(data);
    if (srcs.length === 0) { setResolvedSrcs({}); return; }
    Promise.all(srcs.map(async (src) => {
      try { return [src, await fetchAsBase64(src)] as const; }
      catch { return [src, withImageToken(src)] as const; }
    })).then((pairs) => setResolvedSrcs(Object.fromEntries(pairs)));
  }, [open, data]);

  if (!open) return null;

  if (minimal) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col">
        <div className="flex-shrink-0 h-8 bg-gray-900 flex items-center justify-end px-3">
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
            title="Close (Esc)"
          >
            &times;
          </button>
        </div>
        <div className="flex-1">
          <PDFViewer width="100%" height="100%" showToolbar={true}>
            <CheatsheetPdf data={data} resolvedSrcs={resolvedSrcs} />
          </PDFViewer>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="flex-shrink-0 bg-gradient-to-r from-[#1e3c72] to-[#2a5298] flex items-center gap-3 px-4 py-2">
        <span className="text-white font-semibold text-sm truncate">PDF — {data.title || "Untitled"}</span>
        <div className="flex-1" />
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white text-2xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
        >
          &times;
        </button>
      </div>
      <div className="flex-1">
        <PDFViewer width="100%" height="100%" showToolbar={true}>
          <CheatsheetPdf data={data} resolvedSrcs={resolvedSrcs} />
        </PDFViewer>
      </div>
    </div>
  );
}
