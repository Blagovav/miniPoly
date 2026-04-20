import type { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import type { ClientMessage, ServerMessage, RoomState } from "../../../shared/types";
import { validateInitData } from "../telegram";
import {
  addBot,
  addPlayer,
  buildHouse,
  buyCurrentProperty,
  createRoom,
  endTurn,
  leaveActiveGame,
  mortgageProperty,
  passAuction,
  payJailFine,
  placeBid,
  proposeTrade,
  reassignHostIfNeeded,
  removePlayer,
  resolveTrade,
  rollAndMove,
  selectToken,
  sellHouse,
  skipBuy,
  startGame,
  unmortgageProperty,
  useGetOutCard,
} from "../game/engine";
import { deleteRoom as mgrDeleteRoom } from "../rooms/manager";

/** Чистит всех offline-игроков из лобби. Вызывается перед каждым broadcast.
 *  Ботов не трогаем — у них `connected: false` намеренно (у бота нет своего
 *  WS), и sweep иначе мгновенно выметал их сразу после addBot — кнопка
 *  "Добавить бота" выглядела как ничего не делающая. */
function sweepOfflineLobby(room: RoomState): void {
  if (room.phase !== "lobby") return;
  const offline = room.players.filter((p) => !p.connected && !p.isBot);
  for (const p of offline) removePlayer(room, p.id);
}
import { getRoom, onStateChange, saveRoom } from "../rooms/manager";

interface Conn {
  send(msg: ServerMessage): void;
  roomId: string | null;
  playerId: string | null;
  tgUserId: number | null;
}

const connections = new Map<WebSocket, Conn>();

// Voice-chat participants per room (playerId set). A player is in this set from
// the moment the client sends voiceJoin until voiceLeave (or disconnect).
const voiceRooms = new Map<string, Set<string>>();

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

function sendToPlayer(roomId: string, playerId: string, msg: ServerMessage): void {
  for (const [ws, conn] of connections) {
    if (conn.roomId === roomId && conn.playerId === playerId) {
      try {
        ws.send(JSON.stringify(msg));
      } catch {
        /* noop */
      }
      return;
    }
  }
}

function leaveVoice(roomId: string, playerId: string): void {
  const set = voiceRooms.get(roomId);
  if (!set || !set.has(playerId)) return;
  set.delete(playerId);
  if (set.size === 0) voiceRooms.delete(roomId);
  broadcast(roomId, { type: "voicePeerLeft", peerId: playerId });
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
        leaveVoice(roomId, playerId);
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
          // Re-run state evaluation so the turn timer freezes immediately
          // when the last human leaves (instead of waiting for the next
          // turn change to notice nobody's watching).
          onStateChange(room);
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
    case "destroyRoom":
      return handleDestroyRoom(conn);
    case "buildHouse":
      return handleBuildHouse(conn, msg.tileIndex);
    case "sellHouse":
      return handleSellHouse(conn, msg.tileIndex);
    case "proposeTrade":
      return handleProposeTrade(conn, msg.tileIndex, msg.cash);
    case "respondTrade":
      return handleRespondTrade(conn, msg.accept);
    case "mortgage":
      return handleMortgage(conn, msg.tileIndex);
    case "unmortgage":
      return handleUnmortgage(conn, msg.tileIndex);
    case "placeBid":
      return handlePlaceBid(conn, msg.amount);
    case "passAuction":
      return handlePassAuction(conn);
    case "addBot":
      return handleAddBot(conn);
    case "removeBot":
      return handleRemoveBot(conn, msg.playerId);
    case "payJail":
      return handlePayJail(conn);
    case "useJailCard":
      return handleUseJailCard(conn);
    case "voiceJoin":
      return handleVoiceJoin(conn);
    case "voiceLeave":
      return handleVoiceLeave(conn);
    case "voiceSignal":
      return handleVoiceSignal(conn, msg.toId, msg.payload);
    default:
      conn.send({ type: "error", message: "unknown message" });
  }
}

function handleVoiceJoin(conn: Conn): void {
  if (!conn.roomId || !conn.playerId) return;
  let set = voiceRooms.get(conn.roomId);
  if (!set) {
    set = new Set();
    voiceRooms.set(conn.roomId, set);
  }
  if (set.has(conn.playerId)) return;
  // Existing peers BEFORE we add ourselves — that's what the joiner sees.
  const existing = Array.from(set);
  set.add(conn.playerId);
  conn.send({ type: "voicePeers", peerIds: existing });
  // Notify everyone else (not the joiner) that a new peer is here.
  for (const [ws, c] of connections) {
    if (c.roomId === conn.roomId && c.playerId && c.playerId !== conn.playerId && set.has(c.playerId)) {
      try {
        ws.send(JSON.stringify({ type: "voicePeerJoined", peerId: conn.playerId }));
      } catch {
        /* noop */
      }
    }
  }
}

function handleVoiceLeave(conn: Conn): void {
  if (!conn.roomId || !conn.playerId) return;
  leaveVoice(conn.roomId, conn.playerId);
}

function handleVoiceSignal(conn: Conn, toId: string, payload: import("../../../shared/types").VoiceSignalPayload): void {
  if (!conn.roomId || !conn.playerId) return;
  const set = voiceRooms.get(conn.roomId);
  if (!set || !set.has(conn.playerId) || !set.has(toId)) return;
  sendToPlayer(conn.roomId, toId, { type: "voiceSignal", fromId: conn.playerId, payload });
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
  const room = createRoom("pending", msg.isPublic ?? true, msg.maxPlayers ?? 6);
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
    from: result.from,
    to: result.to,
  });
  sendState(ctx.room.id);
  onStateChange(ctx.room);
}

function handlePlaceBid(conn: Conn, amount: number): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  const res = placeBid(ctx.room, ctx.p.id, amount);
  if (!res.ok) {
    conn.send({ type: "error", message: res.error ?? "bid failed" });
    return;
  }
  sendState(ctx.room.id);
}

function handlePassAuction(conn: Conn): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  const res = passAuction(ctx.room, ctx.p.id);
  if (!res.ok) {
    conn.send({ type: "error", message: res.error ?? "pass failed" });
    return;
  }
  sendState(ctx.room.id);
  onStateChange(ctx.room);
}

function handleAddBot(conn: Conn): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) {
    conn.send({ type: "error", message: "not in a room" });
    return;
  }
  if (ctx.room.hostId !== ctx.p.id) {
    conn.send({ type: "error", message: "host only" });
    return;
  }
  const bot = addBot(ctx.room);
  if (!bot) {
    conn.send({ type: "error", message: "can't add bot (lobby full or game already started)" });
    return;
  }
  sendState(ctx.room.id);
}

function handleRemoveBot(conn: Conn, playerId: string): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  if (ctx.room.hostId !== ctx.p.id) {
    conn.send({ type: "error", message: "host only" });
    return;
  }
  if (ctx.room.phase !== "lobby") {
    conn.send({ type: "error", message: "only in lobby" });
    return;
  }
  const target = ctx.room.players.find((pl) => pl.id === playerId);
  if (!target || !target.isBot) {
    conn.send({ type: "error", message: "not a bot" });
    return;
  }
  removePlayer(ctx.room, playerId);
  sendState(ctx.room.id);
}

function handlePayJail(conn: Conn): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  const res = payJailFine(ctx.room, ctx.p.id);
  if (!res.ok) {
    conn.send({ type: "error", message: res.error ?? "can't pay jail fine" });
    return;
  }
  sendState(ctx.room.id);
  onStateChange(ctx.room);
}

function handleUseJailCard(conn: Conn): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  const res = useGetOutCard(ctx.room, ctx.p.id);
  if (!res.ok) {
    conn.send({ type: "error", message: res.error ?? "can't use jail card" });
    return;
  }
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
  leaveVoice(ctx.room.id, ctx.p.id);
  if (ctx.room.phase === "lobby") {
    removePlayer(ctx.room, ctx.p.id);
  } else if (ctx.room.phase !== "ended") {
    leaveActiveGame(ctx.room, ctx.p.id);
  }
  sendState(ctx.room.id);
  conn.roomId = null;
  conn.playerId = null;
}

function handleDestroyRoom(conn: Conn): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx) return;
  if (ctx.room.hostId !== conn.playerId) {
    conn.send({ type: "error", message: "only host can destroy room" });
    return;
  }
  const roomId = ctx.room.id;
  voiceRooms.delete(roomId);
  // шлём всем финальное состояние и удаляем комнату
  for (const [ws, c] of connections) {
    if (c.roomId === roomId) {
      try { ws.send(JSON.stringify({ type: "error", message: "room closed by host" })); } catch {}
      c.roomId = null;
      c.playerId = null;
    }
  }
  mgrDeleteRoom(roomId);
}

function handleBuildHouse(conn: Conn, tileIndex: number): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  const res = buildHouse(ctx.room, ctx.p.id, tileIndex);
  if (!res.ok) {
    conn.send({ type: "error", message: res.error ?? "can't build" });
    return;
  }
  sendState(ctx.room.id);
}

function handleSellHouse(conn: Conn, tileIndex: number): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  const res = sellHouse(ctx.room, ctx.p.id, tileIndex);
  if (!res.ok) {
    conn.send({ type: "error", message: res.error ?? "can't sell" });
    return;
  }
  sendState(ctx.room.id);
}

function handleProposeTrade(conn: Conn, tileIndex: number, cash: number): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  const res = proposeTrade(ctx.room, ctx.p.id, tileIndex, cash);
  if (!res.ok) {
    conn.send({ type: "error", message: res.error ?? "can't propose trade" });
    return;
  }
  sendState(ctx.room.id);
}

function handleRespondTrade(conn: Conn, accept: boolean): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  const res = resolveTrade(ctx.room, ctx.p.id, accept);
  if (!res.ok) {
    conn.send({ type: "error", message: res.error ?? "can't respond" });
    return;
  }
  sendState(ctx.room.id);
}

function handleMortgage(conn: Conn, tileIndex: number): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  const res = mortgageProperty(ctx.room, ctx.p.id, tileIndex);
  if (!res.ok) {
    conn.send({ type: "error", message: res.error ?? "can't mortgage" });
    return;
  }
  sendState(ctx.room.id);
}

function handleUnmortgage(conn: Conn, tileIndex: number): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  const res = unmortgageProperty(ctx.room, ctx.p.id, tileIndex);
  if (!res.ok) {
    conn.send({ type: "error", message: res.error ?? "can't unmortgage" });
    return;
  }
  sendState(ctx.room.id);
}
