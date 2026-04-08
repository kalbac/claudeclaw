# ClaudeClaw — Установка

## Требования

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **Claude Code CLI** — `npm i -g @anthropic-ai/claude-code` + `claude login`
- **Telegram бот** — создать через [@BotFather](https://t.me/BotFather)
- **Groq API ключ** (бесплатно) — [console.groq.com](https://console.groq.com)

## Быстрая установка

```bash
git clone <repo-url> claudeclaw
cd claudeclaw
npx tsx scripts/setup.ts
```

Визард сам установит зависимости, соберёт проект, соберёт API-ключи и покажет инструкции.

## Ручная установка

### 1. Зависимости

```bash
npm install
npm run build
```

### 2. Конфигурация

```bash
cp .env.example .env
```

Заполни `.env`:

```env
GROQ_API_KEY=gsk_...             # Groq Whisper (голосовые)
YANDEX_EMAIL=you@yandex.ru       # Yandex Mail (или другой IMAP)
YANDEX_APP_PASSWORD=...          # Пароль приложения
DASHBOARD_PORT=3141
DASHBOARD_TOKEN=any-random-string  # Сгенерируй: node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

Telegram token и Chat ID читаются автоматически из `~/.claude/channels/telegram/`.

### 3. Настройка Telegram channels

Выполни из папки проекта:

```bash
claude --channels plugin:telegram@claude-plugins-official
```

При первом запуске:
1. `/telegram:configure <BOT_TOKEN>` — вставь токен от BotFather
2. Напиши боту в Telegram — он вернёт код
3. `/telegram:access pair <код>` — подтверди
4. `/telegram:access policy allowlist` — заблокируй доступ для остальных

### 4. Персонализация

Отредактируй `CLAUDE.md` — замени `[YOUR_NAME]`, `[YOUR_ASSISTANT_NAME]` и `[YOUR_DESCRIPTION]` на свои данные.

## Запуск

Два процесса запускаются отдельно:

### Фоновый процесс (dashboard + scheduler)

```bash
npm start
```

- Dashboard: `http://localhost:3141?token=<DASHBOARD_TOKEN>`
- Scheduler: проверяет задачи каждые 60 секунд
- Heartbeat: выключен по умолчанию (`HEARTBEAT_DISABLED=false` в .env чтобы включить)

### Telegram-ассистент

```bash
cd /path/to/claudeclaw
claude --channels plugin:telegram@claude-plugins-official
```

## Команды в Telegram

| Команда | Действие |
|---------|----------|
| `/new` | Новый разговор |
| `/memory search <запрос>` | Поиск по памяти |
| `/memory save <текст>` | Сохранить в память |
| `/memory list` | Последние воспоминания |
| `/memory pin <id>` | Закрепить |
| `/schedule list` | Список задач |
| `/schedule create "<prompt>" "<cron>"` | Создать задачу |
| `/mail` | Проверить почту |
| `/briefing` | Утренний брифинг |
| `/checkpoint <саммари>` | Сохранить checkpoint |
| `/status` | Статус системы |
| `/convolife` | Контекстное окно (%) |

Голосовые сообщения транскрибируются автоматически через Groq Whisper.

## Структура проекта

```
claudeclaw/
├── CLAUDE.md              # Личность ассистента
├── HEARTBEAT.md           # Чек-лист проактивных проверок
├── .claude/skills/        # Скилы (голос, память, почта, брифинг)
├── src/                   # TypeScript исходники
├── dist/                  # Скомпилированный JS
├── store/                 # SQLite БД (gitignored)
├── workspace/uploads/     # Временные файлы (gitignored)
├── scripts/               # setup, status, notify
└── .env                   # Секреты (gitignored)
```

## Yandex Mail

Yandex требует пароль приложения для IMAP:

1. Зайди на [id.yandex.ru/security/app-passwords](https://id.yandex.ru/security/app-passwords)
2. Создай пароль для "Почта"
3. Впиши в `.env` как `YANDEX_APP_PASSWORD`
