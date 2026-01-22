# CheetSheetMaker File Structure

Detailed breakdown of every file and folder in the project.

---

## Root Directory

```
CheetSheetMaker/
├── app.py                 # Main Flask application
├── generator.py           # CLI tool for generating cheatsheets
├── requirements.txt       # Python dependencies
├── README.md              # Project documentation
├── templates/             # Jinja2 templates
├── static/                # Static assets (CSS, JS)
├── data/                  # JSON data storage
├── cheatsheets/           # Generated HTML files
├── pdf/                   # PDF export directory
└── docs/                  # Documentation
```

---

## Python Files

### app.py (~700 lines)

The main Flask web application.

| Section | Lines | Purpose |
|---------|-------|---------|
| Imports & Config | 1-27 | Dependencies and directory setup |
| ID Generation | 29-39 | `generate_cheatsheet_id()` - creates filename-safe IDs |
| Color Schemes | 41-67 | `SECTION_COLORS` - gradient definitions |
| File Operations | 69-122 | Load/save/list cheatsheets and groups |
| HTML Generation | 124-600 | `generate_html()` - the main HTML generator |
| API Routes | 600+ | Flask route handlers |

Key functions:
```python
generate_cheatsheet_id(title)   # Create ID from title
get_data_path(id)               # Path to JSON file
get_html_path(id)               # Path to HTML file
load_cheatsheet(id)             # Load JSON data
save_cheatsheet(id, data)       # Save JSON data
list_cheatsheets()              # List all cheatsheets
generate_html(data)             # Create standalone HTML
format_command(command)         # Syntax highlighting
```

### generator.py (~600 lines)

Standalone CLI tool with the same HTML generation.

| Section | Lines | Purpose |
|---------|-------|---------|
| Docstring | 1-31 | Usage documentation |
| Imports | 33-38 | Standard library only |
| Color Schemes | 40-66 | Same as app.py |
| Helper Functions | 68-120 | Text formatting |
| HTML Generation | 122-550 | Same logic as app.py |
| CLI Interface | 550+ | argparse handling |

---

## Templates

### templates/index.html

The Jinja2 template for the web editor interface.

Structure:
```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
    <div class="sidebar">
        <!-- Cheatsheet list -->
        <!-- Groups/folders -->
    </div>

    <div class="main-editor">
        <div class="toolbar">
            <!-- Buttons: New, Save, Undo, Redo -->
        </div>

        <div class="editor-content">
            <!-- Title input -->
            <!-- Sections container -->
            <!-- Add section button -->
        </div>
    </div>

    <div class="preview-panel">
        <!-- Live preview iframe -->
    </div>

    <script src="/static/js/app.js"></script>
</body>
</html>
```

---

## Static Assets

### static/js/app.js (~1500 lines)

The frontend JavaScript for the editor.

| Section | Purpose |
|---------|---------|
| State Management | Global state object, undo/redo stacks |
| Initialization | `loadCheatsheets()`, event listeners |
| CRUD Functions | `addSection()`, `addLine()`, `deleteSection()`, etc. |
| Drag & Drop | Sortable initialization for reordering |
| Rendering | `renderSections()`, `renderSubsections()`, `renderLines()` |
| API Communication | `saveCheatsheet()`, `loadCheatsheet()`, `deleteCheatsheet()` |
| Image Handling | File upload to base64 conversion |
| Group Management | Create, edit, delete groups |

Key variables:
```javascript
let state = { title: '', sections: [] };   // Current document
let undoStack = [];                         // Undo history
let redoStack = [];                         // Redo history
let currentCheatsheetId = null;             // Currently editing
let groups = [];                            // Folder structure
```

### static/css/style.css

Styles for the web editor (not the generated output).

| Section | Purpose |
|---------|---------|
| Layout | Sidebar, main editor, preview panel |
| Toolbar | Button styles, icons |
| Sections | Section cards, headers, content areas |
| Forms | Input fields, textareas, buttons |
| Drag & Drop | Placeholder styles, dragging states |
| Responsive | Media queries for smaller screens |

---

## Data Directory

### data/_groups.json

Stores group/folder definitions:

```json
[
  {
    "id": "group_abc123",
    "name": "Programming Languages",
    "order": 0,
    "collapsed": false
  },
  {
    "id": "group_def456",
    "name": "Tools & Utilities",
    "order": 1,
    "collapsed": true
  }
]
```

### data/{id}.json

Individual cheatsheet data files:

```json
{
  "id": "python_pandas_abc123",
  "title": "Python Pandas",
  "created_at": "2024-01-15T10:30:00",
  "updated_at": "2024-01-15T14:22:00",
  "group_id": "group_abc123",
  "sections": [
    {
      "title": "DataFrame Creation",
      "description": "Ways to create DataFrames",
      "images": [],
      "lines": [
        {
          "command": "pd.{method:DataFrame}({param:data})",
          "comment": "Create from dict, list, or array"
        }
      ],
      "subsections": []
    }
  ]
}
```

---

## Output Directories

### cheatsheets/

Generated HTML files ready for viewing/downloading:

```
cheatsheets/
├── python_pandas_abc123.html
├── git_commands_def456.html
└── ...
```

Each file is standalone and can be:
- Opened directly in any browser
- Shared without dependencies
- Printed to PDF

### pdf/

Reserved for PDF exports (currently uses browser print-to-PDF).

---

## Documentation

### docs/

```
docs/
├── architecture/
│   ├── overview.md        # System design
│   └── file-structure.md  # This file
├── development/
│   ├── getting-started.md # Setup guide
│   └── modifying.md       # How to modify
└── prompts/
    ├── json-generation.md    # AI prompts for content
    ├── feature-requests.md   # AI prompts for features
    └── project-understanding.md # AI context prompts
```

---

## Dependencies

### requirements.txt

```
Flask>=2.0.0
```

Only Flask is required - no database drivers, no complex dependencies.

---

## File Relationships

```
User Input
    │
    ▼
templates/index.html ◄──────┐
    │                       │
    ▼                       │
static/js/app.js            │ Jinja2 renders
    │                       │
    │ API calls             │
    ▼                       │
app.py ─────────────────────┘
    │
    ├──► data/*.json (save/load)
    │
    └──► cheatsheets/*.html (generate)

generator.py
    │
    ├──► input.json (read)
    │
    └──► output.html (write)
```
