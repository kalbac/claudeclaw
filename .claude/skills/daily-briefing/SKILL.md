---
name: daily-briefing
description: Generate a morning briefing with email summary, project status, and priorities. Use when the user asks for a briefing, morning summary, or what's happening today.
user-invocable: true
---

# /daily-briefing -- Morning Briefing

Generate a concise morning briefing. Check these sources:

## 1. Email
```bash
node dist/mail-cli.js unread 5
```
Summarize unread emails: sender, subject, urgency.

## 2. Project context
If Obsidian MCP is available, read latest session context:
- Use `get_vault_file` MCP tool to read `sessions/latest-context.md`
- Extract: what was done, what's next, priorities

## 3. Memory context
Search recent memories for active tasks and priorities:
```bash
node dist/memory-cli.js list 10
```

## 4. Format the briefing

Keep it tight. Example format:

```
Morning briefing:

EMAIL (3 unread):
- From sender1: Subject (urgent/normal)
- From sender2: Subject

PROJECTS:
- [project-name]: current status, next step

PRIORITIES:
1. First priority
2. Second priority
```

If any section has no data, skip it. Don't pad with filler text.
