import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config";
import { registerWebSocket } from "./ws/server";
import { allRooms, getRoom } from "./rooms/manager";
import { BOARD } from "../../shared/board";
import { getRecentCoPlayers, getUserProfile, initDb } from "./db";

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
