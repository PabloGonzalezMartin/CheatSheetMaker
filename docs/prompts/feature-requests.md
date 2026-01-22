# AI Prompts for Feature Development

This document contains prompts to help AI assistants understand the CheetSheetMaker project and implement new features.

---

## Project Context Prompt

Use this prompt to give an AI assistant full context about the project:

```
I'm working on CheetSheetMaker, a Flask web application for creating HTML cheatsheets.

## Project Structure
- app.py: Main Flask application with routes and HTML generation
- generator.py: CLI tool for generating cheatsheets from JSON
- templates/index.html: Jinja2 template for the web editor UI
- static/js/app.js: Frontend JavaScript for the editor
- static/css/style.css: Editor styles
- data/*.json: Stored cheatsheet data
- cheatsheets/*.html: Generated HTML files

## Key Features
- Web-based editor with drag-and-drop
- Syntax highlighting with {method:}, {param:}, {str:} tags
- Sections and subsections with collapsible content
- Images with percentage-based sizing
- PDF print with optimized layout
- Group/folder organization
- Full undo/redo support

## How HTML Generation Works
- app.py contains a generate_html() function that builds standalone HTML
- CSS and JavaScript are embedded inline (no external dependencies)
- The same HTML generation logic is duplicated in generator.py for CLI use

## Data Flow
1. User edits in web UI (app.js)
2. JavaScript sends JSON to /api/cheatsheet (POST)
3. app.py saves JSON to data/ folder
4. app.py calls generate_html() to create HTML in cheatsheets/ folder
5. User can preview, download, or print the result

I want to implement: [DESCRIBE YOUR FEATURE]

Please provide the implementation considering this architecture.
```

---

## Feature Implementation Prompts

### Adding a New Section Property

```
In CheetSheetMaker, I want to add a new property to sections called "[PROPERTY_NAME]".

This property should:
- [Describe what the property does]
- [Describe how it affects the output]

Please modify:
1. The JSON schema (what the property looks like in data)
2. app.py - the generate_html() function to handle this property
3. generator.py - same changes for CLI consistency
4. static/js/app.js - editor UI to edit this property
5. templates/index.html - form fields if needed

Show me the specific code changes needed.
```

### Adding a New Export Format

```
I want to add a new export format to CheetSheetMaker: [FORMAT NAME]

The export should:
- [Describe the format requirements]
- [Describe when users would use it]

Please provide:
1. A new route in app.py for the export endpoint
2. The conversion/generation function
3. Frontend button in templates/index.html or static/js/app.js
4. Any new dependencies needed

Keep the implementation consistent with existing download/export patterns.
```

### Modifying the Print Layout

```
I need to modify the PDF print layout in CheetSheetMaker.

Current behavior: [Describe current behavior]
Desired behavior: [Describe what you want]

The print styles are embedded in the generate_html() function in app.py
inside the @media print CSS block.

Please provide:
1. The CSS changes needed in the @media print section
2. Any JavaScript changes if print behavior needs modification
3. Test cases to verify the changes work

Remember: The printCheatsheet() function uses inline styles to override
collapsed states during printing.
```

### Adding Editor Functionality

```
I want to add a new editor feature: [FEATURE NAME]

The feature should:
- [Describe the user interaction]
- [Describe the expected result]

In CheetSheetMaker's editor:
- static/js/app.js handles all editor logic
- It uses a state object with sections array
- Undo/redo is managed with saveState() function
- DOM updates happen through render functions

Please provide:
1. The JavaScript function to implement this feature
2. Any HTML changes needed in templates/index.html
3. CSS changes in static/css/style.css if needed
4. Integration with the undo/redo system
```

---

## Debugging Prompts

### Fixing a Bug

```
I have a bug in CheetSheetMaker:

**What should happen:** [Expected behavior]
**What actually happens:** [Actual behavior]
**Steps to reproduce:** [Steps]

The relevant code is in:
- [File and function where issue might be]

Please analyze and provide a fix.
```

### Understanding Code Flow

```
In CheetSheetMaker, I need to understand how [FEATURE] works.

Please trace the code flow from:
1. User action in the browser
2. JavaScript handling in app.js
3. API call to Flask backend
4. Processing in app.py
5. HTML generation
6. Response back to browser

Focus on: [Specific aspect you want to understand]
```

---

## Code Review Prompts

### Review Changes

```
I made these changes to CheetSheetMaker:

[PASTE YOUR CODE CHANGES]

Please review for:
1. Consistency with existing code patterns
2. Potential bugs or edge cases
3. Performance implications
4. Security concerns (XSS, injection, etc.)
5. Missing error handling
```

### Optimize Performance

```
This function in CheetSheetMaker seems slow:

[PASTE CODE]

The function is called when: [Context]
Typical data size: [Size]

Please suggest optimizations while maintaining the same output.
```

---

## Best Practices

1. **Always provide context** - Include relevant code snippets and file locations

2. **Specify constraints** - Mention any limitations (no external dependencies, backwards compatibility, etc.)

3. **Test the suggestions** - AI-generated code should always be tested

4. **Check both files** - Changes to app.py often need to be mirrored in generator.py

5. **Consider edge cases** - Ask the AI about edge cases like empty sections, missing data, etc.
