# ClaudeClaw — Current State

**Last updated:** 09.04.2026

## Status: v1.0 — Working, published on GitHub

## Repo
- https://github.com/kalbac/claudeclaw
- https://kalbac.github.io/claudeclaw/

## What's done
- 47+ files, ~7500 lines TypeScript
- SQLite memory with FTS5 full-text search and salience decay
- Cron scheduler — 3 tasks running (briefing 9:00, mail check every 3h, memory consolidation 22:00)
- Hono dashboard on port 3141
- Groq Whisper voice transcription
- Yandex Mail via IMAP (imapflow) — recent + unread + search
- Heartbeat module (disabled by default)
- 39 unit tests passing
- Modular personality: CLAUDE.md (core) + USER.md (personal) + AGENT.md (personality)
- Setup wizard (npx tsx scripts/setup.ts)
- 10 Telegram bot menu commands (auto-registered via SessionStart hook)
- telegram-utils.ts for sending keyboard/rich messages
- Landing page on GH Pages (Anthropic-style, RU/EN, Channels section, security comparison)
- Clean git history, no secrets
- Reuse-ready: .example files, generic IMAP, setup wizard

## Recent changes (08-09.04.2026)
- Fixed: /mail now returns newest messages first (not oldest unread from 2017)
- Fixed: Telegram bot commands auto-register via SessionStart hook (survive plugin restart)
- Fixed: Commands set at chat scope (highest priority, plugin can't override)
- Fixed: HTML entities in Telegram (<> → {} in CLAUDE.md)
- Fixed: CLAUDE.md explicitly forbids Supermemory for /memory commands
- Fixed: Scheduler dead AbortController removed
- Fixed: searchMemories scoped by chatId
- Added: /model command (info only — shows current model)
- Added: Interim message instruction for long tasks (typing workaround)
- Added: mail-cli "recent" command

## Architecture
- **Claude Code + Channels plugin** — Telegram bridge
- **Background process** (`npm start`) — dashboard + scheduler + heartbeat
- **CLI tools** — memory-cli.js, schedule-cli.js, mail-cli.js, telegram-utils.js
- **SQLite** (store/claudeclaw.db) — WAL mode, shared between processes
- Telegram config auto-reads from ~/.claude/channels/telegram/
- GROQ_API_KEY set via setup wizard into .claude/settings.json env
- SessionStart hook auto-registers bot commands

## Known Issues
- Channels plugin sometimes hangs (shows "typing" but no response). Fix: restart channels.
- Typing indicator only lasts ~5s (channels plugin limitation). Workaround: interim reply messages.
- /model can't switch models on the fly — requires channels restart with --model flag.
- Channels plugin overwrites bot commands at all_private_chats scope on start. Fixed by setting commands at chat scope (highest priority).

## Scheduled Tasks in DB
| ID | Cron | Task | Last Run |
|----|------|------|----------|
| fb004ff3 | 0 9 * * 1-5 | Morning briefing | pending (next: 09.04 09:00) |
| ab4a6d43 | 0 */3 * * 1-5 | Inbox monitor | 08.04 21:01 |
| 39082bfd | 0 22 * * * | Memory consolidation | 08.04 22:01 |

## What's NOT done (future)
- Multi-agent system
- WhatsApp bridge
- TTS (ElevenLabs)
- Video analysis (Gemini)
- PIN lock / kill phrase
- DB encryption
- SSE streaming in dashboard
- Migration to VPS (24/7)

## How to Run
1. `npm start` — background process (dashboard + scheduler)
2. `cd D:\Projects\ClaudeClaw && claude --channels plugin:telegram@claude-plugins-official` — Telegram bot
3. Bot commands auto-register on start (SessionStart hook)
