#!/bin/bash
# Send a message to Telegram from the command line
# Usage: ./scripts/notify.sh "Your message here"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  exit 1
fi

# Read token and chat ID from .env
TELEGRAM_BOT_TOKEN=$(grep -E "^TELEGRAM_BOT_TOKEN=" "$ENV_FILE" | cut -d= -f2 | tr -d '"' | tr -d "'")
ALLOWED_CHAT_ID=$(grep -E "^ALLOWED_CHAT_ID=" "$ENV_FILE" | cut -d= -f2 | tr -d '"' | tr -d "'")

if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$ALLOWED_CHAT_ID" ]; then
  echo "Error: TELEGRAM_BOT_TOKEN or ALLOWED_CHAT_ID not set in .env"
  exit 1
fi

MESSAGE="$1"
if [ -z "$MESSAGE" ]; then
  echo "Usage: notify.sh \"message\""
  exit 1
fi

curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\": \"${ALLOWED_CHAT_ID}\", \"text\": \"${MESSAGE}\"}" > /dev/null

echo "Message sent."
