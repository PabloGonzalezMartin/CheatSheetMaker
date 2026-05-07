export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { ExportRenderer } from "@/components/renderer/ExportRenderer";
import { EXPORT_CSS, EXPORT_JS } from "@/components/renderer/exportAssets";
import type { CheatsheetData } from "@/types/cheatsheet";

const BACKEND = process.env.BACKEND_URL || "http://localhost:8000";

async function fetchPublicCheatsheet(id: string): Promise<CheatsheetData> {
  const res = await fetch(`${BACKEND}/api/cheatsheet/public/${id}`);
  if (!res.ok) throw new Error("Not found");
  return res.json();
}

async function imageToBase64(src: string): Promise<string> {
  if (!src.startsWith("/images/")) return src;
  try {
    const res = await fetch(`${BACKEND}${src}`);
    if (!res.ok) return src;
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${Buffer.from(buffer).toString("base64")}`;
  } catch {
    return src;
  }
}

function collectImageSrcs(data: CheatsheetData): string[] {
  const srcs = new Set<string>();
  for (const section of data.sections) {
    for (const line of section.lines ?? []) {
      if (line.type === "image" && line.src) srcs.add(line.src);
    }
    for (const sub of section.subsections ?? []) {
      for (const line of sub.lines ?? []) {
        if (line.type === "image" && line.src) srcs.add(line.src);
      }
    }
  }
  return Array.from(srcs);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  let data: CheatsheetData;
  try {
    data = await fetchPublicCheatsheet(params.id);
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const srcs = collectImageSrcs(data);
  const resolvedSrcs: Record<string, string> = {};
  await Promise.all(
    srcs.map(async (src) => {
      resolvedSrcs[src] = await imageToBase64(src);
    })
  );

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { renderToStaticMarkup } = require("react-dom/server") as typeof import("react-dom/server");
  const bodyHtml = renderToStaticMarkup(
    React.createElement(ExportRenderer, { data, resolvedSrcs })
  );

  const safeTitle = data.title?.replace(/[<>"']/g, "") || "Cheatsheet";
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>${EXPORT_CSS}</style>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
</head>
<body>${bodyHtml}<script>${EXPORT_JS}</script></body>
</html>`;

  return new NextResponse(fullHtml, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
