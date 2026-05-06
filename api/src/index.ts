import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { mkdirSync } from "node:fs";
import { config } from "./config";
import { registerWebSocket } from "./ws/server";
import { registerAdminRoutes } from "./admin";
import { registerAdminShopRoutes, UPLOAD_ROOT } from "./admin-shop";
import { initShopDb, listCaps, listChests, listMaps } from "./shop-db";
import { allRooms, getRoom } from "./rooms/manager";
import { BOARD } from "../../shared/board";
import {
  getFriends,
  getIncomingFriendRequests,
  getMatchHistory,
  getRecentCoPlayers,
  getUserProfile,
  getUserPurchases,
  initDb,
  recordPurchase,
} from "./db";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: config.corsOrigin === "*" ? true : config.corsOrigin,
  credentials: true,
});

// Multipart for shop image uploads from the admin panel. Limit chosen
// generously enough for 4K webp/png chest art (typical < 1 MB) without
// allowing accidental video uploads.
await app.register(multipart, {
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

// Persistent dir for shop uploads — the docker-compose volume
// `shop_uploads` mounts here, so artwork survives `--build` redeploys.
// Created at boot so @fastify/static doesn't 404 the route on a fresh
// install before the first upload.
mkdirSync(UPLOAD_ROOT, { recursive: true });
await app.register(fastifyStatic, {
  root: UPLOAD_ROOT,
  prefix: "/api/uploads/",
  decorateReply: false,
});

app.get("/health", async () => ({ ok: true, rooms: allRooms().length }));

app.get("/api/board", async () => ({ board: BOARD }));

// Public shop catalog — caps + maps + chests with their price tiers
// and drop tables. Read by the web client at boot to replace the
// previously-hardcoded SHOP_CAPS/SHOP_MAPS/SHOP_CHESTS constants.
// Fast (3 selects, < 50 rows total); no auth required because the
// catalog is what the storefront already shows publicly.
app.get("/api/shop/catalog", async () => {
  const [caps, maps, chests] = await Promise.all([listCaps(), listMaps(), listChests()]);
  return { caps, maps, chests };
});

app.get("/api/rooms/public", async () => {
  // "Viable seat" = a connected human or a bot. Offline humans inside
  // the 3-minute reconnect grace stay in players[] but don't count
  // toward capacity, and a lobby with NO connected humans is hidden
  // from the list entirely until somebody picks it up again — so
  // strangers don't accidentally land in a room whose host is mid-
  // metro and may never come back.
  const rooms = allRooms()
    .filter((r) => {
      if (!r.isPublic || r.phase !== "lobby") return false;
      const seated = r.players.filter((p) => p.connected || p.isBot).length;
      if (seated >= (r.maxPlayers ?? 6)) return false;
      const anyHumanOnline = r.players.some((p) => p.connected && !p.isBot);
      return anyHumanOnline;
    })
    .map((r) => {
      const host = r.players.find((p) => p.id === r.hostId);
      const viable = r.players.filter((p) => p.connected || p.isBot);
      return {
        id: r.id,
        hostName: host?.name ?? "—",
        playerCount: viable.length,
        maxPlayers: r.maxPlayers ?? 6,
        createdAt: r.createdAt,
      };
    });
  return { rooms };
});

app.get<{ Params: { id: string } }>("/api/rooms/:id", async (req, reply) => {
  const room = getRoom(req.params.id);
  if (!room) return reply.code(404).send({ error: "not found" });
  return { room };
});

app.get<{ Params: { tgUserId: string } }>("/api/users/:tgUserId", async (req, reply) => {
  const id = Number(req.params.tgUserId);
  if (!id) return reply.code(400).send({ error: "bad id" });
  const profile = await getUserProfile(id);
  if (!profile) return reply.code(404).send({ error: "not found" });
  return { profile };
});

app.get<{ Params: { tgUserId: string } }>("/api/users/:tgUserId/coplayers", async (req, reply) => {
  const id = Number(req.params.tgUserId);
  if (!id) return reply.code(400).send({ error: "bad id" });
  const list = await getRecentCoPlayers(id);
  return { players: list };
});

// History of finished matches, newest first. The engine writes a row per
// participant in checkWinCondition (engine.ts ~1238) and the UI in
// HistoryView.vue reads from this endpoint.
app.get<{ Params: { tgUserId: string } }>("/api/users/:tgUserId/history", async (req, reply) => {
  const id = Number(req.params.tgUserId);
  if (!id) return reply.code(400).send({ error: "bad id" });
  const matches = await getMatchHistory(id);
  return { matches };
});

// Accepted in-game friends (separate from Telegram contacts). Friend
// requests themselves are sent + accepted over WS — see ws/server.ts.
app.get<{ Params: { tgUserId: string } }>("/api/users/:tgUserId/friends", async (req, reply) => {
  const id = Number(req.params.tgUserId);
  if (!id) return reply.code(400).send({ error: "bad id" });
  const friends = await getFriends(id);
  const incoming = await getIncomingFriendRequests(id);
  return { friends, incoming };
});

app.get<{ Params: { tgUserId: string } }>("/api/users/:tgUserId/purchases", async (req, reply) => {
  const id = Number(req.params.tgUserId);
  if (!id) return reply.code(400).send({ error: "bad id" });
  const items = await getUserPurchases(id);
  return { items };
});

// Послать инвайт в комнату другу через бота.
app.post<{ Body: { tgUserId: number; roomId: string; fromName: string } }>(
  "/api/invites/send",
  async (req, reply) => {
    const { tgUserId, roomId, fromName } = req.body ?? ({} as any);
    if (!tgUserId || !roomId) return reply.code(400).send({ ok: false, error: "bad request" });
    const room = getRoom(roomId);
    if (!room) return reply.code(404).send({ ok: false, error: "room not found" });
    try {
      const res = await fetch(`${config.botUrl}/invite/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tgUserId, roomId, fromName }),
      });
      const data = await res.json().catch(() => ({}));
      return data;
    } catch {
      return reply.code(502).send({ ok: false, error: "bot unreachable" });
    }
  },
);

// Подготовить «prepared inline message» для tg.shareMessage на фронте —
// клиент вызывает этот endpoint, получает id, и передаёт в Telegram WebApp.
// Пользователь выбирает чат из нативного пикера, туда улетает карточка
// с кнопкой «Играть».
app.post<{ Body: { tgUserId: number; roomId: string; fromName: string } }>(
  "/api/invites/prepare",
  async (req, reply) => {
    const { tgUserId, roomId, fromName } = req.body ?? ({} as any);
    if (!tgUserId || !roomId) return reply.code(400).send({ ok: false, error: "bad request" });
    const room = getRoom(roomId);
    if (!room) return reply.code(404).send({ ok: false, error: "room not found" });
    try {
      const res = await fetch(`${config.botUrl}/invite/prepare`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tgUserId, roomId, fromName }),
      });
      const data = await res.json().catch(() => ({}));
      return data;
    } catch {
      return reply.code(502).send({ ok: false, error: "bot unreachable" });
    }
  },
);

// Создать инвойс для покупки за Telegram Stars. Перенаправляет в бота.
app.post<{ Body: { tgUserId: number; itemId: string; title: string; stars: number } }>(
  "/api/stars/invoice",
  async (req, reply) => {
    try {
      const res = await fetch(`${config.botUrl}/invoice/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req.body),
      });
      if (!res.ok) return reply.code(502).send({ error: "bot unreachable" });
      return await res.json();
    } catch {
      return reply.code(502).send({ error: "bot unreachable" });
    }
  },
);

// Внутренний endpoint — бот шлёт сюда на successful_payment.
app.post<{ Body: { tgUserId: number; itemId: string; stars: number; chargeId: string }; Headers: { "x-bot-token"?: string } }>(
  "/api/internal/purchase",
  async (req, reply) => {
    if (req.headers["x-bot-token"] !== config.botToken) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const { tgUserId, itemId, stars, chargeId } = req.body;
    await recordPurchase({ tgUserId, itemId, stars, tgPaymentChargeId: chargeId });
    return { ok: true };
  },
);

// Инициализация БД — ждём postgres
try {
  await initDb();
  await initShopDb();
  app.log.info("DB schema ready");
} catch (err) {
  app.log.error({ err }, "DB init failed — stats will not persist");
}

registerAdminRoutes(app);
registerAdminShopRoutes(app);

await registerWebSocket(app);

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`API listening on :${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
