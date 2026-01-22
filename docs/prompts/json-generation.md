# AI Prompts for JSON Cheatsheet Generation

This document contains prompts you can use with AI assistants (ChatGPT, Claude, etc.) to generate JSON files for CheetSheetMaker.

---

## Basic Generation Prompt

Use this prompt to generate a complete cheatsheet JSON from a topic:

```
I need you to create a JSON file for a cheatsheet generator. The topic is: [YOUR TOPIC]

Please follow this exact JSON structure:

{
  "title": "Cheatsheet Title",
  "sections": [
    {
      "title": "Section Name",
      "description": "Brief description for the index",
      "lines": [
        {
          "command": "code_or_command_here",
          "comment": "Explanation of what this does"
        }
      ],
      "subsections": [
        {
          "title": "Subsection Name",
          "lines": [
            {
              "command": "more_code()",
              "comment": "Description"
            }
          ]
        }
      ]
    }
  ]
}

IMPORTANT - Use these syntax highlighting tags in the "command" field:
- {method:text} - for method/function names (displays in red)
- {param:text} - for parameters/arguments (displays in orange)
- {str:text} - for strings/values (displays in green)

Example command with highlighting:
"command": "df.{method:fillna}({param:value}={str:'N/A'})"

For explanatory text without code, use:
{
  "type": "text",
  "text": "Your explanation here. Supports markdown lists."
}

Please create a comprehensive cheatsheet with 5-10 sections covering the most important aspects of [YOUR TOPIC].
```

---

## Specific Topic Prompts

### Python/Pandas Cheatsheet

```
Create a JSON cheatsheet for Pandas (Python data analysis library).

Include sections for:
1. DataFrame Creation - creating DataFrames from various sources
2. Data Selection - loc, iloc, column selection
3. Data Cleaning - handling missing values, duplicates
4. Data Transformation - apply, map, groupby
5. Merging Data - merge, join, concat
6. Aggregation - sum, mean, count, groupby operations
7. Export - to_csv, to_excel, to_json

Use the syntax highlighting tags:
- {method:methodName} for Pandas methods
- {param:paramName} for parameters
- {str:'value'} for string values

Format the output as valid JSON following the CheetSheetMaker structure.
```

### Git Commands Cheatsheet

```
Create a JSON cheatsheet for Git version control commands.

Include sections for:
1. Repository Setup - init, clone
2. Basic Workflow - add, commit, push, pull
3. Branching - branch, checkout, merge
4. Viewing History - log, diff, status
5. Undoing Changes - reset, revert, stash
6. Remote Operations - remote, fetch, pull
7. Advanced - rebase, cherry-pick, bisect

Use the syntax highlighting tags for command parts:
- {method:command} for the main git command
- {param:--flag} for flags and options
- {str:value} for branch names, commit hashes, etc.

Format as valid JSON for CheetSheetMaker.
```

### API/REST Cheatsheet

```
Create a JSON cheatsheet for REST API concepts and HTTP methods.

Include sections for:
1. HTTP Methods - GET, POST, PUT, DELETE, PATCH
2. Status Codes - 2xx, 3xx, 4xx, 5xx categories
3. Headers - common request and response headers
4. Authentication - API keys, OAuth, JWT
5. Request Body - JSON formatting, form data
6. Query Parameters - filtering, pagination, sorting
7. Best Practices - versioning, naming conventions

For code examples, use curl commands with syntax highlighting:
- {method:curl} for the command
- {param:-X -H} for flags
- {str:"url"} for URLs and values

Format as valid JSON for CheetSheetMaker.
```

---

## Converting Existing Content

Use this prompt to convert existing documentation or notes:

```
I have the following content that I want to convert into a CheetSheetMaker JSON format:

[PASTE YOUR CONTENT HERE]

Please:
1. Organize this into logical sections
2. Extract code examples and format them with the syntax highlighting tags:
   - {method:text} for methods/functions (red)
   - {param:text} for parameters (orange)
   - {str:text} for strings (green)
3. Add brief descriptions for the index
4. Create subsections where there are related sub-topics
5. For explanatory text, use: {"type": "text", "text": "..."}

Output valid JSON following this structure:
{
  "title": "...",
  "sections": [...]
}
```

---

## Enhancing Existing Cheatsheet

```
I have an existing cheatsheet JSON. Please enhance it by:

1. Adding more examples to each section
2. Adding subsections with advanced usage
3. Improving the syntax highlighting in commands
4. Adding text explanations where concepts need clarification
5. Ensuring all descriptions are clear and concise

Here is my current JSON:

[PASTE YOUR JSON HERE]

Please return the enhanced JSON while maintaining the same structure.
```

---

## Tips for Best Results

1. **Be specific about the topic** - "Python Pandas for Data Cleaning" is better than just "Pandas"

2. **Specify the audience level** - Add "for beginners" or "advanced techniques" to get appropriate content

3. **Request specific sections** - List exactly what sections you want covered

4. **Validate the output** - Always validate the JSON before using it:
   ```bash
   python -c "import json; json.load(open('your_file.json'))"
   ```

5. **Iterate** - If sections are missing or need more detail, ask the AI to expand specific sections
