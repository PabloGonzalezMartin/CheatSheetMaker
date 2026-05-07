# CheatSheet Maker — AI Prompts

This folder contains ready-to-use prompts to ask any AI (ChatGPT, Claude, Gemini…) to generate cheatsheets in the exact JSON format required by CheatSheet Maker.

## Files

| File | Purpose |
|------|---------|
| `prompt_base.md` | The master prompt explaining the full JSON schema — paste this before any topic request |
| `example_git.json` | Full example: Git commands cheatsheet |
| `example_python_pandas.json` | Full example: Pandas DataFrame cheatsheet |
| `example_docker.json` | Full example: Docker cheatsheet |
| `example_welcome.json` | Full example: Welcome cheatsheet |

## How to use

1. Copy the contents of `prompt_base.md`
2. Paste it to your AI of choice
3. Add at the end: *"Now generate a cheatsheet for: [YOUR TOPIC]"*
4. Copy the returned JSON
5. In CheatSheet Maker → Import → Paste JSON → Import
