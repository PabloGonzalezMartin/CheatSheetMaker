export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

const SCRIPT = path.join(process.cwd(), "scripts", "latex-render.js");

function runScript(payload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SCRIPT], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => { out += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { err += d.toString(); });
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`latex-render script exited ${code}: ${err}`));
      else resolve(out);
    });
    child.on("error", reject);
    child.stdin.write(payload);
    child.stdin.end();
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { exprs: Array<{ expr: string; display: boolean }> };
    const raw = await runScript(JSON.stringify(body));
    return NextResponse.json(JSON.parse(raw));
  } catch (e) {
    console.error("[latex-render]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
