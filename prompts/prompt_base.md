# CheatSheet Maker — AI Generation Prompt

You are a technical documentation expert. Generate a cheatsheet in the exact JSON format described below.

---

## JSON Schema

```json
{
  "title": "string — name of the cheatsheet",
  "sections": [ ...Section ]
}
```

### Section
```json
{
  "title": "string — section heading",
  "description": "string (optional) — supports **markdown**, $LaTeX$ math inline, and `inline code`",
  "lines": [ ...CodeLine ],
  "subsections": [ ...Subsection ]
}
```

### Subsection
```json
{
  "title": "string — subsection heading",
  "lines": [ ...CodeLine ]
}
```

### CodeLine — two variants

**Code line** (for commands, code snippets):
```json
{
  "type": "code",
  "command": "string — the command, with optional syntax tags (see below)",
  "comment": "string (optional) — short annotation shown to the right"
}
```

**Text line** (for prose, notes, explanations, lists, math):
```json
{
  "type": "text",
  "text": "string — supports **bold**, *italic*, `inline code`, [links](url), $LaTeX$ inline, $$block LaTeX$$, and markdown lists"
}
```

Text lines are first-class content, not just footnotes. Use them to explain **why** something works, describe a concept, give a warning, or walk through a multi-step idea. A section can be entirely text lines if the topic is conceptual.

---

## Syntax tags for code lines

Inside `command` strings you can mark up parts of the command with these tags:

| Tag | Renders as | Use for |
|-----|-----------|---------|
| `{method:word}` | red | HTTP methods, keywords, operators |
| `{param:word}` | orange | Parameters, variables, flags |
| `{str:word}` | green | String values, file paths, names |

You may combine them freely. Example:
```
"git {method:commit} {param:-m} {str:'your message'}"
"curl {method:POST} {str:https://api.example.com} {param:-H} {str:'Content-Type: application/json'}"
"{method:SELECT} {param:*} {method:FROM} {str:users} {method:WHERE} {param:id} = {str:1}"
```

---

## LaTeX support

LaTeX can be used in `description` fields, `text` lines, and section `description` strings.

- Inline math: `$E = mc^2$`, `$O(n \log n)$`, `$\vec{F} = m\vec{a}$`
- Block math (centered, on its own line): `$$\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$`
- Use LaTeX whenever a concept has a natural mathematical expression — complexity, formulas, statistics, physics, etc.

Example text lines with LaTeX:
```json
{ "type": "text", "text": "Time complexity: $O(n^2)$ for naive, $O(n \\log n)$ with merge sort." }
{ "type": "text", "text": "$$P(A|B) = \\frac{P(B|A)\\,P(A)}{P(B)}$$" }
```

---

## Markdown in `description` and `text` lines

Supported:
- `**bold**`, `*italic*`, `~~strikethrough~~`
- `` `inline code` ``
- `[link text](url)`
- `- item` or `* item` for bullet lists
- `1. item` for numbered lists
- `$E = mc^2$` for inline LaTeX math
- `$$\int_0^\infty$$` for block LaTeX

---

## Rules

1. Always return **only** the raw JSON — no markdown fences, no explanation before or after.
2. Do not include `id`, `_uiId`, `created_at`, `updated_at` fields — they are generated automatically.
3. `images` arrays must always be present but should be empty: `[]`.
4. Every section must have at least one line in `lines`.
5. Use **2–4 subsections** per section when the section covers distinct sub-topics (e.g. "GET requests" and "POST requests" inside "HTTP"). Do not add subsections just to add structure — only when they genuinely separate different concerns. Avoid more than 4 subsections; split into a new top-level section instead.
6. Aim for **dense and practical** content — real commands or concepts a developer would look up.
7. Use `description` on sections to give a one-line context, tip, or formula. This is shown as a subtitle — make it informative, not generic.
8. Use **text lines** freely for explanations, concept definitions, warnings, lists of rules, or anything that is better read than run. A section on a conceptual topic (e.g. "How X works", "Key concepts") should consist mostly or entirely of text lines and should **not** be collapsed — it is meant to be read, not scanned.
9. Highlight the most important part of every command with `{method:...}` — the verb/action/keyword.
10. Use `{param:...}` for anything the user must replace or configure.
11. Use `{str:...}` for concrete string values, file names, or URLs that are examples.
12. For topics with mathematical foundations (algorithms, ML, statistics, physics, etc.), prefer LaTeX over plain-text notation.
13. **Explanatory sections** (concept overviews, theory, "how it works") should stand on their own as readable prose using text lines — mix in bullet lists, bold terms, and LaTeX as needed. Do not force code lines into a conceptual section.

---

## Section design guide

| Section type | Typical structure |
|---|---|
| Command reference | Mostly `code` lines, grouped into 2–3 subsections by operation type |
| Concept overview | Mostly `text` lines; use bullet lists and bold for key terms; LaTeX for formulas |
| Mixed | Lead with 1–2 `text` lines explaining the topic, then `code` lines or subsections |
| Math/theory | `description` holds the main formula; `text` lines walk through terms and implications |

Aim for **3–6 top-level sections**. Each section should feel self-contained — a reader should be able to jump to it and get value without reading the whole sheet.

---

## Minimal valid example

```json
{
  "title": "Example Cheatsheet",
  "group": "Demo",
  "sections": [
    {
      "title": "Basic Commands",
      "description": "Most common operations. Use **--help** for any command.",
      "images": [],
      "lines": [
        { "type": "code", "command": "{method:ls} {param:-la}", "comment": "list all files" },
        { "type": "code", "command": "{method:cd} {str:/path/to/dir}", "comment": "change directory" },
        { "type": "text", "text": "Use `sudo` prefix for admin commands. **Never run as root** in production." }
      ],
      "subsections": [
        {
          "title": "File operations",
          "images": [],
          "lines": [
            { "type": "code", "command": "{method:cp} {param:src} {str:dest}", "comment": "copy file" },
            { "type": "code", "command": "{method:mv} {param:src} {str:dest}", "comment": "move/rename" },
            { "type": "code", "command": "{method:rm} {param:-rf} {str:dir/}", "comment": "delete recursively" }
          ]
        },
        {
          "title": "Permissions",
          "images": [],
          "lines": [
            { "type": "code", "command": "{method:chmod} {param:755} {str:file}", "comment": "rwxr-xr-x" },
            { "type": "code", "command": "{method:chown} {param:user:group} {str:file}", "comment": "change owner" }
          ]
        }
      ]
    },
    {
      "title": "How Permissions Work",
      "description": "Unix permissions use a 3-bit octet for owner, group, and others.",
      "images": [],
      "lines": [
        { "type": "text", "text": "Each file has three permission sets: **owner**, **group**, and **others**." },
        { "type": "text", "text": "Each set is three bits: `r` (4), `w` (2), `x` (1). Add them: `chmod 755` = `rwxr-xr-x`." },
        { "type": "text", "text": "- `4` = read\n- `2` = write\n- `1` = execute\n- `0` = no permission" },
        { "type": "text", "text": "Permission value: $P = 4r + 2w + x$ for each group." }
      ],
      "subsections": []
    },
    {
      "title": "Math note",
      "description": "Euler's identity: $e^{i\\pi} + 1 = 0$",
      "images": [],
      "lines": [
        { "type": "text", "text": "The **Pythagorean theorem**: $a^2 + b^2 = c^2$" }
      ],
      "subsections": []
    }
  ]
}
```

---

Now generate a cheatsheet for: **[REPLACE WITH YOUR TOPIC]**
