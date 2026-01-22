# CheetSheetMaker

A powerful tool to create beautiful, standalone HTML cheatsheets with a web-based editor and a command-line interface. Features include syntax highlighting, multiple images, subsections, text explanations, collapsible sections, and automatic index generation.

## Features

### Core Features
- **Syntax Highlighting**: Color-coded commands with `{method:}`, `{param:}`, `{str:}` tags
- **Multiple Images**: Add multiple images per section and subsection with percentage-based sizing
- **Text Lines**: Add explanatory text lines without code using `type: "text"`
- **Subsections**: Create nested content within sections (1.1, 1.2, etc.)
- **Automatic Index**: Generates a clickable table of contents with descriptions
- **Collapsible Sections**: Expand/collapse sections and subsections for easy navigation
- **Standalone Output**: Generates single HTML files with no external dependencies
- **PDF Print**: Print to PDF with optimized multi-column layout

### Web Editor Features
- **Rich Text Editor**: User-friendly interface for creating and managing cheatsheets
- **Drag and Drop**: Reorder sections, subsections, and code lines
- **Undo/Redo**: Full undo/redo support for all editor changes
- **Sidebar Management**: View, edit, preview, download, and delete saved cheatsheets
- **Group Management**: Organize cheatsheets into collapsible groups/folders

### Export Features
- **HTML Download**: Download standalone HTML files
- **JSON Download**: Download the JSON configuration file for backup or CLI use
- **PDF Print**: Print to PDF with optimized layout (sections can span pages, subsections stay intact)

---

## Quick Start

### Prerequisites
- Python 3.6+
- pip

### Installation

```bash
git clone https://github.com/your-username/CheetSheetMaker.git
cd CheetSheetMaker
pip install -r requirements.txt
```

### Running the Web App

```bash
python app.py
```

Open your browser at `http://localhost:5000`

### Using the CLI

```bash
python generator.py --config <path_to_json> --output <output_html_file>
```

**CLI Options:**

| Flag             | Description                             |
| ---------------- | --------------------------------------- |
| `-c`, `--config` | Path to JSON config file (required)     |
| `-o`, `--output` | Output HTML file path (required)        |
| `-t`, `--title`  | Override the title from the config file |

**Example:**
```bash
python generator.py --config examples/pandas.json --output pandas_cheatsheet.html
```

---

## API Reference

The Flask application provides a REST API for managing cheatsheets programmatically.

### Endpoints Overview

| Method   | Endpoint                     | Description                        |
| -------- | ---------------------------- | ---------------------------------- |
| `GET`    | `/`                          | Main editor interface              |
| `POST`   | `/api/cheatsheet`            | Create or update a cheatsheet      |
| `GET`    | `/api/cheatsheet/<id>`       | Get cheatsheet JSON data           |
| `GET`    | `/api/cheatsheets`           | List all cheatsheets               |
| `DELETE` | `/api/cheatsheet/<id>`       | Delete a cheatsheet                |
| `GET`    | `/preview/<id>`              | Preview HTML cheatsheet            |
| `GET`    | `/download/<id>`             | Download as HTML file              |
| `GET`    | `/download-json/<id>`        | Download as JSON file              |
| `GET`    | `/api/groups`                | Get all groups                     |
| `POST`   | `/api/groups`                | Create a new group                 |
| `PUT`    | `/api/groups/<id>`           | Update a group                     |
| `DELETE` | `/api/groups/<id>`           | Delete a group                     |
| `PUT`    | `/api/cheatsheet/<id>/group` | Assign cheatsheet to a group       |

### API Usage Examples

#### Create a New Cheatsheet

```bash
curl -X POST http://localhost:5000/api/cheatsheet \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Python Cheatsheet",
    "sections": [
      {
        "title": "Data Types",
        "description": "Basic Python data types",
        "lines": [
          {
            "command": "x = {str:\"hello\"}",
            "comment": "String assignment"
          },
          {
            "command": "nums = [{param:1}, {param:2}, {param:3}]",
            "comment": "List creation"
          }
        ]
      }
    ]
  }'
```

**Response:**
```json
{
  "id": "my_python_cheatsheet_a1b2c3",
  "message": "Cheatsheet saved successfully"
}
```

#### Get a Cheatsheet

```bash
curl http://localhost:5000/api/cheatsheet/my_python_cheatsheet_a1b2c3
```

**Response:**
```json
{
  "title": "My Python Cheatsheet",
  "sections": [...],
  "created_at": "2024-01-15T10:30:00",
  "updated_at": "2024-01-15T10:30:00"
}
```

#### List All Cheatsheets

```bash
curl http://localhost:5000/api/cheatsheets
```

**Response:**
```json
[
  {
    "id": "my_python_cheatsheet_a1b2c3",
    "title": "My Python Cheatsheet",
    "updated_at": "2024-01-15T10:30:00"
  },
  {
    "id": "git_commands_671dd7",
    "title": "Git Commands",
    "updated_at": "2024-01-14T09:15:00"
  }
]
```

#### Delete a Cheatsheet

```bash
curl -X DELETE http://localhost:5000/api/cheatsheet/my_python_cheatsheet_a1b2c3
```

**Response:**
```json
{
  "message": "Cheatsheet deleted successfully"
}
```

#### Create a Group

```bash
curl -X POST http://localhost:5000/api/groups \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Programming Languages"
  }'
```

#### Assign Cheatsheet to Group

```bash
curl -X PUT http://localhost:5000/api/cheatsheet/my_python_cheatsheet_a1b2c3/group \
  -H "Content-Type: application/json" \
  -d '{
    "group_id": "group_abc123"
  }'
```

#### Download Cheatsheet as HTML

```bash
curl -O http://localhost:5000/download/my_python_cheatsheet_a1b2c3
```

#### Download Cheatsheet as JSON

```bash
curl -O http://localhost:5000/download-json/my_python_cheatsheet_a1b2c3
```

---

## JSON Configuration Format

### Full Example

```json
{
  "title": "My Cheatsheet Title",
  "sections": [
    {
      "title": "Section Name",
      "description": "Brief description for the index (optional)",
      "images": [
        {
          "src": "data:image/png;base64,...",
          "widthPercent": 50
        }
      ],
      "lines": [
        {
          "command": "code_here()",
          "comment": "What this does"
        },
        {
          "type": "text",
          "text": "This is an explanatory text line with **markdown** support."
        }
      ],
      "subsections": [
        {
          "title": "Subsection Name",
          "images": [
            {
              "src": "data:image/png;base64,...",
              "widthPercent": 75
            }
          ],
          "lines": [
            {
              "command": "more_code()",
              "comment": "A subsection command"
            }
          ]
        }
      ]
    }
  ]
}
```

### Syntax Highlighting Tags

Use these tags in the `command` field to add colors:

| Tag             | Color  | Usage            |
| --------------- | ------ | ---------------- |
| `{method:text}` | Red    | Method names     |
| `{param:text}`  | Orange | Parameters       |
| `{str:text}`    | Green  | Strings          |
| `# comment`     | Green  | Inline comments  |

**Example:**
```
df.{method:fillna}({param:value}={str:'N/A'}) # fill missing values
```

### Text Lines with Markdown

Text lines support markdown-style formatting:

```json
{
  "type": "text",
  "text": "This supports:\n- Bullet lists\n- **Bold text**\n1. Numbered lists\n2. Multiple items"
}
```

---

## Project Structure

```
CheetSheetMaker/
├── app.py              # Main Flask web application
├── generator.py        # Command-line cheatsheet generator
├── requirements.txt    # Python dependencies
├── templates/
│   └── index.html      # Jinja2 template for web UI
├── static/
│   ├── css/style.css   # Styles for the web editor
│   └── js/app.js       # Frontend JavaScript
├── data/               # JSON data storage
│   ├── _groups.json    # Group definitions
│   └── *.json          # Cheatsheet data files
├── cheatsheets/        # Generated HTML files
├── pdf/                # PDF exports directory
└── docs/               # Documentation
    ├── architecture/   # System architecture docs
    ├── development/    # Development guides
    └── prompts/        # AI prompts for content generation
```

---

## Documentation

For more detailed documentation, see the [docs/](docs/) folder:

- **[Architecture Overview](docs/architecture/overview.md)** - System design and components
- **[Development Guide](docs/development/getting-started.md)** - How to modify and extend
- **[AI Prompts](docs/prompts/)** - Prompts for generating cheatsheet content with AI

---

## License

This project is licensed under the MIT License.
