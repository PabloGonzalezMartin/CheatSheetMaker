<p align="center">
  <img src="frontend/public/logoCheatSheetMaker.svg" alt="CheatSheetMaker logo" width="180" />
</p>

<h1 align="center">CheatSheetMaker</h1>

<p align="center">
  A full-stack web application for creating, editing, and sharing beautiful cheatsheets.<br/>
  WYSIWYG editor · Live preview · Print-to-PDF · LaTeX · Self-contained HTML export
</p>

<p align="center">
  <a href="https://www.linkedin.com/in/pablo-gonz%C3%A1lez-mart%C3%ADn-a026112a6/" target="_blank">
    <img src="https://img.shields.io/badge/LinkedIn-Pablo%20González%20Martín-0077b5?style=flat&logo=linkedin&logoColor=white" alt="LinkedIn" />
  </a>
  <img src="https://img.shields.io/badge/license-CC%20BY--NC--SA%204.0-lightgrey?style=flat" alt="CC BY-NC-SA 4.0 license" />
  <img src="https://img.shields.io/badge/stack-Next.js%20%7C%20FastAPI%20%7C%20PostgreSQL-informational?style=flat" alt="Stack" />
</p>

---


## Features

- **WYSIWYG Editor** — Edit directly in the final visual layout with collapsible section and subsection cards
- **Three-mode view** — Switch between Edit, Preview, and PDF without losing scroll position or expand/collapse state
- **Synchronized state** — Sections expanded in the editor stay expanded in preview, and vice versa
- **Exact scroll sync** — Switching modes lands you at the same visual position you were looking at
- **Autosave** — Optional debounced autosave (3 s after last change) with a live "last saved" indicator
- **Syntax highlighting** — Custom syntax tokens for commands: `{method:name}`, `{param:name}`, `{str:text}`
- **Markdown & LaTeX** — Text lines and section descriptions render Markdown and math via KaTeX
- **Inline images** — Upload images, place them anywhere between lines, resize with a hover slider, zoom with a lightbox
- **PDF Export** — Inline browser print engine with configurable subsection columns (1 / 2 / 3); KaTeX math renders perfectly in the print output
- **HTML Export** — Fully self-contained HTML file rendered server-side from the same React components as Preview — pixel-identical output, no build step required to open
- **Public sharing** — Share a read-only link with anyone, no login required
- **Groups** — Organise cheatsheets into color-coded folders in the sidebar
- **Section navigator** — Quick-jump panel (available in both Edit and Preview modes)
- **Drag & drop** — Reorder sections, subsections, and lines within and between cards
- **Search** — Full-text search with inline highlighting, match counter, and keyboard navigation (↑ ↓ Enter); works in both Edit and Preview
- **Undo / Redo** — Full history stack (Ctrl+Z / Ctrl+Y)

---

## Tech Stack

### Frontend

| Layer | Technology | Details |
|---|---|---|
| Framework | [Next.js 14](https://nextjs.org/) + [React 18](https://react.dev/) | App Router, SSR, dynamic imports |
| Language | TypeScript 5 | Strict mode throughout |
| Styling | [Tailwind CSS 3](https://tailwindcss.com/) | Utility-first; `@tailwindcss/typography` for prose |
| State | [Zustand 4](https://github.com/pmndrs/zustand) | Editor state, undo/redo history (50 steps), collapse sync, auth tokens |
| Drag & drop | Native HTML5 drag events | Reorder sections, subsections, and lines within and between cards |

### Rendering pipeline

| What | How |
|---|---|
| **Live preview** | `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` — full GFM + inline/display LaTeX |
| **Math (preview)** | [KaTeX](https://katex.org/) via `rehype-katex` — client-side, zero-flash |
| **Syntax tokens** | Custom regex tokeniser — `{method:x}` → red, `{param:x}` → orange, `{str:x}` → green |
| **PDF preview** | Inline `<iframe>` — cheatsheet built as a full HTML page and written via `doc.write()` |
| **Math (PDF)** | [KaTeX auto-render](https://katex.org/docs/autorender.html) loaded from CDN inside the iframe; fires before print |
| **PDF download** | Browser print engine (`window.print()` on the iframe) — pixel-perfect, no canvas tricks |
| **Image embedding** | All `<img>` srcs pre-fetched and inlined as base64 data URIs before iframe write — no repeated requests |
| **HTML export** | `ReactDOM.renderToStaticMarkup` of the same `ExportRenderer` component tree as Preview; CDN KaTeX + marked.js; fully self-contained |

### Backend

| Layer | Technology | Details |
|---|---|---|
| Framework | [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12) | Auto-docs, async-ready, pydantic validation |
| Server | [Uvicorn](https://www.uvicorn.org/) | ASGI with standard extras |
| ORM | [SQLAlchemy 2](https://docs.sqlalchemy.org/) | Declarative mapped columns, relationship cascade |
| Database | [PostgreSQL 16](https://www.postgresql.org/) | JSON column for cheatsheet data; SQLite fallback for local dev |
| Migrations | [Alembic](https://alembic.sqlalchemy.org/) | Schema versioning |
| Auth | python-jose (JWT HS256) | Short-lived access token + HTTP-only refresh cookie |
| Passwords | Werkzeug `generate_password_hash` | bcrypt |
| File uploads | python-multipart | Images stored as `LargeBinary` blobs in the DB; served with cache headers |
| Text processing | latex2mathml, mistune | Server-side LaTeX→MathML and Markdown for HTML export route |
| Config | pydantic-settings | All config from environment variables |

### Infrastructure

| | |
|---|---|
| Containers | Docker (multi-stage builds for frontend and backend) |
| Orchestration | Docker Compose — PostgreSQL, backend, frontend wired together |
| Dev shortcut | `start.ps1` — Windows PowerShell script that starts the DB container and both dev servers |

---

## Quick Start (Docker)

The easiest way to run CheatSheetMaker. Docker handles everything — no Python or Node.js installation required on your machine.

### Prerequisites

You only need two things installed:

- **Docker Desktop** — [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
- **Git** — [https://git-scm.com/downloads](https://git-scm.com/downloads)

Verify they are installed before continuing:

```bash
docker --version
# Docker version 25.x.x or higher

docker compose version
# Docker Compose version v2.x.x or higher

git --version
# git version 2.x.x
```

---

### Step 1 — Clone the repository

```bash
git clone https://github.com/PabloGonzalezMartin/CheetSheetMaker.git
cd CheetSheetMaker
```

---

### Step 2 — Create the environment file

Copy the example file:

```bash
# macOS / Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

Open `.env` in any text editor and fill in your values. Here is a complete example with explanations:

```env
# Unique name for this instance — used as prefix for Docker container names
INSTANCE_NAME=cheatsheetmaker

# Ports — change these if you run multiple instances on the same machine
DB_PORT=5432
BACKEND_PORT=8000
FRONTEND_PORT=3000

# PostgreSQL credentials — used by the database container and the backend
POSTGRES_USER=cheatsheetmaker
POSTGRES_PASSWORD=MyStr0ngP@ssword        # <-- change this
POSTGRES_DB=cheatsheetmakerdb

# Full database connection string — must match the three values above exactly
DATABASE_URL=postgresql://cheatsheetmaker:MyStr0ngP@ssword@db:5432/cheatsheetmakerdb
#                                                            ^^
#                          NOTE: inside Docker the host is "db", not "localhost"

# JWT signing secret — generate a random one with the command below
SECRET_KEY=replace_with_output_of_openssl_rand_hex_32

# Token expiry (these defaults are fine for most cases)
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Allowed CORS origins — keep this as-is for local use
CORS_ORIGINS=http://localhost:3000
```

**Generate a secure SECRET_KEY:**

```bash
# macOS / Linux / WSL
openssl rand -hex 32

# Windows PowerShell (no OpenSSL needed)
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
```

Copy the output and paste it as the value of `SECRET_KEY` in your `.env`.

> **Important:** The `DATABASE_URL` host must be `db` (not `localhost`) when running with Docker Compose, because `db` is the name of the database service inside the Docker network.

---

### Step 3 — Build and start all services

```bash
docker compose up --build
```

This will:
1. Build the backend image (Python + FastAPI)
2. Build the frontend image (Next.js — this takes 1–3 minutes the first time)
3. Start PostgreSQL, the backend on port 8000, and the frontend on port 3000

Once you see `ready - started server on 0.0.0.0:3000`, open [http://localhost:3000](http://localhost:3000), register an account, and start creating.

On subsequent runs (no code changes) use:

```bash
docker compose up
```

To stop all services:

```bash
docker compose down
```

---

## Local Development (Windows — without Docker for the app)

This method runs the backend and frontend directly on your machine using a PowerShell script. Docker is still used for the PostgreSQL database only.

### Prerequisites

You need the following tools installed. Run each check command to verify:

**Python 3.10 or higher**

```powershell
python --version
# Python 3.12.x  ✓
```

If not installed: [https://www.python.org/downloads/](https://www.python.org/downloads/)
During installation, check **"Add Python to PATH"**.

**Node.js 18 or higher** (includes npm)

```powershell
node --version
# v20.x.x  ✓

npm --version
# 10.x.x  ✓
```

If not installed: [https://nodejs.org/](https://nodejs.org/) — download the LTS version.

**Docker Desktop** (for the database)

```powershell
docker --version
# Docker version 25.x.x  ✓
```

**Git**

```powershell
git --version
# git version 2.x.x  ✓
```

---

### Step 1 — Clone the repository

```powershell
git clone https://github.com/PabloGonzalezMartin/CheetSheetMaker.git
cd CheetSheetMaker
```

---

### Step 2 — Create the environment file

```powershell
Copy-Item .env.example .env
```

Open `.env` and fill in your values. For local development use `localhost` as the database host:

```env
# Unique name for this instance — used as prefix for Docker container names
INSTANCE_NAME=cheatsheetmaker

# Ports — change if running multiple instances on the same machine
DB_PORT=5432
BACKEND_PORT=8000
FRONTEND_PORT=3000

POSTGRES_USER=cheatsheetmaker
POSTGRES_PASSWORD=MyStr0ngP@ssword
POSTGRES_DB=cheatsheetmakerdb

# NOTE: host is "localhost" here (not "db") because you are connecting from outside Docker
DATABASE_URL=postgresql://cheatsheetmaker:MyStr0ngP@ssword@localhost:5432/cheatsheetmakerdb

SECRET_KEY=replace_with_a_random_hex_string

ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

CORS_ORIGINS=http://localhost:3000

# Backend URL used by Next.js API routes
BACKEND_URL=http://localhost:8000
```

Generate the `SECRET_KEY`:

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
```

---

### Step 3 — Run the start script

The script does everything automatically:

- Creates a Python virtual environment at `backend\venv` if one does not exist
- Installs all Python dependencies from `backend\requirements.txt`
- Starts the PostgreSQL container and waits for it to be healthy
- Starts the backend (uvicorn) using the venv Python
- Runs `npm install` if `node_modules` is missing or incomplete
- Starts the frontend (Next.js dev server)

```powershell
.\start.ps1
```

If PowerShell blocks the script with an execution policy error, run this first:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
```

Then run `.\start.ps1` again.

Once running:

| Service | URL |
|---|---|
| Frontend | [http://localhost:3000](http://localhost:3000) |
| Backend API | [http://localhost:8000](http://localhost:8000) |
| API docs (Swagger) | [http://localhost:8000/docs](http://localhost:8000/docs) |

Press **Ctrl+C** in the terminal to stop all services cleanly.

---

### Manual setup (without the script)

If you prefer to run each service manually:

**Database**

```powershell
docker compose up -d db
```

**Backend**

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend** (in a separate terminal)

```powershell
cd frontend
npm install
npm run dev
```

---

## Project Structure

```
CheatSheetMaker/
├── backend/
│   ├── app/
│   │   ├── auth/              # JWT auth (register, login, refresh)
│   │   ├── routers/           # API routes (cheatsheets, groups, images, export)
│   │   ├── config.py          # Settings from environment variables
│   │   ├── database.py        # SQLAlchemy setup (PostgreSQL / SQLite)
│   │   ├── models.py          # ORM models (User, Cheatsheet, Group, Image)
│   │   ├── text_processing.py # Markdown + LaTeX server-side rendering
│   │   └── main.py            # FastAPI entry point
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/export/html/        # Next.js route: HTML export (authenticated)
│   │   │   └── api/export/html/shared/ # Next.js route: HTML export (public)
│   │   ├── components/
│   │   │   ├── editor/        # WYSIWYG editor (section cards, line rows, header, navigator)
│   │   │   ├── modals/        # Import JSON modal, PDF modal
│   │   │   ├── pdf/           # PDF generation (CheatsheetPdf, PdfSectionBlock, PdfViewerPanel)
│   │   │   ├── renderer/      # Read-only renderer shared by Preview and HTML export
│   │   │   │   ├── CheatsheetRenderer.tsx   # Live preview component
│   │   │   │   ├── SectionBlock.tsx         # Collapsible section
│   │   │   │   ├── SubsectionBlock.tsx      # Collapsible subsection
│   │   │   │   ├── CodeLineDisplay.tsx      # Code / text / image line
│   │   │   │   ├── ExportRenderer.tsx       # Static SSR component for HTML export
│   │   │   │   ├── exportAssets.ts          # CSS + JS injected into the HTML export
│   │   │   │   └── sectionColors.ts         # Section color palette
│   │   │   ├── sidebar/       # Sidebar, group list, cheatsheet list
│   │   │   └── ui/            # Notifications
│   │   ├── hooks/             # useCheatsheet, useAuth, useGroups, useKeyboardShortcuts
│   │   ├── lib/               # API client, syntaxHighlight, searchHighlight
│   │   ├── store/             # Zustand store (auth, editor state, collapse sync, history)
│   │   └── types/             # TypeScript types (CheatsheetData, Section, CodeLine…)
│   ├── Dockerfile
│   └── next.config.mjs
├── prompts/                   # Example JSON configs and AI prompt template
├── docker-compose.yml
├── .env.example
└── start.ps1                  # Windows dev launcher
```

---

## View Modes

| Mode | Description |
|---|---|
| **Edit** | WYSIWYG editor with collapsible section/subsection cards, inline line editing, drag & drop |
| **Preview** | Read-only render using the same React components as the HTML export; includes full search and section navigator |
| **PDF** | Cheatsheet built as a standalone HTML page (with KaTeX auto-render) and displayed in an iframe; "Download PDF" triggers the browser print engine for pixel-perfect output with subsection columns (1 / 2 / 3) |

Switching modes preserves:
- Which sections and subsections are expanded or collapsed
- The scroll position (the section nearest your viewport top stays at the same pixel offset)

---

## HTML Export

The HTML export route (`/api/export/html/[id]`) runs server-side on Next.js:

1. Fetches the cheatsheet JSON from the backend
2. Resolves all images to inline base64 data URIs (fully self-contained, no external assets)
3. Calls `renderToStaticMarkup` on `ExportRenderer` — the same React component tree as the live Preview
4. Wraps the output in a complete HTML document with embedded CSS and CDN-hosted KaTeX + marked.js
5. Returns as a downloadable `.html` file

The exported file works offline (except for math/markdown rendering which needs CDN scripts) and is identical in appearance to the Preview mode.

A public variant at `/api/export/html/shared/[id]` serves the same output without authentication.

---

## API Reference

All endpoints except `/auth/*` and public endpoints require `Authorization: Bearer <token>`.

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Login → access token + refresh cookie |
| POST | `/auth/refresh` | Exchange refresh cookie for new access token |
| POST | `/auth/logout` | Clear refresh cookie |

### Cheatsheets

| Method | Path | Description |
|---|---|---|
| GET | `/api/cheatsheets` | List your cheatsheets |
| POST | `/api/cheatsheet` | Create / update cheatsheet |
| GET | `/api/cheatsheet/{id}` | Get cheatsheet JSON |
| DELETE | `/api/cheatsheet/{id}` | Delete cheatsheet |
| PUT | `/api/cheatsheet/{id}/share` | Toggle public sharing |
| PUT | `/api/cheatsheet/{id}/group` | Assign to group |
| GET | `/api/cheatsheet/public/{id}` | Get public cheatsheet (no auth) |

### Groups

| Method | Path | Description |
|---|---|---|
| GET | `/api/groups` | List groups |
| POST | `/api/groups` | Create group |
| PUT | `/api/groups/{id}` | Update group |
| DELETE | `/api/groups/{id}` | Delete group |

### Images

| Method | Path | Description |
|---|---|---|
| POST | `/api/cheatsheet/{id}/image` | Upload image (multipart/form-data) |
| GET | `/images/{cheatsheet_id}/{filename}` | Retrieve image (auth or `?token=`) |
| DELETE | `/api/cheatsheet/{id}/image/{filename}` | Delete image |

### Export

| Method | Path | Description |
|---|---|---|
| GET | `/api/export/html/{id}?token=…&download=1` | Download self-contained HTML |
| GET | `/api/export/html/shared/{id}` | Public HTML export (no auth) |
| GET | `/download-json/{id}?token=…` | Download JSON |

---

## Cheatsheet JSON Format

```json
{
  "title": "My Cheatsheet",
  "sections": [
    {
      "title": "Section Title",
      "description": "Optional **markdown** description with $E=mc^2$",
      "images": [
        { "filename": "diagram.png", "widthPercent": 80 },
        { "filename": "screenshot.jpg", "widthPercent": 100 }
      ],
      "lines": [
        { "type": "code", "command": "git {method:commit} -m {str:'message'}", "comment": "Create commit" },
        { "type": "text", "text": "A **markdown** paragraph with $\\LaTeX$" },
        { "type": "image", "src": "/images/abc123/diagram.png", "widthPercent": 80 }
      ],
      "subsections": [
        {
          "title": "Subsection",
          "images": [],
          "lines": [
            { "type": "code", "command": "df.{method:head}({param:n})", "comment": "First n rows" }
          ]
        }
      ]
    }
  ]
}
```

### Images array

Each section and subsection has an `images` array for attaching images directly to that block (displayed above the lines):

| Field | Type | Description |
|---|---|---|
| `filename` | string | Filename as stored on the server (`/images/{cheatsheet_id}/{filename}`) |
| `widthPercent` | number | Display width as a percentage of the container (10–100) |

### Line types

| `type` | Fields | Description |
|---|---|---|
| `code` | `command`, `comment` | Command line; `command` supports syntax tokens |
| `text` | `text` | Markdown + LaTeX block |
| `image` | `src`, `widthPercent` | Inline image placed between lines; width is 10–100 % |

### Syntax tokens

| Token | Color | Use for |
|---|---|---|
| `{method:text}` | Red | Method / function names |
| `{param:text}` | Orange | Parameters / arguments |
| `{str:text}` | Green | String literals |

---

## Running Multiple Instances

You can run several independent CheatSheetMaker instances on the same machine (e.g. one per project or client). Each instance needs its own `.env` with a unique `INSTANCE_NAME` and non-overlapping ports.

**Example — two instances side by side:**

| | Instance A | Instance B |
|---|---|---|
| `INSTANCE_NAME` | `projecta` | `projectb` |
| `DB_PORT` | `5432` | `5433` |
| `BACKEND_PORT` | `8000` | `8001` |
| `FRONTEND_PORT` | `3000` | `3001` |
| `POSTGRES_DB` | `projecta_db` | `projectb_db` |

Each instance gets its own Docker containers (`projecta-db`, `projecta-backend`, `projecta-frontend`) and its own isolated Postgres volume — they never interfere with each other.

To start an instance, set its `.env` as the active one and run the start script (or `docker compose up`). The containers and ports are fully controlled by `.env`.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `INSTANCE_NAME` | **Yes** | `cheatsheetmaker` | Prefix for Docker container names — must be unique per instance |
| `DB_PORT` | No | `5432` | Host port mapped to PostgreSQL |
| `BACKEND_PORT` | No | `8000` | Host port mapped to the FastAPI backend |
| `FRONTEND_PORT` | No | `3000` | Host port mapped to the Next.js frontend |
| `SECRET_KEY` | **Yes** | `dev-fallback-key` | JWT signing secret — **change in production** |
| `DATABASE_URL` | **Yes** | SQLite `./cheatsheetmaker.db` | Full DB connection string |
| `POSTGRES_USER` | Docker | — | PostgreSQL username |
| `POSTGRES_PASSWORD` | Docker | — | PostgreSQL password |
| `POSTGRES_DB` | Docker | — | PostgreSQL database name |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Comma-separated allowed origins |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `30` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | Refresh token lifetime |
| `BACKEND_URL` | Frontend | `http://localhost:8000` | Backend URL used by Next.js API routes |
| `MAX_UPLOAD_SIZE` | No | `5242880` | Max image upload size in bytes (default 5 MB) |

---

## Security

- Passwords hashed with **bcrypt**
- Short-lived JWT access tokens + HTTP-only refresh cookies
- All cheatsheet endpoints enforce **ownership** — users can only access their own data
- Image endpoints accept `?token=` for `<img src>` embedding, validated server-side
- Public sharing is **opt-in** per cheatsheet
- CORS restricted to configured origins
- Images stored as binary blobs in the database — no filesystem paths exposed
- `.env` is in `.gitignore` — never commit it
- Generate `SECRET_KEY` with `openssl rand -hex 32`

---

## License

[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)](LICENSE)

You are free to share and adapt this work for **non-commercial purposes**, as long as you give appropriate credit and distribute any derivatives under the same license.

---

*Made with CheatSheetMaker · [Pablo González Martín](https://www.linkedin.com/in/pablo-gonz%C3%A1lez-mart%C3%ADn-a026112a6/)*
