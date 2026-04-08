---
name: memory
description: Manage assistant memory. Use when the user says remember, forget, recall, or uses /memory commands. Also triggers on memory-related questions like "what do you know about..." or "do you remember...".
user-invocable: true
---

# /memory -- Memory Management

Arguments passed: `$ARGUMENTS`

## Dispatch on arguments

### `search <query>` or `<query>` (default)
Search memories:
```bash
node dist/memory-cli.js search $ARGUMENTS
```
Show results to the user in a readable format.

### `save <content>`
Save a new semantic memory:
```bash
node dist/memory-cli.js save "$ARGUMENTS"
```

### `list [limit]`
Show recent memories:
```bash
node dist/memory-cli.js list
```

### `pin <id>`
Pin a memory so it persists through decay:
```bash
node dist/memory-cli.js pin <id>
```

### `unpin <id>`
```bash
node dist/memory-cli.js unpin <id>
```

### `forget <id>` or `delete <id>`
Delete a specific memory:
```bash
node dist/memory-cli.js forget <id>
```

### `stats`
Show memory statistics:
```bash
node dist/memory-cli.js stats
```

### No args -- show help
List available memory commands.

## Implicit memory triggers

When the user says "remember that...", "save: ...", extract the content and save it:
```bash
node dist/memory-cli.js save "extracted content"
```

When the user asks "do you remember...", "what do you know about...", search:
```bash
node dist/memory-cli.js search "query"
```

Also check global memory for project context (if MCP servers available):
- Supermemory: `recall(query)` via MCP tool
- Obsidian: `search_vault_smart(query)` via MCP tool
