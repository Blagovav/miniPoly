/**
 * Admin dashboard — read-only window into live room state for debugging
 * playtester reports without SSH'ing into the box and tailing JSON logs.
 *
 * Auth: shared bearer token from config.adminToken. Empty token disables
 * the whole feature (every endpoint 404s) so a default-deploy without
 * the env var doesn't accidentally expose room state. The token is
 * accepted via either `Authorization: Bearer <token>` or `?token=<...>`
 * query param so the HTML page can auth its fetch calls without juggling
 * headers.
 *
 * Endpoints:
 *   GET /admin               → HTML dashboard
 *   GET /admin/rooms         → list of active rooms (small summary)
 *   GET /admin/rooms/:id     → full room state + recent log entries
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { allRooms, getRoom } from "./rooms/manager";
import { config } from "./config";

const LOG_TAIL = 80;

function authorized(req: FastifyRequest): boolean {
  if (!config.adminToken) return false;
  const header = req.headers.authorization;
  const fromHeader = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const fromQuery = (req.query as Record<string, unknown> | undefined)?.token;
  const provided = typeof fromQuery === "string" ? fromQuery : fromHeader;
  return provided === config.adminToken;
}

function reject(reply: FastifyReply): void {
  // 404 (not 401) so an unconfigured deploy looks identical to a wrong
  // token — no signal that the dashboard exists.
  reply.code(404).send({ error: "not found" });
}

export function registerAdminRoutes(app: FastifyInstance): void {
  app.get("/admin", async (req, reply) => {
    if (!authorized(req)) return reject(reply);
    reply.header("content-type", "text/html; charset=utf-8").send(DASHBOARD_HTML);
  });

  app.get("/admin/rooms", async (req, reply) => {
    if (!authorized(req)) return reject(reply);
    const rooms = allRooms().map((r) => ({
      id: r.id,
      phase: r.phase,
      hostName: r.players.find((p) => p.id === r.hostId)?.name ?? "?",
      players: r.players.length,
      bankrupt: r.players.filter((p) => p.bankrupt).length,
      bots: r.players.filter((p) => p.isBot).length,
      turnCount: r.turnCount,
      createdAt: r.createdAt,
      isPublic: r.isPublic,
      fastMode: r.settings?.fastMode ?? true,
    }));
    rooms.sort((a, b) => b.createdAt - a.createdAt);
    return { rooms, total: rooms.length };
  });

  app.get<{ Params: { id: string } }>("/admin/rooms/:id", async (req, reply) => {
    if (!authorized(req)) return reject(reply);
    const room = getRoom(req.params.id);
    if (!room) {
      reply.code(404).send({ error: "room not found" });
      return;
    }
    const tailLog = room.log.slice(-LOG_TAIL);
    return {
      id: room.id,
      phase: room.phase,
      currentTurn: room.currentTurn,
      turnCount: room.turnCount,
      isPublic: room.isPublic,
      maxPlayers: room.maxPlayers,
      settings: room.settings,
      houseBank: room.houseBank,
      hotelBank: room.hotelBank,
      createdAt: room.createdAt,
      startedAt: room.startedAt,
      players: room.players.map((p) => ({
        id: p.id,
        tgUserId: p.tgUserId,
        name: p.name,
        position: p.position,
        cash: p.cash,
        bankrupt: p.bankrupt,
        inJail: p.inJail,
        isBot: !!p.isBot,
        ready: !!p.ready,
        propertyCount: Object.values(room.properties).filter((op) => op.ownerId === p.id).length,
      })),
      properties: Object.values(room.properties),
      log: tailLog,
    };
  });
}

// Inline single-page dashboard. Vanilla JS, no build step — kept here so
// the API stays a single source of truth for admin tooling and there's
// no second deploy artifact to keep in sync.
const DASHBOARD_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Mini Poly · Admin</title>
<style>
  :root { color-scheme: dark; }
  body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #0b1020; color: #e7ecff; margin: 0; padding: 20px; font-size: 13px; }
  h1 { font-size: 18px; margin: 0 0 12px; }
  h2 { font-size: 14px; margin: 18px 0 8px; color: #9cb0ff; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #1f2745; }
  th { color: #9cb0ff; font-weight: 600; }
  tr:hover { background: #131a36; cursor: pointer; }
  tr.selected { background: #1c2752; }
  .grid { display: grid; grid-template-columns: 360px 1fr; gap: 16px; }
  .panel { background: #11172f; border: 1px solid #1f2745; border-radius: 6px; padding: 12px; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 100px; font-size: 11px; background: #1f2745; }
  .pill--ok { background: #14532d; color: #bbf7d0; }
  .pill--warn { background: #783c0d; color: #fed7aa; }
  .pill--bad { background: #7f1d1d; color: #fecaca; }
  .log { background: #08091a; border: 1px solid #1f2745; padding: 8px; border-radius: 4px; max-height: 280px; overflow-y: auto; white-space: pre-wrap; font-size: 11px; }
  .log__line { padding: 1px 0; color: #c2cce6; }
  .log__line:nth-child(odd) { color: #94a3c4; }
  button { background: #2746d4; color: #fff; border: 0; padding: 6px 12px; border-radius: 4px; cursor: pointer; font: inherit; }
  button:hover { background: #3858e8; }
  input { background: #08091a; color: #fff; border: 1px solid #1f2745; padding: 6px 10px; border-radius: 4px; font: inherit; }
  .muted { color: #607090; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .num { font-variant-numeric: tabular-nums; }
  .err { color: #fca5a5; }
</style>
</head>
<body>
<h1>Mini Poly · Admin</h1>
<div class="row" style="margin-bottom: 12px;">
  <span id="status" class="muted">idle</span>
  <span class="muted">·</span>
  <label>refresh
    <select id="refresh">
      <option value="0">off</option>
      <option value="3000" selected>3s</option>
      <option value="10000">10s</option>
      <option value="30000">30s</option>
    </select>
  </label>
  <button id="reload">reload now</button>
</div>
<div class="grid">
  <div class="panel">
    <h2>Rooms <span id="roomCount" class="muted"></span></h2>
    <table id="roomsTable">
      <thead><tr><th>id</th><th>phase</th><th>host</th><th>P</th><th>turn</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>
  <div class="panel">
    <h2>Detail <span id="detailHeader" class="muted">— pick a room</span></h2>
    <div id="detail"></div>
  </div>
</div>
<script>
const qs = new URLSearchParams(location.search);
const TOKEN = qs.get('token');
if (!TOKEN) {
  document.body.innerHTML = '<p class="err">Append ?token=&lt;ADMIN_TOKEN&gt; to the URL.</p>';
  throw new Error('no token');
}
const auth = (path) => path + (path.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(TOKEN);
let selected = null;
let timer = null;

async function fetchJson(path) {
  const r = await fetch(auth(path));
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

function fmtAge(ms) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  return Math.floor(s / 3600) + 'h';
}

function pill(text, kind) {
  const cls = kind ? 'pill pill--' + kind : 'pill';
  return '<span class="' + cls + '">' + text + '</span>';
}

function escape(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

async function loadRooms() {
  const status = document.getElementById('status');
  status.textContent = 'loading…';
  try {
    const data = await fetchJson('/admin/rooms');
    document.getElementById('roomCount').textContent = '· ' + data.total;
    const tbody = document.querySelector('#roomsTable tbody');
    tbody.innerHTML = '';
    for (const r of data.rooms) {
      const tr = document.createElement('tr');
      if (r.id === selected) tr.classList.add('selected');
      const phaseClass = r.phase === 'ended' ? 'bad' : r.phase === 'lobby' ? 'warn' : 'ok';
      tr.innerHTML =
        '<td>' + escape(r.id) + '</td>' +
        '<td>' + pill(r.phase, phaseClass) + '</td>' +
        '<td>' + escape(r.hostName) + '</td>' +
        '<td class="num">' + r.players + (r.bankrupt ? '<span class="muted">−' + r.bankrupt + '</span>' : '') + '</td>' +
        '<td class="num">' + r.turnCount + '</td>';
      tr.onclick = () => { selected = r.id; loadDetail(); loadRooms(); };
      tbody.appendChild(tr);
    }
    status.textContent = 'updated ' + new Date().toLocaleTimeString();
  } catch (e) {
    status.innerHTML = '<span class="err">' + e.message + '</span>';
  }
}

async function loadDetail() {
  if (!selected) return;
  const detail = document.getElementById('detail');
  document.getElementById('detailHeader').textContent = '— ' + selected;
  detail.innerHTML = 'loading…';
  try {
    const r = await fetchJson('/admin/rooms/' + encodeURIComponent(selected));
    const playerRows = r.players.map((p) =>
      '<tr><td>' + escape(p.name) + (p.isBot ? ' <span class="muted">[bot]</span>' : '') + '</td>' +
      '<td>' + (p.bankrupt ? pill('bankrupt', 'bad') : p.inJail ? pill('jail', 'warn') : pill('alive', 'ok')) + '</td>' +
      '<td class="num">$' + p.cash + '</td>' +
      '<td class="num">pos ' + p.position + '</td>' +
      '<td class="num">' + p.propertyCount + ' tiles</td></tr>'
    ).join('');
    const logHtml = r.log.slice().reverse().map((e) =>
      '<div class="log__line">[' + new Date(e.ts).toLocaleTimeString() + '] ' + escape(e.text.ru || e.text.en || '') + '</div>'
    ).join('');
    detail.innerHTML =
      '<div class="row" style="margin-bottom:8px;">' +
        pill(r.phase) +
        pill('turn ' + r.turnCount) +
        pill('age ' + fmtAge(r.createdAt)) +
        pill(r.settings?.fastMode ? 'auto-sell on' : 'auto-sell off', r.settings?.fastMode ? 'ok' : 'warn') +
        pill(r.isPublic ? 'public' : 'private') +
        pill('houses ' + r.houseBank + '/32') +
        pill('hotels ' + r.hotelBank + '/12') +
      '</div>' +
      '<table style="margin-bottom:12px;"><thead><tr><th>player</th><th>state</th><th>cash</th><th>pos</th><th>tiles</th></tr></thead><tbody>' + playerRows + '</tbody></table>' +
      '<h2 style="margin-top:8px;">Log <span class="muted">(last ' + r.log.length + ')</span></h2>' +
      '<div class="log">' + (logHtml || '<span class="muted">no entries</span>') + '</div>';
  } catch (e) {
    detail.innerHTML = '<span class="err">' + e.message + '</span>';
  }
}

function tick() {
  loadRooms();
  if (selected) loadDetail();
}

function setupRefresh() {
  if (timer) clearInterval(timer);
  const ms = Number(document.getElementById('refresh').value);
  if (ms > 0) timer = setInterval(tick, ms);
}

document.getElementById('refresh').onchange = setupRefresh;
document.getElementById('reload').onclick = tick;
tick();
setupRefresh();
</script>
</body>
</html>`;
