"use client";
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { syntaxToHtml } from "@/lib/syntaxHighlight";
import type { CodeLine } from "@/types/cheatsheet";

interface Props {
  line: CodeLine;
  index: number;
  searchQuery?: string;
  accentColor?: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <button
      onClick={handleCopy}
      title="Copy"
      className="copy-btn"
      style={{
        flexShrink: 0,
        alignSelf: "flex-start",
        marginLeft: "6px",
        marginTop: "1px",
        width: "18px",
        height: "18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        background: "none",
        border: "none",
        borderRadius: "3px",
        cursor: "pointer",
        opacity: 0,
        transition: "opacity 0.15s",
        color: copied ? "#16a34a" : "#b0b8c5",
      }}
    >
      {copied ? (
        // Checkmark
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "11px", height: "11px" }}>
          <path d="M2 6.5l2.5 2.5 5.5-5.5" />
        </svg>
      ) : (
        // Clipboard icon
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: "11px", height: "11px" }}>
          <rect x="3.5" y="2" width="6" height="8" rx="1" />
          <path d="M3.5 3.5H2.5A.5.5 0 002 4v6.5a.5.5 0 00.5.5h6a.5.5 0 00.5-.5V10" />
        </svg>
      )}
    </button>
  );
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim() || !text) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} style={{ background: "rgba(255,213,0,0.8)", color: "inherit", borderRadius: "2px", padding: "0 1px" }}>{part}</mark>
      : part
  );
}

export function CodeLineDisplay({ line, index, searchQuery, accentColor = "#667eea" }: Props) {
  const hasMatch =
    searchQuery &&
    [line.command, line.comment, line.text].some((v) =>
      v && new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(v)
    );

  if (line.type === "text") {
    return (
      <div
        data-search-match={hasMatch ? "true" : undefined}
        style={{
          padding: "6px 10px",
          fontSize: "0.88rem",
          background: hasMatch ? "rgba(255, 213, 0, 0.12)" : `${accentColor}0d`,
          lineHeight: 1.5,
          color: "#2c3e50",
        }}
        className="renderer-text-line"
      >
        {hasMatch && searchQuery ? (
          <span>{highlight(line.text || "", searchQuery)}</span>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
            {line.text || ""}
          </ReactMarkdown>
        )}
      </div>
    );
  }

  const plainCommand = (line.command || "").replace(/\{(?:method|param|str):([^}]+)\}/g, "$1");
  const plainCommandForDisplay = plainCommand;

  return (
    <div
      data-search-match={hasMatch ? "true" : undefined}
      className="code-line-row"
      style={{
        display: "flex",
        alignItems: "flex-start",
        padding: "3px 10px",
        fontFamily: "'Courier New', monospace",
        fontSize: "0.82rem",
        margin: "1px 0",
        borderRadius: "4px",
        backgroundColor: hasMatch ? "rgba(255, 213, 0, 0.15)" : index % 2 === 0 ? "#f8f9fa" : "#ffffff",
      }}
    >
      {/* Command — plain text with highlights when searching, syntax-colored otherwise */}
      {hasMatch && searchQuery ? (
        <span style={{ color: "#2c3e50", fontWeight: 500, flex: 1, minWidth: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5 }}>
          {highlight(plainCommandForDisplay, searchQuery)}
        </span>
      ) : (
        <span
          dangerouslySetInnerHTML={{ __html: syntaxToHtml(line.command || "") }}
          style={{ color: "#2c3e50", fontWeight: 500, flex: 1, minWidth: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.5 }}
        />
      )}
      {/* Comment */}
      {line.comment && (
        <span style={{ color: "#6c757d", fontStyle: "italic", fontSize: "0.74rem", lineHeight: 1.5, paddingLeft: "14px", flexShrink: 0, maxWidth: "38%", wordBreak: "break-word", whiteSpace: "normal", textAlign: "right" }}>
          {searchQuery ? highlight(line.comment, searchQuery) : line.comment}
        </span>
      )}
      <CopyButton text={plainCommand} />
    </div>
  );
}
