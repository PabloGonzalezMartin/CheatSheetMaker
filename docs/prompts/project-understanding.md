# AI Prompts for Project Understanding

Use these prompts to help AI assistants quickly understand the CheetSheetMaker codebase.

---

## Complete Project Context

Copy this entire prompt when you need an AI to fully understand the project:

```
# CheetSheetMaker - Complete Project Context

## Overview
CheetSheetMaker is a Flask web application that creates standalone HTML cheatsheets.
It has both a web editor and a CLI tool.

## Architecture

### Backend (Python/Flask)
**app.py** - Main web application
- Flask routes for API and pages
- `generate_html(data)` - Creates standalone HTML from JSON
- Cheatsheet CRUD operations
- Group/folder management
- File: ~700 lines

**generator.py** - CLI tool
- Same HTML generation logic as app.py
- Command-line interface with argparse
- File: ~600 lines

### Frontend
**templates/index.html** - Editor UI template
- Jinja2 template
- Main layout and structure

**static/js/app.js** - Editor logic
- State management for sections/subsections
- Drag-and-drop functionality
- Undo/redo system
- API communication
- File: ~1500 lines

**static/css/style.css** - Editor styles

### Data Storage
**data/*.json** - Cheatsheet JSON files
**data/_groups.json** - Group definitions
**cheatsheets/*.html** - Generated HTML files

## JSON Data Structure

```json
{
  "title": "Cheatsheet Title",
  "id": "auto_generated_id",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp",
  "sections": [
    {
      "title": "Section Title",
      "description": "For the index",
      "images": [
        {"src": "data:image/...", "widthPercent": 50}
      ],
      "lines": [
        {"command": "code()", "comment": "description"},
        {"type": "text", "text": "markdown text"}
      ],
      "subsections": [
        {
          "title": "Subsection",
          "images": [...],
          "lines": [...]
        }
      ]
    }
  ]
}
```

## Syntax Highlighting System
Commands use inline tags that are converted to HTML spans:
- `{method:text}` → `<span class="method">text</span>` (red)
- `{param:text}` → `<span class="param">text</span>` (orange)
- `{str:text}` → `<span class="str">text</span>` (green)
- `# comment` → `<span class="comment"># comment</span>` (green)

## Key Functions

### app.py
- `generate_html(data)` - Main HTML generator
- `format_command(cmd)` - Syntax highlighting parser
- `save_cheatsheet(id, data)` - Save to JSON file
- `load_cheatsheet(id)` - Load from JSON file

### app.js
- `state` - Global state object with sections
- `saveState()` - Push to undo stack
- `undo()/redo()` - History navigation
- `addSection()/addSubsection()/addLine()` - Content creation
- `renderSections()` - DOM update from state
- `saveCheatsheet()` - POST to API

## Generated HTML Structure
The output is a single HTML file with:
- Embedded CSS (no external files)
- Embedded JavaScript for collapse/expand
- Print-optimized layout
- Automatic table of contents

## API Endpoints
- POST /api/cheatsheet - Create/update
- GET /api/cheatsheet/<id> - Read
- DELETE /api/cheatsheet/<id> - Delete
- GET /api/cheatsheets - List all
- GET /preview/<id> - HTML preview
- GET /download/<id> - Download HTML
- GET /download-json/<id> - Download JSON

## Print System
- Uses `@media print` CSS for layout
- JavaScript `printCheatsheet()` forces all content visible
- Sections can break across pages
- Subsections stay intact (break-inside: avoid)

## Important Notes
1. HTML generation is duplicated in app.py and generator.py - changes need both
2. All CSS/JS is embedded inline for standalone files
3. Images stored as base64 data URLs
4. Undo/redo saves full state copies

---

Based on this context, I need help with: [YOUR QUESTION]
```

---

## Quick Reference Prompts

### Understanding a Specific File

```
I'm looking at [FILENAME] in CheetSheetMaker.
This is a [Flask app / CLI tool / JavaScript editor / etc.].

Here's the code:

[PASTE CODE]

Please explain:
1. What is the main purpose of this file?
2. What are the key functions and what do they do?
3. How does this file interact with other parts of the system?
```

### Understanding Data Flow

```
In CheetSheetMaker, explain how data flows when a user:

[DESCRIBE USER ACTION - e.g., "saves a cheatsheet", "adds a new section", "prints to PDF"]

Trace through:
1. User interaction
2. JavaScript handling
3. API request
4. Backend processing
5. Data storage/generation
6. Response handling
```

### Understanding the HTML Output

```
CheetSheetMaker generates standalone HTML files.

Looking at the generate_html() function, explain:
1. How is the HTML structured?
2. How are styles embedded?
3. How does JavaScript functionality get included?
4. How does syntax highlighting work?
5. How does the print layout work?
```

---

## Comparison Prompts

### app.py vs generator.py

```
CheetSheetMaker has two files that generate HTML:
- app.py (web application)
- generator.py (CLI tool)

Explain:
1. What functionality is duplicated?
2. What is unique to each file?
3. Why is the code duplicated instead of shared?
4. If I change HTML generation, which files need updates?
```

### State Management

```
In CheetSheetMaker's app.js, explain the state management:

1. How is state structured?
2. How do undo/redo work?
3. How does state sync with the DOM?
4. How does state sync with the backend?
5. What triggers state saves?
```

---

## Exploration Prompts

### Finding Related Code

```
In CheetSheetMaker, I want to understand how [FEATURE] is implemented.

Please identify:
1. Which files contain related code
2. Key functions to look at
3. How the parts connect together
4. Any configuration or constants involved
```

### Impact Analysis

```
If I change [SPECIFIC THING] in CheetSheetMaker, what else might be affected?

Consider:
1. Other functions that depend on this
2. Files that might need matching changes
3. UI elements that might break
4. Data compatibility issues
```

---

## Usage Tips

1. **Start with the complete context prompt** for complex tasks

2. **Use focused prompts** for specific questions

3. **Include actual code** when asking about specific implementations

4. **Mention both app.py and generator.py** when asking about HTML generation

5. **Reference the JSON structure** when asking about data handling
