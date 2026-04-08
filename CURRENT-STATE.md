# ClaudeClaw — Current State

**Last updated:** 08.04.2026

## Status: v1.0 — Working

## What's done
- 46 files, ~7000 lines TypeScript
- SQLite memory with FTS5 full-text search and salience decay
- Cron scheduler — 3 tasks running (briefing 9:00, mail check every 3h, memory consolidation 22:00)
- Hono dashboard on port 3141
- Groq Whisper voice transcription
- Yandex Mail via IMAP (imapflow)
- Heartbeat module (disabled by default)
- 39 unit tests passing
- Modular personality: CLAUDE.md (core) + USER.md (personal) + AGENT.md (personality)
- Setup wizard (npx tsx scripts/setup.ts)
- Clean git history, no secrets
- Landing page on GH Pages (Anthropic-style, RU/EN, Channels section)
- Repo: https://github.com/kalbac/claudeclaw
- Landing: https://kalbac.github.io/claudeclaw/

## Architecture
- **Claude Code + Channels plugin** — Telegram bridge (polling, messages, voice, photos, docs)
- **Background process** (`npm start`) — dashboard + scheduler + heartbeat
- **CLI tools** — memory-cli.js, schedule-cli.js, mail-cli.js (called by Claude via Bash)
- **SQLite** (store/claudeclaw.db) — shared between both processes (WAL mode)
- Telegram config auto-reads from ~/.claude/channels/telegram/ (no duplication)
- GROQ_API_KEY set via setup wizard into .claude/settings.json env

## Known Issues
- Channels plugin sometimes hangs (shows "typing" but no response). Fix: restart channels session.
- CLAUDE.md must explicitly say "use memory-cli.js, NOT Supermemory" — otherwise Claude uses Supermemory MCP for /memory commands.
- Yandex Mail requires IMAP enabled in web settings + app password from Yandex ID.

## Key Files
- `CLAUDE.md` — core instructions, commands table, memory rules
- `USER.md` — personal data (gitignored)
- `AGENT.md` — agent personality (gitignored)
- `.claude/settings.json` — permissions + GROQ_API_KEY (env injected by setup wizard)
- `.claude/skills/` — 5 skills (voice-transcribe, memory, daily-briefing, check-mail, session-end)
- `src/` — 16 source files + 6 test files
- `.env` — secrets (gitignored), auto-reads Telegram config from channels

## Scheduled Tasks in DB
| ID | Cron | Task |
|----|------|------|
| fb004ff3 | 0 9 * * 1-5 | Morning briefing |
| ab4a6d43 | 0 */3 * * 1-5 | Inbox monitor |
| 39082bfd | 0 22 * * * | Memory consolidation |

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
