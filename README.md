# ClaudeClaw

Personal AI assistant powered by Claude Code, accessible via Telegram.

Not a chatbot wrapper. Not hitting an API. It spawns the real Claude Code CLI on your machine with all your tools, skills, MCP servers, and memory. Telegram is just a remote control.

## What it does

- Answer questions and run tasks from anywhere — phone, commute, between meetings
- Execute code, read files, browse the web — anything Claude Code can do
- Remember things across conversations (SQLite with FTS5 full-text search)
- Transcribe and act on voice messages (Groq Whisper, free)
- Analyze photos and documents you send
- Run scheduled tasks on a timer — daily briefings, email checks, reminders
- Check your email (IMAP)
- Web dashboard for monitoring memory, tasks, tokens, and audit log

## Architecture

```
[Telegram] ←→ [Claude Code Channels Plugin] ←→ [Claude Code CLI]
                                                      ↕
                                              [Your Project Dir]
                                               ├── CLAUDE.md (personality)
                                               ├── .claude/skills/ (commands)
                                               └── CLI tools (memory, schedule, mail)
                                                      ↕
                                                 [SQLite DB]
                                                      ↕
                                         [Background Process: npm start]
                                              ├── Dashboard (Hono)
                                              ├── Scheduler (cron)
                                              └── Heartbeat (proactive checks)
```

Two processes:
1. **Claude Code** with channels plugin — handles Telegram messages, uses CLAUDE.md + skills
2. **Background process** (`npm start`) — dashboard + scheduler, runs autonomously

## Quick Start

```bash
git clone <repo-url> claudeclaw
cd claudeclaw
npx tsx scripts/setup.ts
```

The wizard handles everything: dependencies, API keys, build, and verification.

See [INSTALL.md](INSTALL.md) for detailed manual setup instructions.

## Telegram Commands

| Command | Action |
|---------|--------|
| `/new` | Start fresh conversation |
| `/memory search <query>` | Search memories |
| `/memory save <text>` | Save to memory |
| `/memory list` | Recent memories |
| `/memory pin <id>` | Pin a memory |
| `/schedule list` | List scheduled tasks |
| `/schedule create "<prompt>" "<cron>"` | Create a task |
| `/mail` | Check email |
| `/briefing` | Morning briefing |
| `/checkpoint <summary>` | Save session checkpoint |
| `/convolife` | Context window usage % |

Voice messages are transcribed automatically via Groq Whisper.

## Memory System

Dual-sector SQLite with FTS5 full-text search:
- **Semantic memories** — preferences, facts, decisions (triggered by "I prefer", "remember", etc.)
- **Episodic memories** — conversation summaries (auto-saved)
- **Salience decay** — 2% daily, auto-delete below 0.1
- **Pinned memories** — immune to decay

## Dashboard

Web UI at `http://localhost:3141`:
- Memory statistics, list, pinned
- Scheduled tasks with pause/resume/delete
- Token usage timeline
- Conversation history
- Audit log

## Scheduled Tasks

Cron-based scheduler polls every 60 seconds. Create tasks via Telegram or CLI:

```bash
# Daily briefing at 9am on weekdays
node dist/schedule-cli.js create "Check email and summarize" "0 9 * * 1-5"

# Every 3 hours
node dist/schedule-cli.js create "Check for important emails" "0 */3 * * *"
```

## Heartbeat

Proactive health checks (disabled by default). Enable in `.env`:

```env
HEARTBEAT_DISABLED=false
```

Edit `HEARTBEAT.md` to define your checklist. The heartbeat runs periodically and only notifies you when something needs attention.

## Customization

### Personality
Edit `CLAUDE.md` — replace `[YOUR_NAME]`, `[YOUR_ASSISTANT_NAME]`, and `[YOUR_DESCRIPTION]`.

### Skills
Add markdown files to `.claude/skills/` — they're automatically available.

### Email Provider
Default: Yandex Mail (IMAP). To use another provider, edit `src/mail.ts` — change the IMAP host/port.

## Project Structure

```
claudeclaw/
├── CLAUDE.md              # Assistant personality & commands
├── HEARTBEAT.md           # Proactive health check checklist
├── INSTALL.md             # Detailed setup instructions
├── .claude/
│   ├── settings.json      # Permissions for autonomous operation
│   └── skills/            # voice-transcribe, memory, daily-briefing, check-mail, session-end
├── src/                   # TypeScript source (14 files)
│   ├── agent.ts           # Claude Code SDK wrapper
│   ├── db.ts              # SQLite schema & queries
│   ├── memory.ts          # FTS5 search, salience decay
│   ├── scheduler.ts       # Cron task execution
│   ├── dashboard.ts       # Hono web UI
│   ├── voice.ts           # Groq Whisper STT
│   ├── mail.ts            # IMAP client
│   ├── *-cli.ts           # CLI tools
│   └── index.ts           # Background process entry point
├── scripts/               # setup wizard, status check, notify
├── store/                 # SQLite DB (gitignored)
└── workspace/uploads/     # Temp media files (gitignored)
```

## Tech Stack

- TypeScript, Node.js 22+, ESM
- `@anthropic-ai/claude-code` — Agent SDK
- `better-sqlite3` — SQLite with FTS5
- `hono` — Dashboard HTTP server
- `cron-parser` — Scheduler
- `imapflow` — IMAP email client
- Groq Whisper API — Voice transcription

## Credits

Inspired by [earlyaidopters/claudeclaw](https://github.com/earlyaidopters/claudeclaw) and [gaebalai/claudeclaw](https://github.com/gaebalai/claudeclaw).

## License

MIT
