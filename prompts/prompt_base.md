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
  "description": "string (optional) — supports **markdown** and $LaTeX$ math inline",
  "images": [],
  "lines": [ ...CodeLine ],
  "subsections": [ ...Subsection ]
}
```

### Subsection
```json
{
  "title": "string — subsection heading",
  "images": [],
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

**Text line** (for prose, notes, lists):
```json
{
  "type": "text",
  "text": "string — supports **bold**, *italic*, `inline code`, [links](url), $LaTeX$, and markdown lists"
}
```

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
5. Use `subsections` to group related commands within a section (e.g. "GET requests" and "POST requests" inside a "HTTP" section).
6. Aim for **dense and practical** content — real commands a developer would look up.
7. Use `description` on sections to give a one-line context or tip, especially when the section covers a nuanced topic.
8. Use **text lines** for explanations, notes, warnings, or lists of concepts; use **code lines** for everything runnable or copyable.
9. Highlight the most important part of every command with `{method:...}` — the verb/action/keyword.
10. Use `{param:...}` for anything the user must replace or configure.
11. Use `{str:...}` for concrete string values, file names, or URLs that are examples.

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
        }
      ]
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
