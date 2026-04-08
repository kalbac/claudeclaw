# Heartbeat Checklist

Check these items and report only problems. If everything is fine, respond with HEARTBEAT_OK.

## System
- [ ] Background process running (check store/claudeclaw.pid)
- [ ] Dashboard responding (curl http://localhost:3141/api/health)
- [ ] SQLite database accessible (node dist/memory-cli.js stats)

## Scheduled Tasks
- [ ] No tasks stuck in 'running' status
- [ ] Next run times are in the future (not stale)

## Memory
- [ ] Memory count is reasonable (not zero, not exploding)
- [ ] Average salience is above 0.3 (decay working correctly)
