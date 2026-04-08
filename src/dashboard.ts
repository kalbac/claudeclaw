import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import {
  getMemoryStats,
  getRecentMemories,
  getPinnedMemories,
  getAllScheduledTasks,
  getTokenStats,
  getTokenTimeline,
  getConversationHistory,
  getAuditLog,
  pauseScheduledTask,
  resumeScheduledTask,
  deleteScheduledTask,
} from './db.js'
import { DASHBOARD_PORT, DASHBOARD_TOKEN, ALLOWED_CHAT_ID } from './config.js'
import { logger } from './logger.js'

const app = new Hono()
const startTime = Date.now()

if (!DASHBOARD_TOKEN) {
  logger.warn('DASHBOARD_TOKEN not set — dashboard is unauthenticated!')
}

// Auth middleware
app.use('/api/*', async (c, next) => {
  if (DASHBOARD_TOKEN) {
    const token =
      c.req.header('Authorization')?.replace('Bearer ', '') ??
      c.req.query('token')
    if (token !== DASHBOARD_TOKEN) {
      return c.json({ error: 'Unauthorized' }, 401)
    }
  }
  await next()
})

// --- API Routes ---

app.get('/api/health', (c) => {
  const uptime = Math.floor((Date.now() - startTime) / 1000)
  const stats = getTokenStats(1)
  return c.json({
    status: 'ok',
    uptime,
    uptimeFormatted: formatUptime(uptime),
    todayTokens: stats.totalInput + stats.totalOutput,
    todayRequests: stats.count,
  })
})

app.get('/api/memories', (c) => {
  return c.json(getMemoryStats())
})

app.get('/api/memories/list', (c) => {
  const limit = parseInt(c.req.query('limit') ?? '50', 10)
  const chatId = ALLOWED_CHAT_ID || 'default'
  return c.json(getRecentMemories(chatId, limit))
})

app.get('/api/memories/pinned', (c) => {
  const chatId = ALLOWED_CHAT_ID || 'default'
  return c.json(getPinnedMemories(chatId))
})

app.get('/api/tasks', (c) => {
  return c.json(getAllScheduledTasks())
})

app.post('/api/tasks/:id/pause', (c) => {
  pauseScheduledTask(c.req.param('id'))
  return c.json({ ok: true })
})

app.post('/api/tasks/:id/resume', (c) => {
  resumeScheduledTask(c.req.param('id'))
  return c.json({ ok: true })
})

app.delete('/api/tasks/:id', (c) => {
  deleteScheduledTask(c.req.param('id'))
  return c.json({ ok: true })
})

app.get('/api/tokens', (c) => {
  const days = parseInt(c.req.query('days') ?? '7', 10)
  return c.json({
    stats: getTokenStats(days),
    timeline: getTokenTimeline(days),
  })
})

app.get('/api/chat/history', (c) => {
  const chatId = ALLOWED_CHAT_ID || 'default'
  const limit = parseInt(c.req.query('limit') ?? '50', 10)
  const offset = parseInt(c.req.query('offset') ?? '0', 10)
  return c.json(getConversationHistory(chatId, limit, offset))
})

app.get('/api/audit', (c) => {
  const limit = parseInt(c.req.query('limit') ?? '50', 10)
  return c.json(getAuditLog(limit))
})

// --- Dashboard HTML ---

app.get('/', (c) => {
  return c.html(dashboardHtml())
})

function dashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ClaudeClaw Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0f; color: #e0e0e0; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; border-bottom: 1px solid #222; padding-bottom: 15px; }
    h1 { font-size: 24px; color: #7c6ef0; }
    .status { display: flex; gap: 8px; align-items: center; }
    .dot { width: 10px; height: 10px; border-radius: 50%; background: #4caf50; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .card { background: #14141f; border: 1px solid #222; border-radius: 12px; padding: 20px; }
    .card h2 { font-size: 14px; color: #888; text-transform: uppercase; margin-bottom: 12px; }
    .card .value { font-size: 28px; font-weight: 600; color: #fff; }
    .card .sub { font-size: 12px; color: #666; margin-top: 4px; }
    .section { background: #14141f; border: 1px solid #222; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .section h2 { font-size: 16px; color: #7c6ef0; margin-bottom: 15px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #1a1a2a; font-size: 13px; }
    th { color: #888; font-weight: 500; }
    td { color: #ccc; }
    .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .tag-semantic { background: #1a3a2a; color: #4caf50; }
    .tag-episodic { background: #3a2a1a; color: #ff9800; }
    .tag-active { background: #1a2a3a; color: #2196f3; }
    .tag-paused { background: #3a3a1a; color: #ffc107; }
    .btn { padding: 4px 10px; border-radius: 4px; border: 1px solid #333; background: transparent; color: #ccc; cursor: pointer; font-size: 12px; }
    .btn:hover { background: #222; }
    .btn-danger { border-color: #f44336; color: #f44336; }
    #refresh { color: #7c6ef0; cursor: pointer; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>ClaudeClaw</h1>
      <div class="status">
        <div class="dot" id="statusDot"></div>
        <span id="statusText">Loading...</span>
        <span id="refresh" onclick="loadAll()">[refresh]</span>
      </div>
    </header>

    <div class="grid">
      <div class="card">
        <h2>Uptime</h2>
        <div class="value" id="uptime">-</div>
      </div>
      <div class="card">
        <h2>Memories</h2>
        <div class="value" id="memTotal">-</div>
        <div class="sub" id="memDetail"></div>
      </div>
      <div class="card">
        <h2>Tokens Today</h2>
        <div class="value" id="tokensToday">-</div>
        <div class="sub" id="requestsToday"></div>
      </div>
      <div class="card">
        <h2>Tasks</h2>
        <div class="value" id="taskCount">-</div>
      </div>
    </div>

    <div class="section">
      <h2>Memories</h2>
      <table id="memoriesTable">
        <thead><tr><th>Type</th><th>Content</th><th>Salience</th><th>Date</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>

    <div class="section">
      <h2>Scheduled Tasks</h2>
      <table id="tasksTable">
        <thead><tr><th>ID</th><th>Schedule</th><th>Prompt</th><th>Next Run</th><th>Status</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
    </div>

    <div class="section">
      <h2>Audit Log</h2>
      <table id="auditTable">
        <thead><tr><th>Time</th><th>Action</th><th>Detail</th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
  </div>

  <script>
    const TOKEN = new URLSearchParams(location.search).get('token') || '';
    const headers = TOKEN ? { 'Authorization': 'Bearer ' + TOKEN } : {};

    async function api(path) {
      const res = await fetch('/api/' + path, { headers });
      return res.json();
    }

    async function loadAll() {
      try {
        const [health, mem, memList, tasks, tokens, audit] = await Promise.all([
          api('health'), api('memories'), api('memories/list?limit=20'),
          api('tasks'), api('tokens'), api('audit?limit=20')
        ]);

        document.getElementById('statusText').textContent = 'Online';
        document.getElementById('uptime').textContent = health.uptimeFormatted;
        document.getElementById('tokensToday').textContent = (health.todayTokens || 0).toLocaleString();
        document.getElementById('requestsToday').textContent = health.todayRequests + ' requests';

        document.getElementById('memTotal').textContent = mem.total;
        document.getElementById('memDetail').textContent =
          mem.semantic + ' semantic, ' + mem.episodic + ' episodic, ' + mem.pinned + ' pinned';

        document.getElementById('taskCount').textContent = tasks.length;

        // Memories table
        const memTbody = document.querySelector('#memoriesTable tbody');
        memTbody.innerHTML = memList.map(m => '<tr>' +
          '<td><span class="tag tag-' + m.sector + '">' + m.sector + '</span></td>' +
          '<td>' + esc(m.content.slice(0, 100)) + '</td>' +
          '<td>' + m.salience.toFixed(2) + '</td>' +
          '<td>' + new Date(m.created_at * 1000).toLocaleDateString('ru-RU') + '</td>' +
          '</tr>').join('');

        // Tasks table
        const taskTbody = document.querySelector('#tasksTable tbody');
        taskTbody.innerHTML = tasks.map(t => '<tr>' +
          '<td>' + esc(t.id) + '</td>' +
          '<td><code>' + esc(t.schedule) + '</code></td>' +
          '<td>' + esc(t.prompt.slice(0, 60)) + '</td>' +
          '<td>' + new Date(t.next_run * 1000).toLocaleString('ru-RU') + '</td>' +
          '<td><span class="tag tag-' + t.status + '">' + t.status + '</span></td>' +
          '<td>' +
            (t.status === 'active' ? '<button class="btn" onclick="taskAction(\\'' + t.id + '\\',\\'pause\\')">Pause</button>' :
             t.status === 'paused' ? '<button class="btn" onclick="taskAction(\\'' + t.id + '\\',\\'resume\\')">Resume</button>' : '') +
            ' <button class="btn btn-danger" onclick="taskAction(\\'' + t.id + '\\',\\'delete\\')">Delete</button>' +
          '</td></tr>').join('');

        // Audit table
        const auditTbody = document.querySelector('#auditTable tbody');
        auditTbody.innerHTML = audit.map(a => '<tr>' +
          '<td>' + new Date(a.created_at * 1000).toLocaleTimeString('ru-RU') + '</td>' +
          '<td>' + esc(a.action) + '</td>' +
          '<td>' + esc(a.detail || '-') + '</td>' +
          '</tr>').join('');

      } catch (err) {
        document.getElementById('statusText').textContent = 'Error';
        document.getElementById('statusDot').style.background = '#f44336';
      }
    }

    async function taskAction(id, action) {
      if (action === 'delete' && !confirm('Delete task ' + id + '?')) return;
      const method = action === 'delete' ? 'DELETE' : 'POST';
      const path = action === 'delete' ? 'tasks/' + id : 'tasks/' + id + '/' + action;
      await fetch('/api/' + path, { method, headers });
      loadAll();
    }

    function esc(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }

    loadAll();
    setInterval(loadAll, 30000);
  </script>
</body>
</html>`
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function startDashboard(): void {
  serve({
    fetch: app.fetch,
    port: DASHBOARD_PORT,
  })
  logger.info({ port: DASHBOARD_PORT }, 'Dashboard started')
}
