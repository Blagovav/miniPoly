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
  isLobbyAbandoned,
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
  rollForOrder,
  selectToken,
  sellHouse,
  skipBuy,
  startGame,
  unmortgageProperty,
  useGetOutCard,
} from "../game/engine";
import { deleteRoom as mgrDeleteRoom } from "../rooms/manager";

/**
 * Drop a lobby that no human can keep alive — empty, or bot-only after
 * the host left. Without this, the room would zombie around in
 * `/api/rooms/public` (playerCount: 0, hostName: "—") because the WS
 * close handler only removes the player, not the room.
 *
 * Returns true when the room was actually deleted, so callers can skip
 * a now-pointless `sendState` broadcast.
 */
function deleteIfAbandoned(room: RoomState): boolean {
  if (!isLobbyAbandoned(room)) return false;
  voiceRooms.delete(room.id);
  mgrDeleteRoom(room.id);
  return true;
}

/** Чистит всех offline-игроков из лобби. Вызывается перед каждым broadcast.
 *  Ботов не трогаем — у них `connected: false` намеренно (у бота нет своего
 *  WS), и sweep иначе мгновенно выметал их сразу после addBot — кнопка
 *  "Добавить бота" выглядела как ничего не делающая. */
function sweepOfflineLobby(room: RoomState): void {
  if (room.phase !== "lobby") return;
  const offline = room.players.filter((p) => !p.connected && !p.isBot);
  for (const p of offline) removePlayer(room, p.id);
}
import { getRoom, onStateChange, registerBroadcasters, saveRoom } from "../rooms/manager";

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

  // Let the room manager push messages + state from its bot-turn timer.
  registerBroadcasters(broadcast, sendState);

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
          // CRITICAL: the grace window is what makes Create→Room work.
          // When the user clicks "Создать" the host's WS#1 (CreateView)
          // closes during the route transition — within 1.5 s the new
          // RoomView spins up WS#2 and re-joins. If we deleted the room
          // synchronously here, WS#2 would land on "room not found" and
          // the client would show the "Партия завершена" modal.
          if (room.phase === "lobby") {
            setTimeout(() => {
              const fresh = getRoom(roomId);
              if (!fresh || fresh.phase !== "lobby") return;
              const stale = fresh.players.find((pl) => pl.id === playerId);
              if (stale && !stale.connected) {
                removePlayer(fresh, stale.id);
                // Now (and ONLY now, after the grace window) we can
                // decide if the lobby is truly abandoned. If yes, drop
                // the room from the Map so it stops zombying in
                // /api/rooms/public; otherwise broadcast the trimmed
                // state to whoever's still in.
                if (deleteIfAbandoned(fresh)) return;
                sendState(roomId);
              }
            }, 3000);
          } else if (room.phase !== "ended") {
            // Active match desertion: if every human stays gone for the
            // grace window, the room is just bots cycling state to no
            // audience — drop it from memory so it stops eating RAM and
            // pinging the bot-turn timer forever. 10 min is generous
            // enough for a player to lose signal, ride a metro, etc.
            // and come back without losing their progress.
            const ACTIVE_DESERTED_GRACE_MS = 10 * 60 * 1000;
            setTimeout(() => {
              const fresh = getRoom(roomId);
              if (!fresh) return;
              if (fresh.phase === "lobby" || fresh.phase === "ended") return;
              const anyHumanOnline = fresh.players.some(
                (pl) => pl.connected && !pl.isBot,
              );
              if (anyHumanOnline) return;
              voiceRooms.delete(roomId);
              mgrDeleteRoom(roomId);
            }, ACTIVE_DESERTED_GRACE_MS);
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
      return handleProposeTrade(conn, {
        toId: msg.toId,
        giveTiles: msg.giveTiles,
        giveCash: msg.giveCash,
        giveJailCards: msg.giveJailCards,
        takeTiles: msg.takeTiles,
        takeCash: msg.takeCash,
        takeJailCards: msg.takeJailCards,
      });
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

  // Pre-roll: the "current" player is the head of the first bracket's pending
  // queue, not room.players[currentTurn]. Reuse the `diceRolled` message with
  // from === to so clients animate the dice without moving tokens.
  if (ctx.room.phase === "preRoll") {
    const bracket = ctx.room.preRollBrackets[0];
    if (!bracket || bracket.pending[0] !== ctx.p.id) {
      conn.send({ type: "error", message: "not your turn to roll for order" });
      return;
    }
    const result = rollForOrder(ctx.room);
    if (!result) {
      conn.send({ type: "error", message: "can't roll now" });
      return;
    }
    broadcast(ctx.room.id, {
      type: "diceRolled",
      by: ctx.p.id,
      dice: result.dice,
      from: ctx.p.position,
      to: ctx.p.position,
    });
    sendState(ctx.room.id);
    onStateChange(ctx.room);
    return;
  }

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
  const wasLobby = ctx.room.phase === "lobby";
  if (wasLobby) {
    removePlayer(ctx.room, ctx.p.id);
  } else if (ctx.room.phase !== "ended") {
    leaveActiveGame(ctx.room, ctx.p.id);
  }
  // Explicit leave (player tapped the door button) is intent-to-quit,
  // not a transient disconnect — no grace period needed. If they were
  // the last human in the lobby, drop the room immediately so it
  // doesn't surface as a zombie in /api/rooms/public.
  if (wasLobby && deleteIfAbandoned(ctx.room)) {
    conn.roomId = null;
    conn.playerId = null;
    return;
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

function handleProposeTrade(
  conn: Conn,
  offer: {
    toId: string;
    giveTiles: number[];
    giveCash: number;
    giveJailCards: number;
    takeTiles: number[];
    takeCash: number;
    takeJailCards: number;
  },
): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx || !ctx.p) return;
  const res = proposeTrade(ctx.room, ctx.p.id, offer);
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
