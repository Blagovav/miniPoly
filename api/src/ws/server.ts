import type { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import type { ClientMessage, ServerMessage, RoomState } from "../../../shared/types";
import { validateInitData } from "../telegram";
import {
  addPlayer,
  buyCurrentProperty,
  createRoom,
  endTurn,
  leaveActiveGame,
  reassignHostIfNeeded,
  removePlayer,
  rollAndMove,
  selectToken,
  skipBuy,
  startGame,
} from "../game/engine";

/** Чистит всех offline-игроков из лобби. Вызывается перед каждым broadcast. */
function sweepOfflineLobby(room: RoomState): void {
  if (room.phase !== "lobby") return;
  const offline = room.players.filter((p) => !p.connected);
  for (const p of offline) removePlayer(room, p.id);
}
import { deleteRoom, getRoom, onStateChange, saveRoom } from "../rooms/manager";

interface Conn {
  send(msg: ServerMessage): void;
  roomId: string | null;
  playerId: string | null;
  tgUserId: number | null;
}

const connections = new Map<WebSocket, Conn>();

function broadcast(roomId: string, msg: ServerMessage): void {
  for (const [ws, conn] of connections) {
    if (conn.roomId === roomId) {
      try {
        ws.send(JSON.stringify(msg));
      } catch {
        /* noop */
      }
    }
  }
}

function sendState(roomId: string): void {
  const room = getRoom(roomId);
  if (!room) return;
  sweepOfflineLobby(room);
  broadcast(roomId, { type: "state", room });
}

export async function registerWebSocket(app: FastifyInstance): Promise<void> {
  await app.register(websocket);

  app.get("/ws", { websocket: true }, (socket) => {
    const ws = socket as unknown as WebSocket;
    const conn: Conn = { send: (m) => ws.send(JSON.stringify(m)), roomId: null, playerId: null, tgUserId: null };
    connections.set(ws, conn);

    socket.on("message", (raw: Buffer) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        conn.send({ type: "error", message: "invalid json" });
        return;
      }
      handleMessage(conn, ws, msg);
    });

    socket.on("close", () => {
      const c = connections.get(ws);
      if (c && c.roomId && c.playerId) {
        const roomId = c.roomId;
        const playerId = c.playerId;
        const room = getRoom(roomId);
        if (room) {
          const p = room.players.find((pl) => pl.id === playerId);
          if (p) {
            p.connected = false;
            reassignHostIfNeeded(room);
          }
          // В игре — сохраняем offline-игрока для возможного реконнекта.
          // В лобби — грейс-период 3с, потом удаляем если не вернулся.
          if (room.phase === "lobby") {
            setTimeout(() => {
              const fresh = getRoom(roomId);
              if (!fresh || fresh.phase !== "lobby") return;
              const stale = fresh.players.find((pl) => pl.id === playerId);
              if (stale && !stale.connected) {
                removePlayer(fresh, stale.id);
                sendState(roomId);
              }
            }, 3000);
          }
          sendState(roomId);
        }
      }
      connections.delete(ws);
    });
  });
}

function handleMessage(conn: Conn, ws: WebSocket, msg: ClientMessage): void {
  switch (msg.type) {
    case "create":
      return handleCreate(conn, msg);
    case "join":
      return handleJoin(conn, msg);
    case "ready":
      return handleReady(conn);
    case "start":
      return handleStart(conn);
    case "roll":
      return handleRoll(conn);
    case "buy":
      return handleBuy(conn);
    case "skipBuy":
      return handleSkipBuy(conn);
    case "endTurn":
      return handleEndTurn(conn);
    case "chat":
      return handleChat(conn, msg.text);
    case "selectToken":
      return handleSelectToken(conn, msg.tokenId);
    case "leave":
      return handleLeave(conn);
    default:
      conn.send({ type: "error", message: "unknown message" });
  }
}

function authenticate(initData: string, name: string) {
  const auth = validateInitData(initData);
  if (!auth) return null;
  return { tgUserId: auth.user.id, displayName: name || auth.user.first_name };
}

function handleCreate(conn: Conn, msg: ClientMessage & { type: "create" }): void {
  const auth = authenticate(msg.tgInitData, msg.name);
  if (!auth) {
    conn.send({ type: "error", message: "auth failed" });
    return;
  }
  const room = createRoom("pending", msg.isPublic ?? true);
  const player = addPlayer(room, auth.tgUserId, auth.displayName);
  if (!player) {
    conn.send({ type: "error", message: "can't add player" });
    return;
  }
  room.hostId = player.id;
  saveRoom(room);

  conn.roomId = room.id;
  conn.playerId = player.id;
  conn.tgUserId = auth.tgUserId;
  conn.send({ type: "joined", roomId: room.id, playerId: player.id });
  sendState(room.id);
}

function handleJoin(conn: Conn, msg: ClientMessage & { type: "join" }): void {
  const auth = authenticate(msg.tgInitData, msg.name);
  if (!auth) {
    conn.send({ type: "error", message: "auth failed" });
    return;
  }
  const room = getRoom(msg.roomId);
  if (!room) {
    conn.send({ type: "error", message: "room not found" });
    return;
  }
  const player = addPlayer(room, auth.tgUserId, auth.displayName);
  if (!player) {
    conn.send({ type: "error", message: "can't join (full or already started)" });
    return;
  }
  // Новый игрок подключился — если хост оффлайн, передаём роль ему.
  reassignHostIfNeeded(room);
  conn.roomId = room.id;
  conn.playerId = player.id;
  conn.tgUserId = auth.tgUserId;
  conn.send({ type: "joined", roomId: room.id, playerId: player.id });
  sendState(room.id);
}

function getRoomAndPlayer(conn: Conn): { room: RoomState; p: ReturnType<typeof findPlayer> } | null {
  if (!conn.roomId || !conn.playerId) return null;
  const room = getRoom(conn.roomId);
  if (!room) return null;
  const p = findPlayer(room, conn.playerId);
  if (!p) return null;
  return { room, p };
}

function findPlayer(room: RoomState, playerId: string) {
  return room.players.find((p) => p.id === playerId) ?? null;
}

function handleReady(conn: Conn): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  ctx.p.ready = !ctx.p.ready;
  reassignHostIfNeeded(ctx.room);
  sendState(ctx.room.id);
}

function handleStart(conn: Conn): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  // Любой подключённый игрок может стартовать (чтобы не блокировал offline-хост).
  if (!ctx.p.connected) {
    conn.send({ type: "error", message: "you are offline" });
    return;
  }
  if (!startGame(ctx.room)) {
    conn.send({ type: "error", message: "need 2+ ready connected players" });
    return;
  }
  onStateChange(ctx.room);
  sendState(ctx.room.id);
}

function handleRoll(conn: Conn): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  if (ctx.room.players[ctx.room.currentTurn].id !== ctx.p.id) {
    conn.send({ type: "error", message: "not your turn" });
    return;
  }
  const result = rollAndMove(ctx.room);
  if (!result) {
    conn.send({ type: "error", message: "can't roll now" });
    return;
  }
  broadcast(ctx.room.id, {
    type: "diceRolled",
    by: ctx.p.id,
    dice: result.dice,
    speedDie: result.speedDie,
    from: result.from,
    to: result.to,
  });
  sendState(ctx.room.id);
  onStateChange(ctx.room);
}

function handleBuy(conn: Conn): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx) return;
  if (!buyCurrentProperty(ctx.room)) {
    conn.send({ type: "error", message: "can't buy" });
    return;
  }
  sendState(ctx.room.id);
}

function handleSkipBuy(conn: Conn): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx) return;
  skipBuy(ctx.room);
  sendState(ctx.room.id);
}

function handleEndTurn(conn: Conn): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  if (ctx.room.players[ctx.room.currentTurn].id !== ctx.p.id) {
    conn.send({ type: "error", message: "not your turn" });
    return;
  }
  if (!endTurn(ctx.room)) {
    conn.send({ type: "error", message: "can't end turn now" });
    return;
  }
  sendState(ctx.room.id);
  onStateChange(ctx.room);
}

function handleChat(conn: Conn, text: string): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  const clean = text.trim().slice(0, 200);
  if (!clean) return;
  broadcast(ctx.room.id, { type: "chat", from: ctx.p.name, fromId: ctx.p.id, text: clean, ts: Date.now() });
}

function handleSelectToken(conn: Conn, tokenId: string): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  if (selectToken(ctx.room, ctx.p.id, tokenId)) {
    sendState(ctx.room.id);
  }
}

function handleLeave(conn: Conn): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  if (ctx.room.phase === "lobby") {
    removePlayer(ctx.room, ctx.p.id);
  } else if (ctx.room.phase !== "ended") {
    leaveActiveGame(ctx.room, ctx.p.id);
  }
  sendState(ctx.room.id);
  conn.roomId = null;
  conn.playerId = null;
}
