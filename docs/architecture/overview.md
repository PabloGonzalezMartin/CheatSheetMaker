# CheetSheetMaker Architecture Overview

This document explains the high-level architecture and design of CheetSheetMaker.

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
├─────────────────────────────────┬───────────────────────────────┤
│       Web Editor (Browser)      │      CLI Tool (Terminal)      │
│  templates/index.html           │      generator.py             │
│  static/js/app.js               │                               │
│  static/css/style.css           │                               │
└───────────────┬─────────────────┴───────────────┬───────────────┘
                │                                 │
                │ HTTP/REST API                   │ File I/O
                │                                 │
┌───────────────▼─────────────────┐               │
│        Flask Backend            │               │
│          app.py                 │               │
│  ┌────────────────────────┐     │               │
│  │   generate_html()      │◄────┼───────────────┘
│  │   (HTML Generator)     │     │
│  └────────────────────────┘     │
└───────────────┬─────────────────┘
                │
┌───────────────▼─────────────────┐
│        Data Storage             │
│  data/*.json    (cheatsheets)   │
│  data/_groups.json (folders)    │
│  cheatsheets/*.html (output)    │
└─────────────────────────────────┘
```

---

## Core Components

### 1. Flask Backend (app.py)

The main application server handling:

| Responsibility | Description |
|---------------|-------------|
| **API Routes** | REST endpoints for CRUD operations |
| **HTML Generation** | Converts JSON data to standalone HTML |
| **File Management** | Reads/writes JSON and HTML files |
| **Group Management** | Organizes cheatsheets into folders |

Key functions:
- `generate_html(data)` - Main HTML generator
- `format_command(cmd)` - Syntax highlighting parser
- `save_cheatsheet(id, data)` - Persist to JSON
- `load_cheatsheet(id)` - Load from JSON

### 2. CLI Tool (generator.py)

Standalone command-line interface:

```bash
python generator.py --config input.json --output output.html
```

- Contains the same `generate_html()` logic as app.py
- No server required - direct file-to-file conversion
- Useful for automation and CI/CD pipelines

### 3. Web Editor (Frontend)

Three-part frontend architecture:

| File | Purpose |
|------|---------|
| `templates/index.html` | HTML structure, Jinja2 template |
| `static/js/app.js` | Editor logic, state management, API calls |
| `static/css/style.css` | Editor visual styles |

The editor manages:
- Section/subsection creation and editing
- Drag-and-drop reordering
- Image uploads (converted to base64)
- Undo/redo history
- Live preview synchronization

### 4. Data Storage

File-based storage (no database required):

```
data/
├── _groups.json          # Group/folder definitions
├── my_cheatsheet_abc123.json
├── another_sheet_def456.json
└── ...

cheatsheets/
├── my_cheatsheet_abc123.html
├── another_sheet_def456.html
└── ...
```

---

## Data Flow

### Creating/Editing a Cheatsheet

```
User edits in browser
        │
        ▼
app.js updates local state
        │
        ▼
User clicks "Save & Generate"
        │
        ▼
app.js sends POST /api/cheatsheet
        │
        ▼
app.py receives JSON data
        │
        ├──► Saves to data/{id}.json
        │
        └──► Calls generate_html(data)
                    │
                    ▼
              Saves to cheatsheets/{id}.html
                    │
                    ▼
              Returns success response
                    │
                    ▼
app.js updates UI with new ID
```

### Viewing a Cheatsheet

```
User clicks "Preview" or visits /preview/{id}
        │
        ▼
app.py loads data from data/{id}.json
        │
        ▼
app.py calls generate_html(data)
        │
        ▼
Returns standalone HTML to browser
```

---

## HTML Generation

The `generate_html()` function creates a complete standalone HTML file:

### Structure

```html
<!DOCTYPE html>
<html>
<head>
    <style>
        /* All CSS embedded here */
        /* ~500 lines of styles */
        /* Including @media print rules */
    </style>
</head>
<body>
    <div class="header">
        <h1>Title</h1>
        <button onclick="printCheatsheet()">Print</button>
    </div>

    <div class="index">
        <!-- Auto-generated table of contents -->
    </div>

    <div class="sections">
        <!-- All sections with their content -->
    </div>

    <script>
        /* Collapse/expand functionality */
        /* Print function */
    </script>
</body>
</html>
```

### Syntax Highlighting

Commands use inline tags converted to HTML spans:

| Input Tag | Output HTML | Color |
|-----------|-------------|-------|
| `{method:text}` | `<span class="method">text</span>` | Red |
| `{param:text}` | `<span class="param">text</span>` | Orange |
| `{str:text}` | `<span class="str">text</span>` | Green |
| `# comment` | `<span class="comment"># comment</span>` | Green |

---

## State Management (Frontend)

The editor uses a simple state object:

```javascript
let state = {
    title: "My Cheatsheet",
    sections: [
        {
            title: "Section 1",
            description: "...",
            images: [...],
            lines: [...],
            subsections: [...]
        }
    ]
};
```

### Undo/Redo System

```javascript
let undoStack = [];    // Previous states
let redoStack = [];    // Forward states

function saveState() {
    undoStack.push(JSON.parse(JSON.stringify(state)));
    redoStack = [];  // Clear redo on new change
}

function undo() {
    if (undoStack.length > 0) {
        redoStack.push(JSON.parse(JSON.stringify(state)));
        state = undoStack.pop();
        renderSections();
    }
}
```

---

## Print System

### CSS Print Styles

Located in `generate_html()` within a `@media print` block:

```css
@media print {
    .header { display: none; }
    .index-header, .index-list { display: none; }
    .sections { columns: 2; }
    .subsection { break-inside: avoid; }
}
```

### JavaScript Print Function

Ensures all content is visible during printing:

```javascript
function printCheatsheet() {
    // Force ALL content visible with inline styles
    document.querySelectorAll('.section-content, .subsection-content')
        .forEach(el => el.style.display = 'block');

    setTimeout(() => {
        window.print();
        // Restore after print
        setTimeout(() => {
            document.querySelectorAll('.section-content, .subsection-content')
                .forEach(el => el.style.display = '');
        }, 500);
    }, 100);
}
```

---

## Color System

Sections cycle through 6 color schemes:

```python
SECTION_COLORS = [
    {'header_bg': 'linear-gradient(...blue...)', 'number_bg': '...'},
    {'header_bg': 'linear-gradient(...green...)', 'number_bg': '...'},
    {'header_bg': 'linear-gradient(...pink...)', 'number_bg': '...'},
    {'header_bg': 'linear-gradient(...purple...)', 'number_bg': '...'},
    {'header_bg': 'linear-gradient(...coral...)', 'number_bg': '...'},
    {'header_bg': 'linear-gradient(...light blue...)', 'number_bg': '...'},
]
```

Each section gets `SECTION_COLORS[index % 6]`.

---

## Important Design Decisions

### 1. Standalone HTML Files

Generated files have no external dependencies:
- All CSS is embedded
- All JavaScript is embedded
- Images are base64 data URLs
- Can be opened directly in any browser

### 2. Duplicated Generation Code

Both `app.py` and `generator.py` contain the HTML generation logic:
- Keeps CLI tool independent from Flask
- Allows CLI usage without running the server
- **Trade-off**: Changes must be made in both files

### 3. File-Based Storage

Uses JSON files instead of a database:
- Simple to understand and debug
- Easy to backup and version control
- No database setup required
- **Trade-off**: Limited scalability for very large deployments

### 4. Base64 Images

Images are stored as base64 data URLs:
- Keeps HTML truly standalone
- No external image files to manage
- **Trade-off**: Larger file sizes, JSON files can be large
