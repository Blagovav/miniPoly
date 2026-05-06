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
import {
  getAdminStats,
  getPurchaseById,
  listAdminMatches,
  listAdminPurchases,
  listAdminUsers,
  markPurchaseRefunded,
} from "./db";

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

  app.get("/admin/stats", async (req, reply) => {
    if (!authorized(req)) return reject(reply);
    try {
      const dbStats = await getAdminStats();
      const rooms = allRooms();
      return {
        ...dbStats,
        activeRooms: rooms.length,
        activeRoomsInGame: rooms.filter((r) => r.phase !== "lobby" && r.phase !== "ended").length,
        playersOnline: rooms.reduce((n, r) => n + r.players.filter((p) => !p.bankrupt && !p.isBot).length, 0),
      };
    } catch (err) {
      reply.code(500).send({ error: String(err) });
    }
  });

  app.get<{ Querystring: { sort?: string; limit?: string } }>("/admin/users", async (req, reply) => {
    if (!authorized(req)) return reject(reply);
    const sort = (req.query.sort === "active" || req.query.sort === "wins") ? req.query.sort : "recent";
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    try {
      return { users: await listAdminUsers(sort, limit) };
    } catch (err) {
      reply.code(500).send({ error: String(err) });
    }
  });

  app.get<{ Querystring: { limit?: string } }>("/admin/history", async (req, reply) => {
    if (!authorized(req)) return reject(reply);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    try {
      return { matches: await listAdminMatches(limit) };
    } catch (err) {
      reply.code(500).send({ error: String(err) });
    }
  });

  app.get<{ Querystring: { limit?: string } }>("/admin/purchases", async (req, reply) => {
    if (!authorized(req)) return reject(reply);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    try {
      return { purchases: await listAdminPurchases(limit) };
    } catch (err) {
      reply.code(500).send({ error: String(err) });
    }
  });

  // Refund a Stars purchase. Calls Telegram refundStarPayment → on
  // success stamps refunded_at in our DB. Idempotent: replays return the
  // already-refunded row without hitting Telegram a second time. Errors
  // from Telegram (window expired, charge unknown, etc.) bubble up as
  // 502 with the original description so the panel can surface it.
  app.post<{ Params: { id: string } }>("/admin/purchases/:id/refund", async (req, reply) => {
    if (!authorized(req)) return reject(reply);
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      reply.code(400).send({ error: "bad id" });
      return;
    }
    if (!config.botToken) {
      reply.code(503).send({ error: "BOT_TOKEN not configured" });
      return;
    }
    try {
      const purchase = await getPurchaseById(id);
      if (!purchase) {
        reply.code(404).send({ error: "purchase not found" });
        return;
      }
      if (purchase.refundedAt) {
        return { ok: true, alreadyRefunded: true, purchase };
      }
      if (!purchase.chargeId) {
        reply.code(400).send({ error: "purchase has no charge id (cannot refund)" });
        return;
      }
      const tgRes = await fetch(`https://api.telegram.org/bot${config.botToken}/refundStarPayment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user_id: purchase.tgUserId,
          telegram_payment_charge_id: purchase.chargeId,
        }),
      });
      const tgJson = (await tgRes.json().catch(() => ({}))) as { ok?: boolean; description?: string };
      if (!tgRes.ok || !tgJson.ok) {
        reply.code(502).send({ error: tgJson.description ?? `Telegram returned ${tgRes.status}` });
        return;
      }
      await markPurchaseRefunded(id);
      const refreshed = await getPurchaseById(id);
      return { ok: true, purchase: refreshed };
    } catch (err) {
      reply.code(500).send({ error: String(err) });
    }
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
  .grid { display: grid; grid-template-columns: 360px 1fr; gap: 16px; margin-bottom: 16px; }
  .grid--3 { grid-template-columns: 1fr 1fr 1fr; }
  .stats { display: grid; grid-template-columns: repeat(8, 1fr); gap: 14px; margin-bottom: 16px; padding: 14px 16px; }
  .stat { text-align: center; }
  .stat__num { font-size: 22px; font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; }
  .stat__label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: #9cb0ff; margin-top: 2px; }
  .inline-select { background: #08091a; color: #fff; border: 1px solid #1f2745; padding: 2px 6px; border-radius: 3px; font: inherit; font-size: 11px; margin-left: 8px; }
  @media (max-width: 1100px) {
    .stats { grid-template-columns: repeat(4, 1fr); }
    .grid, .grid--3 { grid-template-columns: 1fr; }
  }
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
  button:disabled { opacity: 0.5; cursor: wait; }
  .refund-btn { background: #7f1d1d; padding: 3px 8px; font-size: 11px; }
  .refund-btn:hover { background: #b91c1c; }
  input, select, textarea { background: #08091a; color: #fff; border: 1px solid #1f2745; padding: 6px 10px; border-radius: 4px; font: inherit; }
  textarea { width: 100%; min-height: 60px; resize: vertical; }
  .muted { color: #607090; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .num { font-variant-numeric: tabular-nums; }
  .err { color: #fca5a5; }
  .ok-msg { color: #86efac; }
  /* Top-level tabs (dashboard ↔ shop). */
  .tabs { display: flex; gap: 4px; margin-bottom: 14px; border-bottom: 1px solid #1f2745; }
  .tab { padding: 8px 16px; cursor: pointer; color: #9cb0ff; border-bottom: 2px solid transparent; }
  .tab.active { color: #fff; border-bottom-color: #2746d4; }
  .tab:hover { color: #fff; }
  .subtabs { display: flex; gap: 4px; margin-bottom: 12px; }
  .subtab { padding: 4px 10px; font-size: 12px; background: #11172f; border: 1px solid #1f2745; color: #9cb0ff; cursor: pointer; border-radius: 4px; }
  .subtab.active { background: #2746d4; color: #fff; border-color: #2746d4; }
  /* Two-column layout inside shop: list on the left, edit form on the right. */
  .shop-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 1100px) { .shop-grid { grid-template-columns: 1fr; } }
  .form-grid { display: grid; grid-template-columns: 120px 1fr; gap: 8px 12px; align-items: center; }
  .form-grid label { font-size: 11px; color: #9cb0ff; text-transform: uppercase; letter-spacing: 0.4px; }
  .form-grid input, .form-grid select { width: 100%; box-sizing: border-box; }
  .form-grid .full { grid-column: 1 / -1; }
  .form-actions { margin-top: 12px; display: flex; gap: 8px; }
  .danger { background: #7f1d1d; }
  .danger:hover { background: #b91c1c; }
  .secondary { background: #2a3760; }
  .secondary:hover { background: #3a4a80; }
  .img-thumb { width: 48px; height: 48px; object-fit: contain; background: #08091a; border: 1px solid #1f2745; border-radius: 4px; vertical-align: middle; }
  .img-preview { max-width: 200px; max-height: 200px; object-fit: contain; background: #08091a; border: 1px solid #1f2745; border-radius: 4px; padding: 4px; display: block; margin-top: 4px; }
  .upload-row { display: flex; gap: 8px; align-items: center; }
  .upload-row input[type="text"] { flex: 1; }
  .chip-list { display: flex; flex-direction: column; gap: 6px; }
  .chip-row { display: flex; gap: 6px; align-items: center; }
  .chip-row input { flex: 1; }
  .chance-sum { font-size: 11px; color: #9cb0ff; margin-top: 4px; }
  .chance-sum.over { color: #fca5a5; }
  .rarity-common { color: #c5c5c5; }
  .rarity-rare { color: #5b9eff; }
  .rarity-epic { color: #f06ce0; }
  .rarity-exotic { color: #ff6b6b; }
</style>
</head>
<body>
<h1>Mini Poly · Admin</h1>
<div class="tabs">
  <div class="tab active" data-tab="dashboard">Дашборд</div>
  <div class="tab" data-tab="shop">Магазин</div>
</div>
<div id="tab-dashboard">
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
<div class="stats panel" id="statsPanel">
  <div class="stat"><div class="stat__num">—</div><div class="stat__label">active rooms</div></div>
  <div class="stat"><div class="stat__num">—</div><div class="stat__label">in-game</div></div>
  <div class="stat"><div class="stat__num">—</div><div class="stat__label">players online</div></div>
  <div class="stat"><div class="stat__num">—</div><div class="stat__label">users total</div></div>
  <div class="stat"><div class="stat__num">—</div><div class="stat__label">new 24h</div></div>
  <div class="stat"><div class="stat__num">—</div><div class="stat__label">matches 24h</div></div>
  <div class="stat"><div class="stat__num">—</div><div class="stat__label">stars 24h</div></div>
  <div class="stat"><div class="stat__num">—</div><div class="stat__label">stars all-time</div></div>
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
<div class="grid grid--3">
  <div class="panel">
    <h2>Users
      <select id="userSort" class="inline-select">
        <option value="recent">newest</option>
        <option value="active">recently active</option>
        <option value="wins">most wins</option>
      </select>
    </h2>
    <div id="usersBody" class="muted">loading…</div>
  </div>
  <div class="panel">
    <h2>Recent matches</h2>
    <div id="historyBody" class="muted">loading…</div>
  </div>
  <div class="panel">
    <h2>Stars purchases</h2>
    <div id="purchasesBody" class="muted">loading…</div>
  </div>
</div>
</div>

<!-- ─────────────────────────── SHOP TAB ─────────────────────────── -->
<div id="tab-shop" style="display:none;">
  <div class="subtabs">
    <div class="subtab active" data-shop="caps">Фишки</div>
    <div class="subtab" data-shop="maps">Карты</div>
    <div class="subtab" data-shop="chests">Сундуки</div>
  </div>
  <div id="shopMsg" class="muted" style="margin-bottom:8px; min-height:18px;"></div>

  <!-- Caps -->
  <div id="shop-caps" class="shop-grid">
    <div class="panel">
      <h2>Фишки <span id="capsCount" class="muted"></span> <button id="capsNew" style="float:right; padding:4px 10px; font-size:11px;">+ новая</button></h2>
      <table id="capsTable">
        <thead><tr><th>img</th><th>id</th><th>назв.</th><th>редк.</th><th>⭐</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="panel">
      <h2 id="capsFormTitle">Редактирование фишки</h2>
      <div class="form-grid" id="capsForm">
        <label>id</label><input data-f="id" placeholder="cap-…" />
        <label>type</label><input data-f="type" placeholder="plane / ship / car / …" />
        <label>редкость</label>
        <select data-f="rarity">
          <option value="common">common</option><option value="rare">rare</option>
          <option value="epic">epic</option><option value="exotic">exotic</option>
        </select>
        <label>имя RU</label><input data-f="nameRu" />
        <label>имя EN</label><input data-f="nameEn" />
        <label>цена ⭐</label><input data-f="starsPrice" type="number" placeholder="пусто = только из сундука" />
        <label>только сундук</label><input data-f="chestOnly" type="checkbox" style="width:auto;" />
        <label>порядок</label><input data-f="sortOrder" type="number" placeholder="0" />
        <label>картинка</label>
        <div class="full" style="grid-column:2;">
          <div class="upload-row">
            <input data-f="imageUrl" type="text" placeholder="/api/uploads/shop/caps/… или /figma/…" />
            <input type="file" data-upload="caps" accept="image/*" />
          </div>
          <img class="img-preview" data-preview="caps" style="display:none;" />
        </div>
      </div>
      <div class="form-actions">
        <button data-save="caps">Сохранить</button>
        <button class="secondary" data-reset="caps">Сбросить</button>
        <button class="danger" data-delete="caps" style="margin-left:auto; display:none;">Удалить</button>
      </div>
    </div>
  </div>

  <!-- Maps -->
  <div id="shop-maps" class="shop-grid" style="display:none;">
    <div class="panel">
      <h2>Карты <span id="mapsCount" class="muted"></span> <button id="mapsNew" style="float:right; padding:4px 10px; font-size:11px;">+ новая</button></h2>
      <table id="mapsTable">
        <thead><tr><th>img</th><th>id</th><th>назв.</th><th>редк.</th><th>⭐</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="panel">
      <h2 id="mapsFormTitle">Редактирование карты</h2>
      <div class="form-grid" id="mapsForm">
        <label>id</label><input data-f="id" placeholder="map-…" />
        <label>type</label><input data-f="type" placeholder="classic / mars / …" />
        <label>редкость</label>
        <select data-f="rarity">
          <option value="common">common</option><option value="rare">rare</option>
          <option value="epic">epic</option><option value="exotic">exotic</option>
        </select>
        <label>имя RU</label><input data-f="nameRu" />
        <label>имя EN</label><input data-f="nameEn" />
        <label>цена ⭐</label><input data-f="starsPrice" type="number" placeholder="пусто = бесплатно" />
        <label>порядок</label><input data-f="sortOrder" type="number" placeholder="0" />
        <label>картинка</label>
        <div class="full" style="grid-column:2;">
          <div class="upload-row">
            <input data-f="imageUrl" type="text" placeholder="/api/uploads/shop/maps/… или /figma/…" />
            <input type="file" data-upload="maps" accept="image/*" />
          </div>
          <img class="img-preview" data-preview="maps" style="display:none;" />
        </div>
      </div>
      <div class="form-actions">
        <button data-save="maps">Сохранить</button>
        <button class="secondary" data-reset="maps">Сбросить</button>
        <button class="danger" data-delete="maps" style="margin-left:auto; display:none;">Удалить</button>
      </div>
    </div>
  </div>

  <!-- Chests -->
  <div id="shop-chests" class="shop-grid" style="display:none;">
    <div class="panel">
      <h2>Сундуки <span id="chestsCount" class="muted"></span> <button id="chestsNew" style="float:right; padding:4px 10px; font-size:11px;">+ новый</button></h2>
      <table id="chestsTable">
        <thead><tr><th>img</th><th>id</th><th>назв.</th><th>редк.</th><th>цены</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
    </div>
    <div class="panel">
      <h2 id="chestsFormTitle">Редактирование сундука</h2>
      <div class="form-grid" id="chestsForm">
        <label>id</label><input data-f="id" placeholder="chest-…" />
        <label>редкость</label>
        <select data-f="rarity">
          <option value="common">common</option><option value="rare">rare</option>
          <option value="epic">epic</option><option value="exotic">exotic</option>
        </select>
        <label>имя RU</label><input data-f="nameRu" />
        <label>имя EN</label><input data-f="nameEn" />
        <label>описание RU</label><textarea data-f="descriptionRu" class="full" style="grid-column:2;"></textarea>
        <label>описание EN</label><textarea data-f="descriptionEn" class="full" style="grid-column:2;"></textarea>
        <label>set bonus map</label>
        <select data-f="setBonusMapId"><option value="">— нет —</option></select>
        <label>default qty idx</label><input data-f="defaultQtyIdx" type="number" placeholder="0" />
        <label>порядок</label><input data-f="sortOrder" type="number" placeholder="0" />

        <label>art closed</label>
        <div class="full" style="grid-column:2;">
          <div class="upload-row">
            <input data-f="artClosed" type="text" placeholder="/figma/… или /api/uploads/…" />
            <input type="file" data-chest-upload="artClosed" accept="image/*" />
          </div>
          <img class="img-preview" data-chest-preview="artClosed" style="display:none;" />
        </div>
        <label>art open</label>
        <div class="full" style="grid-column:2;">
          <div class="upload-row">
            <input data-f="artOpen" type="text" placeholder="/figma/… или /api/uploads/…" />
            <input type="file" data-chest-upload="artOpen" accept="image/*" />
          </div>
          <img class="img-preview" data-chest-preview="artOpen" style="display:none;" />
        </div>
        <label>card art</label>
        <div class="full" style="grid-column:2;">
          <div class="upload-row">
            <input data-f="cardArt" type="text" placeholder="/figma/… или /api/uploads/…" />
            <input type="file" data-chest-upload="cardArt" accept="image/*" />
          </div>
          <img class="img-preview" data-chest-preview="cardArt" style="display:none;" />
        </div>

        <label class="full" style="margin-top:10px; color:#fff; text-transform:none; font-size:13px;">Цены (Stars за пачку)</label>
        <div class="full" style="grid-column:1 / -1;">
          <div id="chestPrices" class="chip-list"></div>
          <button class="secondary" id="chestPriceAdd" style="margin-top:6px; font-size:11px; padding:4px 10px;">+ цена</button>
        </div>

        <label class="full" style="margin-top:10px; color:#fff; text-transform:none; font-size:13px;">Шансы выпадения</label>
        <div class="full" style="grid-column:1 / -1;">
          <div id="chestDrops" class="chip-list"></div>
          <button class="secondary" id="chestDropAdd" style="margin-top:6px; font-size:11px; padding:4px 10px;">+ фишка</button>
          <div id="chestDropSum" class="chance-sum">сумма: 0%</div>
          <div class="muted" style="font-size:11px; margin-top:4px;">Сумма ≤ 100%. Остаток до 100% = повторный ролл, пока что-то не выпадет.</div>
        </div>
      </div>
      <div class="form-actions">
        <button data-save="chests">Сохранить</button>
        <button class="secondary" data-reset="chests">Сбросить</button>
        <button class="danger" data-delete="chests" style="margin-left:auto; display:none;">Удалить</button>
      </div>
    </div>
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

async function loadStats() {
  try {
    const s = await fetchJson('/admin/stats');
    const nums = [
      s.activeRooms, s.activeRoomsInGame, s.playersOnline,
      s.totalUsers, s.newUsersToday, s.matchesToday,
      s.starsToday, s.starsTotal,
    ];
    const cells = document.querySelectorAll('#statsPanel .stat__num');
    nums.forEach((v, i) => { if (cells[i]) cells[i].textContent = String(v); });
  } catch (e) {
    // Stats panel staying at "—" is fine; surface in status bar instead of stomping the rooms view.
  }
}

async function loadUsers() {
  const body = document.getElementById('usersBody');
  const sort = document.getElementById('userSort').value;
  try {
    const r = await fetchJson('/admin/users?sort=' + sort + '&limit=50');
    if (!r.users.length) { body.innerHTML = '<span class="muted">no users yet</span>'; return; }
    const rows = r.users.map((u) =>
      '<tr><td>' + escape(u.name) + '</td>' +
      '<td class="num muted">' + u.tgUserId + '</td>' +
      '<td class="num">' + u.gamesWon + '/' + u.gamesPlayed + '</td>' +
      '<td class="muted">' + fmtAge(new Date(sort === "active" ? u.updatedAt : u.createdAt).getTime()) + '</td></tr>'
    ).join('');
    body.innerHTML = '<table><thead><tr><th>name</th><th>tg id</th><th>W/P</th><th>' + (sort === 'active' ? 'last seen' : 'joined') + '</th></tr></thead><tbody>' + rows + '</tbody></table>';
  } catch (e) {
    body.innerHTML = '<span class="err">' + e.message + '</span>';
  }
}

async function loadHistory() {
  const body = document.getElementById('historyBody');
  try {
    const r = await fetchJson('/admin/history?limit=30');
    if (!r.matches.length) { body.innerHTML = '<span class="muted">no finished matches yet</span>'; return; }
    const rows = r.matches.map((m) =>
      '<tr><td class="muted num">' + escape(m.roomId) + '</td>' +
      '<td>' + (m.winnerName ? escape(m.winnerName) + ' 🏆' : '<span class="muted">none</span>') + '</td>' +
      '<td class="num">' + m.playerCount + 'p</td>' +
      '<td class="muted">' + fmtAge(new Date(m.endedAt).getTime()) + '</td></tr>'
    ).join('');
    body.innerHTML = '<table><thead><tr><th>room</th><th>winner</th><th>players</th><th>ended</th></tr></thead><tbody>' + rows + '</tbody></table>';
  } catch (e) {
    body.innerHTML = '<span class="err">' + e.message + '</span>';
  }
}

async function loadPurchases() {
  const body = document.getElementById('purchasesBody');
  try {
    const r = await fetchJson('/admin/purchases?limit=30');
    if (!r.purchases.length) { body.innerHTML = '<span class="muted">no purchases yet</span>'; return; }
    const rows = r.purchases.map((p) => {
      const action = p.refundedAt
        ? pill('refunded', 'bad')
        : p.chargeId
          ? '<button class="refund-btn" data-id="' + p.id + '">refund</button>'
          : '<span class="muted">no charge id</span>';
      return '<tr><td>' + escape(p.userName ?? String(p.tgUserId)) + '</td>' +
        '<td>' + escape(p.itemId) + '</td>' +
        '<td class="num">⭐ ' + p.stars + '</td>' +
        '<td class="muted">' + fmtAge(new Date(p.createdAt).getTime()) + '</td>' +
        '<td>' + action + '</td></tr>';
    }).join('');
    body.innerHTML = '<table><thead><tr><th>buyer</th><th>item</th><th>stars</th><th>when</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>';
    body.querySelectorAll('.refund-btn').forEach((btn) => { btn.onclick = onRefundClick; });
  } catch (e) {
    body.innerHTML = '<span class="err">' + e.message + '</span>';
  }
}

async function onRefundClick(ev) {
  const btn = ev.currentTarget;
  const id = btn.dataset.id;
  if (!confirm('Refund purchase #' + id + '? The user gets their stars back.')) return;
  btn.disabled = true;
  btn.textContent = '…';
  try {
    const res = await fetch(auth('/admin/purchases/' + id + '/refund'), { method: 'POST' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) {
      alert('Refund failed: ' + (j.error || ('HTTP ' + res.status)));
      btn.disabled = false;
      btn.textContent = 'refund';
      return;
    }
    loadPurchases();
    loadStats();
  } catch (e) {
    alert('Refund failed: ' + e.message);
    btn.disabled = false;
    btn.textContent = 'refund';
  }
}

function tick() {
  loadStats();
  loadRooms();
  loadUsers();
  loadHistory();
  loadPurchases();
  if (selected) loadDetail();
}

function setupRefresh() {
  if (timer) clearInterval(timer);
  const ms = Number(document.getElementById('refresh').value);
  if (ms > 0) timer = setInterval(tick, ms);
}

document.getElementById('refresh').onchange = setupRefresh;
document.getElementById('reload').onclick = tick;
document.getElementById('userSort').onchange = loadUsers;
tick();
setupRefresh();

// ─────────────────────────── SHOP TAB ───────────────────────────
//
// Lightweight CRUD UI on top of /admin/shop/* endpoints. State is
// fetched once (and refetched after every save/delete) — no polling,
// because catalog changes are admin-driven, not time-driven.

let shopCatalog = { caps: [], maps: [], chests: [] };
let activeShop = 'caps';
let editing = { caps: null, maps: null, chests: null }; // currently selected id (null = "new")

function showTab(name) {
  document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el.dataset.tab === name));
  document.getElementById('tab-dashboard').style.display = name === 'dashboard' ? '' : 'none';
  document.getElementById('tab-shop').style.display = name === 'shop' ? '' : 'none';
  if (name === 'shop' && shopCatalog.caps.length === 0) loadShopCatalog();
}
document.querySelectorAll('.tab').forEach((el) => { el.onclick = () => showTab(el.dataset.tab); });

function showShopSubtab(name) {
  activeShop = name;
  document.querySelectorAll('.subtab').forEach((el) => el.classList.toggle('active', el.dataset.shop === name));
  for (const k of ['caps', 'maps', 'chests']) {
    document.getElementById('shop-' + k).style.display = k === name ? '' : 'none';
  }
}
document.querySelectorAll('.subtab').forEach((el) => { el.onclick = () => showShopSubtab(el.dataset.shop); });

function flashShop(msg, isErr) {
  const el = document.getElementById('shopMsg');
  el.textContent = msg;
  el.className = isErr ? 'err' : 'ok-msg';
  if (!isErr) setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 3000);
}

async function loadShopCatalog() {
  try {
    shopCatalog = await fetchJson('/admin/shop/catalog');
    renderCaps();
    renderMaps();
    renderChests();
    populateChestMapDropdown();
  } catch (e) {
    flashShop('Не удалось загрузить каталог: ' + e.message, true);
  }
}

// ── Caps ─────────────────────────────────────────────────────────
function renderCaps() {
  const body = document.querySelector('#capsTable tbody');
  document.getElementById('capsCount').textContent = '· ' + shopCatalog.caps.length;
  body.innerHTML = '';
  for (const c of shopCatalog.caps) {
    const tr = document.createElement('tr');
    if (editing.caps === c.id) tr.classList.add('selected');
    tr.innerHTML =
      '<td>' + (c.imageUrl ? '<img src="' + escape(c.imageUrl) + '" class="img-thumb" />' : '<span class="muted">—</span>') + '</td>' +
      '<td class="muted">' + escape(c.id) + '</td>' +
      '<td>' + escape(c.nameRu) + (c.chestOnly ? ' <span class="muted">[chest]</span>' : '') + '</td>' +
      '<td><span class="rarity-' + c.rarity + '">' + c.rarity + '</span></td>' +
      '<td class="num">' + (c.starsPrice ?? '—') + '</td>' +
      '<td class="muted num">#' + c.sortOrder + '</td>';
    tr.onclick = () => loadCapIntoForm(c.id);
    body.appendChild(tr);
  }
}

function loadCapIntoForm(id) {
  const c = shopCatalog.caps.find((x) => x.id === id);
  if (!c) return;
  editing.caps = id;
  const f = document.getElementById('capsForm');
  f.querySelector('[data-f="id"]').value = c.id;
  f.querySelector('[data-f="id"]').readOnly = true;  // id is the PK — no rename through form
  f.querySelector('[data-f="type"]').value = c.type;
  f.querySelector('[data-f="rarity"]').value = c.rarity;
  f.querySelector('[data-f="nameRu"]').value = c.nameRu;
  f.querySelector('[data-f="nameEn"]').value = c.nameEn;
  f.querySelector('[data-f="starsPrice"]').value = c.starsPrice ?? '';
  f.querySelector('[data-f="chestOnly"]').checked = c.chestOnly;
  f.querySelector('[data-f="sortOrder"]').value = c.sortOrder;
  f.querySelector('[data-f="imageUrl"]').value = c.imageUrl ?? '';
  updatePreview('caps', c.imageUrl);
  document.getElementById('capsFormTitle').textContent = 'Редактирование: ' + c.id;
  document.querySelector('[data-delete="caps"]').style.display = '';
  renderCaps();
}

function resetCapForm() {
  editing.caps = null;
  const f = document.getElementById('capsForm');
  f.querySelectorAll('input').forEach((i) => { i.value = ''; if (i.type === 'checkbox') i.checked = false; });
  f.querySelector('[data-f="id"]').readOnly = false;
  f.querySelector('[data-f="rarity"]').value = 'common';
  updatePreview('caps', null);
  document.getElementById('capsFormTitle').textContent = 'Новая фишка';
  document.querySelector('[data-delete="caps"]').style.display = 'none';
  renderCaps();
}

function readCapForm() {
  const f = document.getElementById('capsForm');
  const get = (n) => f.querySelector('[data-f="' + n + '"]').value.trim();
  const starsRaw = get('starsPrice');
  return {
    id: get('id'),
    type: get('type'),
    rarity: get('rarity'),
    nameRu: get('nameRu'),
    nameEn: get('nameEn'),
    starsPrice: starsRaw === '' ? null : Number(starsRaw),
    chestOnly: f.querySelector('[data-f="chestOnly"]').checked,
    imageUrl: get('imageUrl') || null,
    sortOrder: get('sortOrder') === '' ? 0 : Number(get('sortOrder')),
  };
}

// ── Maps ─────────────────────────────────────────────────────────
function renderMaps() {
  const body = document.querySelector('#mapsTable tbody');
  document.getElementById('mapsCount').textContent = '· ' + shopCatalog.maps.length;
  body.innerHTML = '';
  for (const m of shopCatalog.maps) {
    const tr = document.createElement('tr');
    if (editing.maps === m.id) tr.classList.add('selected');
    tr.innerHTML =
      '<td>' + (m.imageUrl ? '<img src="' + escape(m.imageUrl) + '" class="img-thumb" />' : '<span class="muted">—</span>') + '</td>' +
      '<td class="muted">' + escape(m.id) + '</td>' +
      '<td>' + escape(m.nameRu) + '</td>' +
      '<td><span class="rarity-' + m.rarity + '">' + m.rarity + '</span></td>' +
      '<td class="num">' + (m.starsPrice ?? '—') + '</td>' +
      '<td class="muted num">#' + m.sortOrder + '</td>';
    tr.onclick = () => loadMapIntoForm(m.id);
    body.appendChild(tr);
  }
}

function loadMapIntoForm(id) {
  const m = shopCatalog.maps.find((x) => x.id === id);
  if (!m) return;
  editing.maps = id;
  const f = document.getElementById('mapsForm');
  f.querySelector('[data-f="id"]').value = m.id;
  f.querySelector('[data-f="id"]').readOnly = true;
  f.querySelector('[data-f="type"]').value = m.type;
  f.querySelector('[data-f="rarity"]').value = m.rarity;
  f.querySelector('[data-f="nameRu"]').value = m.nameRu;
  f.querySelector('[data-f="nameEn"]').value = m.nameEn;
  f.querySelector('[data-f="starsPrice"]').value = m.starsPrice ?? '';
  f.querySelector('[data-f="sortOrder"]').value = m.sortOrder;
  f.querySelector('[data-f="imageUrl"]').value = m.imageUrl ?? '';
  updatePreview('maps', m.imageUrl);
  document.getElementById('mapsFormTitle').textContent = 'Редактирование: ' + m.id;
  document.querySelector('[data-delete="maps"]').style.display = '';
  renderMaps();
}

function resetMapForm() {
  editing.maps = null;
  const f = document.getElementById('mapsForm');
  f.querySelectorAll('input').forEach((i) => { i.value = ''; });
  f.querySelector('[data-f="id"]').readOnly = false;
  f.querySelector('[data-f="rarity"]').value = 'common';
  updatePreview('maps', null);
  document.getElementById('mapsFormTitle').textContent = 'Новая карта';
  document.querySelector('[data-delete="maps"]').style.display = 'none';
  renderMaps();
}

function readMapForm() {
  const f = document.getElementById('mapsForm');
  const get = (n) => f.querySelector('[data-f="' + n + '"]').value.trim();
  const starsRaw = get('starsPrice');
  return {
    id: get('id'),
    type: get('type'),
    rarity: get('rarity'),
    nameRu: get('nameRu'),
    nameEn: get('nameEn'),
    starsPrice: starsRaw === '' ? null : Number(starsRaw),
    imageUrl: get('imageUrl') || null,
    sortOrder: get('sortOrder') === '' ? 0 : Number(get('sortOrder')),
  };
}

// ── Chests ───────────────────────────────────────────────────────
function populateChestMapDropdown() {
  const sel = document.querySelector('#chestsForm [data-f="setBonusMapId"]');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— нет —</option>';
  for (const m of shopCatalog.maps) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.id + ' (' + m.nameRu + ')';
    sel.appendChild(opt);
  }
  sel.value = cur;
}

function renderChests() {
  const body = document.querySelector('#chestsTable tbody');
  document.getElementById('chestsCount').textContent = '· ' + shopCatalog.chests.length;
  body.innerHTML = '';
  for (const c of shopCatalog.chests) {
    const tr = document.createElement('tr');
    if (editing.chests === c.id) tr.classList.add('selected');
    const priceLabel = c.prices.map((p) => p.qty + '×' + p.stars + '⭐').join(', ');
    tr.innerHTML =
      '<td>' + (c.cardArt || c.artClosed ? '<img src="' + escape(c.cardArt || c.artClosed) + '" class="img-thumb" />' : '<span class="muted">—</span>') + '</td>' +
      '<td class="muted">' + escape(c.id) + '</td>' +
      '<td>' + escape(c.nameRu) + '</td>' +
      '<td><span class="rarity-' + c.rarity + '">' + c.rarity + '</span></td>' +
      '<td class="muted">' + escape(priceLabel || '—') + '</td>' +
      '<td class="muted num">#' + c.sortOrder + '</td>';
    tr.onclick = () => loadChestIntoForm(c.id);
    body.appendChild(tr);
  }
}

function loadChestIntoForm(id) {
  const c = shopCatalog.chests.find((x) => x.id === id);
  if (!c) return;
  editing.chests = id;
  const f = document.getElementById('chestsForm');
  f.querySelector('[data-f="id"]').value = c.id;
  f.querySelector('[data-f="id"]').readOnly = true;
  f.querySelector('[data-f="rarity"]').value = c.rarity;
  f.querySelector('[data-f="nameRu"]').value = c.nameRu;
  f.querySelector('[data-f="nameEn"]').value = c.nameEn;
  f.querySelector('[data-f="descriptionRu"]').value = c.descriptionRu ?? '';
  f.querySelector('[data-f="descriptionEn"]').value = c.descriptionEn ?? '';
  f.querySelector('[data-f="setBonusMapId"]').value = c.setBonusMapId ?? '';
  f.querySelector('[data-f="defaultQtyIdx"]').value = c.defaultQtyIdx;
  f.querySelector('[data-f="sortOrder"]').value = c.sortOrder;
  f.querySelector('[data-f="artClosed"]').value = c.artClosed ?? '';
  f.querySelector('[data-f="artOpen"]').value = c.artOpen ?? '';
  f.querySelector('[data-f="cardArt"]').value = c.cardArt ?? '';
  updateChestPreview('artClosed', c.artClosed);
  updateChestPreview('artOpen', c.artOpen);
  updateChestPreview('cardArt', c.cardArt);
  renderChestPrices(c.prices.length ? c.prices : [{ qty: 1, stars: 100 }]);
  renderChestDrops(c.drops);
  document.getElementById('chestsFormTitle').textContent = 'Редактирование: ' + c.id;
  document.querySelector('[data-delete="chests"]').style.display = '';
  renderChests();
}

function resetChestForm() {
  editing.chests = null;
  const f = document.getElementById('chestsForm');
  f.querySelectorAll('input, textarea').forEach((i) => { i.value = ''; });
  f.querySelector('[data-f="id"]').readOnly = false;
  f.querySelector('[data-f="rarity"]').value = 'common';
  f.querySelector('[data-f="setBonusMapId"]').value = '';
  f.querySelector('[data-f="defaultQtyIdx"]').value = 0;
  f.querySelector('[data-f="sortOrder"]').value = 0;
  updateChestPreview('artClosed', null);
  updateChestPreview('artOpen', null);
  updateChestPreview('cardArt', null);
  renderChestPrices([{ qty: 1, stars: 100 }]);
  renderChestDrops([]);
  document.getElementById('chestsFormTitle').textContent = 'Новый сундук';
  document.querySelector('[data-delete="chests"]').style.display = 'none';
  renderChests();
}

function renderChestPrices(prices) {
  const wrap = document.getElementById('chestPrices');
  wrap.innerHTML = '';
  prices.forEach((p, idx) => {
    const row = document.createElement('div');
    row.className = 'chip-row';
    row.innerHTML =
      '<input type="number" min="1" placeholder="qty" value="' + p.qty + '" data-pf="qty" style="max-width:80px;" />' +
      '<input type="number" min="1" placeholder="stars" value="' + p.stars + '" data-pf="stars" style="max-width:120px;" />' +
      '<button class="danger" style="font-size:11px; padding:3px 8px;" data-pi="' + idx + '">×</button>';
    wrap.appendChild(row);
    row.querySelector('button').onclick = () => {
      const cur = readChestPrices();
      cur.splice(idx, 1);
      renderChestPrices(cur);
    };
  });
}

function readChestPrices() {
  return Array.from(document.querySelectorAll('#chestPrices .chip-row')).map((row) => ({
    qty: Number(row.querySelector('[data-pf="qty"]').value),
    stars: Number(row.querySelector('[data-pf="stars"]').value),
  }));
}

function renderChestDrops(drops) {
  const wrap = document.getElementById('chestDrops');
  wrap.innerHTML = '';
  drops.forEach((d, idx) => {
    const row = document.createElement('div');
    row.className = 'chip-row';
    const opts = shopCatalog.caps.map((c) =>
      '<option value="' + escape(c.id) + '"' + (c.id === d.capId ? ' selected' : '') + '>' + escape(c.id) + ' — ' + escape(c.nameRu) + '</option>'
    ).join('');
    row.innerHTML =
      '<select data-df="capId" style="flex:1;"><option value="">— фишка —</option>' + opts + '</select>' +
      '<input type="number" step="0.1" min="0" max="100" value="' + d.chance + '" data-df="chance" style="max-width:90px;" /> %' +
      '<button class="danger" style="font-size:11px; padding:3px 8px;">×</button>';
    wrap.appendChild(row);
    row.querySelector('input').oninput = updateDropSum;
    row.querySelector('button').onclick = () => {
      const cur = readChestDrops();
      cur.splice(idx, 1);
      renderChestDrops(cur);
      updateDropSum();
    };
  });
  updateDropSum();
}

function readChestDrops() {
  return Array.from(document.querySelectorAll('#chestDrops .chip-row')).map((row) => ({
    capId: row.querySelector('[data-df="capId"]').value,
    chance: Number(row.querySelector('[data-df="chance"]').value),
  }));
}

function updateDropSum() {
  const sum = readChestDrops().reduce((n, d) => n + (Number.isFinite(d.chance) ? d.chance : 0), 0);
  const el = document.getElementById('chestDropSum');
  el.textContent = 'сумма: ' + sum.toFixed(1) + '%';
  el.classList.toggle('over', sum > 100.0001);
}

function readChestForm() {
  const f = document.getElementById('chestsForm');
  const get = (n) => f.querySelector('[data-f="' + n + '"]').value.trim();
  return {
    id: get('id'),
    rarity: get('rarity'),
    nameRu: get('nameRu'),
    nameEn: get('nameEn'),
    descriptionRu: f.querySelector('[data-f="descriptionRu"]').value || null,
    descriptionEn: f.querySelector('[data-f="descriptionEn"]').value || null,
    artClosed: get('artClosed') || null,
    artOpen: get('artOpen') || null,
    cardArt: get('cardArt') || null,
    setBonusMapId: get('setBonusMapId') || null,
    defaultQtyIdx: Number(get('defaultQtyIdx') || '0'),
    sortOrder: Number(get('sortOrder') || '0'),
    prices: readChestPrices().filter((p) => p.qty > 0 && p.stars > 0),
    drops: readChestDrops().filter((d) => d.capId && d.chance > 0),
  };
}

// ── Save / Delete / Upload wiring ─────────────────────────────────
function updatePreview(kind, url) {
  const el = document.querySelector('[data-preview="' + kind + '"]');
  if (!el) return;
  if (url) { el.src = url; el.style.display = ''; } else { el.style.display = 'none'; }
}
function updateChestPreview(field, url) {
  const el = document.querySelector('[data-chest-preview="' + field + '"]');
  if (!el) return;
  if (url) { el.src = url; el.style.display = ''; } else { el.style.display = 'none'; }
}

document.getElementById('capsNew').onclick = resetCapForm;
document.getElementById('mapsNew').onclick = resetMapForm;
document.getElementById('chestsNew').onclick = resetChestForm;
document.querySelector('[data-reset="caps"]').onclick = resetCapForm;
document.querySelector('[data-reset="maps"]').onclick = resetMapForm;
document.querySelector('[data-reset="chests"]').onclick = resetChestForm;

document.querySelector('[data-save="caps"]').onclick = async () => saveItem('caps', readCapForm());
document.querySelector('[data-save="maps"]').onclick = async () => saveItem('maps', readMapForm());
document.querySelector('[data-save="chests"]').onclick = async () => saveItem('chests', readChestForm());

document.querySelector('[data-delete="caps"]').onclick = async () => deleteItem('caps');
document.querySelector('[data-delete="maps"]').onclick = async () => deleteItem('maps');
document.querySelector('[data-delete="chests"]').onclick = async () => deleteItem('chests');

document.getElementById('chestPriceAdd').onclick = () => {
  const cur = readChestPrices();
  cur.push({ qty: 1, stars: 100 });
  renderChestPrices(cur);
};
document.getElementById('chestDropAdd').onclick = () => {
  const cur = readChestDrops();
  cur.push({ capId: '', chance: 10 });
  renderChestDrops(cur);
};

// Image uploads (simple fields: caps + maps).
document.querySelectorAll('[data-upload]').forEach((input) => {
  input.onchange = async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const kind = ev.target.dataset.upload;
    const idEl = document.querySelector('#' + kind + 'Form [data-f="id"]');
    const id = idEl.value.trim();
    if (!id) { flashShop('Сначала задай id', true); ev.target.value = ''; return; }
    try {
      const url = await uploadImage(file, kind, id, '');
      const urlInput = document.querySelector('#' + kind + 'Form [data-f="imageUrl"]');
      urlInput.value = url;
      updatePreview(kind, url);
      flashShop('Картинка загружена');
    } catch (e) {
      flashShop('Загрузка не удалась: ' + e.message, true);
    }
    ev.target.value = '';
  };
});

// Image uploads for chest's three image slots.
document.querySelectorAll('[data-chest-upload]').forEach((input) => {
  input.onchange = async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const field = ev.target.dataset.chestUpload;
    const idEl = document.querySelector('#chestsForm [data-f="id"]');
    const id = idEl.value.trim();
    if (!id) { flashShop('Сначала задай id', true); ev.target.value = ''; return; }
    try {
      const url = await uploadImage(file, 'chests', id, field);
      const urlInput = document.querySelector('#chestsForm [data-f="' + field + '"]');
      urlInput.value = url;
      updateChestPreview(field, url);
      flashShop('Картинка загружена');
    } catch (e) {
      flashShop('Загрузка не удалась: ' + e.message, true);
    }
    ev.target.value = '';
  };
});

async function uploadImage(file, kind, id, suffix) {
  const fd = new FormData();
  fd.append('kind', kind);
  fd.append('id', id);
  if (suffix) fd.append('suffix', suffix);
  fd.append('file', file);
  const res = await fetch(auth('/admin/shop/upload'), { method: 'POST', body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error(j.error || ('HTTP ' + res.status));
  return j.url;
}

async function saveItem(kind, body) {
  if (!body.id) { flashShop('id обязателен', true); return; }
  try {
    const res = await fetch(auth('/admin/shop/' + kind), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) throw new Error(j.error || ('HTTP ' + res.status));
    flashShop('Сохранено: ' + body.id);
    await loadShopCatalog();
    // Re-load the form so it shows the saved row (and now-readonly id).
    if (kind === 'caps') loadCapIntoForm(body.id);
    if (kind === 'maps') loadMapIntoForm(body.id);
    if (kind === 'chests') loadChestIntoForm(body.id);
  } catch (e) {
    flashShop('Ошибка: ' + e.message, true);
  }
}

async function deleteItem(kind) {
  const id = editing[kind];
  if (!id) return;
  if (!confirm('Удалить ' + kind + '/' + id + '?')) return;
  try {
    const res = await fetch(auth('/admin/shop/' + kind + '/' + encodeURIComponent(id)), { method: 'DELETE' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.ok) throw new Error(j.error || ('HTTP ' + res.status));
    flashShop('Удалено: ' + id);
    if (kind === 'caps') resetCapForm();
    if (kind === 'maps') resetMapForm();
    if (kind === 'chests') resetChestForm();
    await loadShopCatalog();
  } catch (e) {
    flashShop('Ошибка: ' + e.message, true);
  }
}
</script>
</body>
</html>`;
