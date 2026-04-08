---
name: voice-transcribe
description: Transcribe voice messages received via Telegram. Triggers when a voice message arrives with attachment_kind voice or audio. Uses Groq Whisper API.
user-invocable: false
---

# Voice Message Transcription

When a voice message arrives (attachment_kind: voice or audio), follow these steps:

1. Download the voice file using the `download_attachment` tool with the provided `attachment_file_id`
   - Note the returned file path

2. Copy the file to the project workspace as `.ogg` (Groq requires this extension):
   ```bash
   cp "<downloaded_path>" "workspace/uploads/voice_$(date +%s).ogg"
   ```

3. Transcribe using Groq Whisper API:
   ```bash
   curl -s https://api.groq.com/openai/v1/audio/transcriptions \
     -H "Authorization: Bearer $GROQ_API_KEY" \
     -F "file=@workspace/uploads/voice_TIMESTAMP.ogg" \
     -F "model=whisper-large-v3" \
     -F "response_format=text"
   ```

4. Delete the copy from workspace:
   ```bash
   rm "workspace/uploads/voice_TIMESTAMP.ogg"
   ```

5. Use the transcribed text as the user's message and respond normally

IMPORTANT: Do NOT modify or delete files in ~/.claude/channels/. Only work with copies in the project workspace.

If transcription fails or GROQ_API_KEY is missing, tell the user: "Voice transcription not configured. Please resend as text."
