---
name: session-end
description: End-of-session protocol. Use when the user says goodbye, session end, done for today, or similar. Saves key learnings and updates context.
user-invocable: true
---

# /session-end -- End of Session Protocol

When the user signals end of session, perform these steps:

## 1. Save checkpoint
Create a summary of key decisions and findings from this session:
```bash
node dist/memory-cli.js checkpoint "Session summary: [3-5 bullet points]"
```

## 2. Save project-related learnings to global memory (if applicable)
If work involved a specific project and global memory MCP is available:
- To Supermemory: `memory(content="[project-name] learning...", action="save")` via MCP
- To Obsidian: update relevant project file via MCP

## 3. Confirm
Reply with a brief confirmation of what was saved.
