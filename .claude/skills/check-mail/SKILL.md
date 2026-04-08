---
name: check-mail
description: Check email for unread messages. Use when the user asks about email, inbox, mail, or uses /mail command.
user-invocable: true
---

# /check-mail -- Email Check

Arguments passed: `$ARGUMENTS`

## Check unread messages
```bash
node dist/mail-cli.js unread 10
```

## If arguments contain a search query
```bash
node dist/mail-cli.js search "$ARGUMENTS"
```

## Format the response

Show results as a concise list:
- Sender, subject, date
- Mark urgent/important emails
- Skip newsletters and automated notifications unless asked

If mail is not configured, inform the user:
"Email not configured. Set YANDEX_EMAIL and YANDEX_APP_PASSWORD in .env (or configure your preferred IMAP provider in src/mail.ts)."
