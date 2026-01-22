# Getting Started with Development

This guide explains how to set up CheetSheetMaker for development and make your first changes.

---

## Prerequisites

- Python 3.6 or higher
- pip (Python package manager)
- A code editor (VS Code recommended)
- Git (optional, for version control)

---

## Setup

### 1. Clone or Download

```bash
git clone https://github.com/your-username/CheetSheetMaker.git
cd CheetSheetMaker
```

### 2. Create Virtual Environment (Recommended)

```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# Linux/Mac
python -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the Application

```bash
python app.py
```

Open your browser at `http://localhost:5000`

---

## Project Layout

```
CheetSheetMaker/
├── app.py              # ← Main Flask app (start here)
├── generator.py        # ← CLI tool
├── templates/
│   └── index.html      # ← Web editor template
├── static/
│   ├── js/app.js       # ← Editor JavaScript
│   └── css/style.css   # ← Editor styles
├── data/               # ← JSON storage (auto-created)
└── cheatsheets/        # ← HTML output (auto-created)
```

---

## Understanding the Code

### Entry Point: app.py

The Flask application starts with:

```python
if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

Key routes to understand:

| Route | Method | Purpose |
|-------|--------|---------|
| `/` | GET | Renders the editor |
| `/api/cheatsheet` | POST | Save a cheatsheet |
| `/api/cheatsheet/<id>` | GET | Load a cheatsheet |
| `/preview/<id>` | GET | Preview generated HTML |

### The HTML Generator

The core function is `generate_html(data)` in app.py:

```python
def generate_html(data):
    """Generate standalone HTML from cheatsheet data."""
    title = data.get('title', 'Cheatsheet')
    sections = data.get('sections', [])

    # Build HTML string with embedded CSS and JS
    html = f'''<!DOCTYPE html>
<html>
<head>
    <style>
        /* ~500 lines of CSS */
    </style>
</head>
<body>
    ...
</body>
</html>'''

    return html
```

### The Editor: app.js

The frontend manages state like this:

```javascript
let state = {
    title: 'My Cheatsheet',
    sections: [
        {
            title: 'Section 1',
            lines: [
                { command: 'code()', comment: 'description' }
            ]
        }
    ]
};
```

Key functions:
- `saveState()` - Push current state to undo stack
- `renderSections()` - Update DOM from state
- `saveCheatsheet()` - Send to backend API

---

## Development Workflow

### Making Changes

1. **Edit the code** in your editor
2. **Refresh the browser** to see changes (Flask debug mode auto-reloads)
3. **Check the console** for JavaScript errors (F12 in browser)
4. **Check the terminal** for Python errors

### Testing Changes

For HTML generation changes:
1. Create a test cheatsheet in the editor
2. Click "Save & Generate"
3. Click "Preview" to see the result
4. Use browser DevTools to inspect the output

For editor changes:
1. Modify `static/js/app.js` or `static/css/style.css`
2. Refresh the browser
3. Test the functionality

### Common Debugging

**Python errors**: Check the terminal where Flask is running

**JavaScript errors**: Open browser DevTools (F12) → Console tab

**CSS issues**: Use browser DevTools → Elements tab → Styles panel

---

## Making Your First Change

Let's add a small feature: a character count for the title.

### Step 1: Edit the Template

In `templates/index.html`, find the title input and add a counter:

```html
<input type="text" id="title-input" placeholder="Cheatsheet Title">
<span id="title-count">0 characters</span>
```

### Step 2: Add JavaScript

In `static/js/app.js`, add an event listener:

```javascript
document.getElementById('title-input').addEventListener('input', function() {
    document.getElementById('title-count').textContent =
        this.value.length + ' characters';
});
```

### Step 3: Add Styling

In `static/css/style.css`, style the counter:

```css
#title-count {
    font-size: 12px;
    color: #666;
    margin-left: 10px;
}
```

### Step 4: Test

1. Refresh the browser
2. Type in the title field
3. See the character count update

---

## Quick Reference

### Flask Commands

```bash
# Run development server
python app.py

# Run on different port
python -c "from app import app; app.run(port=8080)"
```

### CLI Tool

```bash
# Generate HTML from JSON
python generator.py --config input.json --output output.html

# With custom title
python generator.py -c input.json -o output.html -t "Custom Title"
```

### Testing the API

```bash
# List all cheatsheets
curl http://localhost:5000/api/cheatsheets

# Get a specific cheatsheet
curl http://localhost:5000/api/cheatsheet/my_sheet_abc123
```

---

## Next Steps

- Read [Modifying the Application](modifying.md) for specific changes
- Check [Architecture Overview](../architecture/overview.md) to understand the design
- Use the [AI Prompts](../prompts/) for help with complex features
