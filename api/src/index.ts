import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config";
import { registerWebSocket } from "./ws/server";
import { allRooms, getRoom } from "./rooms/manager";
import { BOARD } from "../../shared/board";
import { getRecentCoPlayers, getUserProfile, getUserPurchases, initDb, recordPurchase } from "./db";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: config.corsOrigin === "*" ? true : config.corsOrigin,
  credentials: true,
});

app.get("/health", async () => ({ ok: true, rooms: allRooms().length }));

app.get("/api/board", async () => ({ board: BOARD }));

app.get("/api/rooms/public", async () => {
  const rooms = allRooms()
    .filter((r) => r.isPublic && r.phase === "lobby" && r.players.length < 6)
    .map((r) => ({
      id: r.id,
      hostName: r.players.find((p) => p.id === r.hostId)?.name ?? "—",
      playerCount: r.players.length,
      maxPlayers: 6,
      createdAt: r.createdAt,
    }));
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
  app.log.info("DB schema ready");
} catch (err) {
  app.log.error({ err }, "DB init failed — stats will not persist");
}

await registerWebSocket(app);

try {
  await app.listen({ port: config.port, host: "0.0.0.0" });
  app.log.info(`API listening on :${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
