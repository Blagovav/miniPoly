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

// Note: previous versions had a `sweepOfflineLobby` that aggressively
// removed any offline non-bot from the lobby on every sendState. That
// made the documented "3-second grace" meaningless — by the time the
// timer fired the player was long gone and a reconnect had to fall
// through the new-player branch in addPlayer. We dropped the sweep so
// offline humans persist in the players array (rendered as an
// "offline" chip on the client) for the full grace window. The
// timeout in the close handler is now the single source of truth for
// when an offline player actually leaves.
import { getRoom, onStateChange, registerBroadcasters, saveRoom } from "../rooms/manager";

interface Conn {
  send(msg: ServerMessage): void;
  roomId: string | null;
  playerId: string | null;
  tgUserId: number | null;
}

const connections = new Map<WebSocket, Conn>();

// Pending disconnect-grace timeouts, keyed by `roomId|playerId`. Without
// dedup, every reconnect/disconnect cycle on a flaky network would pile
// up a fresh setTimeout that lingers for the full grace window
// (3 min for lobby, 10 min for active match). They're all idempotent
// at fire time, but the queue grows unboundedly with reconnect storms
// — fix is to clear any prior timer for the same player before
// scheduling a new one.
const disconnectTimers = new Map<string, NodeJS.Timeout>();
const disconnectKey = (roomId: string, playerId: string) => `${roomId}|${playerId}`;

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
          // Lobby disconnect: keep the player in the array (rendered as
          // an offline chip on the client) for a 3-minute grace window
          // so they can reconnect and pick up where they left off —
          // metro tunnel, signal drop, app force-close, brief swipe to
          // check another chat, etc. After 3 min with no return, we
          // remove them and, if they were the last human, drop the
          // room from the Map so it stops zombying in
          // /api/rooms/public.
          //
          // The grace also covers a sneakier case: the
          // CreateView→RoomView route transition closes WS#1 mid-flight
          // while WS#2 spins up ~1.5 s later. As long as the timeout
          // hasn't fired, addPlayer's `existing` branch flips
          // connected=true and the room hums along.
          //
          // Active matches use a 10-min grace below — players have
          // more invested in an in-progress game and deserve longer to
          // come back.
          const LOBBY_GRACE_MS = 3 * 60 * 1000;
          // Dedup: if this player previously disconnected and we haven't
          // resolved that timer yet, cancel it before scheduling the new
          // one. Otherwise reconnect storms accumulate stale timers.
          const dKey = disconnectKey(roomId, playerId);
          const prevTimer = disconnectTimers.get(dKey);
          if (prevTimer) clearTimeout(prevTimer);
          if (room.phase === "lobby") {
            const t = setTimeout(() => {
              disconnectTimers.delete(dKey);
              const fresh = getRoom(roomId);
              if (!fresh || fresh.phase !== "lobby") return;
              const stale = fresh.players.find((pl) => pl.id === playerId);
              if (stale && !stale.connected) {
                removePlayer(fresh, stale.id);
                // Only AFTER we drop the lingering offline can we
                // decide if the lobby is truly abandoned.
                if (deleteIfAbandoned(fresh)) return;
                sendState(roomId);
              }
            }, LOBBY_GRACE_MS);
            disconnectTimers.set(dKey, t);
          } else if (room.phase !== "ended") {
            // Active match desertion: if every human stays gone for the
            // grace window, the room is just bots cycling state to no
            // audience — drop it from memory so it stops eating RAM and
            // pinging the bot-turn timer forever. 10 min is generous
            // enough for a player to lose signal, ride a metro, etc.
            // and come back without losing their progress.
            const ACTIVE_DESERTED_GRACE_MS = 10 * 60 * 1000;
            const t = setTimeout(() => {
              disconnectTimers.delete(dKey);
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
            disconnectTimers.set(dKey, t);
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
    case "wsForeground":
      return handleForeground(conn, msg.foreground);
    case "friendRequest":
      void handleFriendRequest(conn, msg.toUserId);
      return;
    case "friendRespond":
      void handleFriendRespond(conn, msg.requestId, msg.accept);
      return;
    default:
      conn.send({ type: "error", message: "unknown message" });
  }
}

function handleForeground(conn: Conn, foreground: boolean): void {
  if (!conn.roomId || !conn.playerId) return;
  const room = getRoom(conn.roomId);
  if (!room) return;
  const p = room.players.find((pl) => pl.id === conn.playerId);
  if (!p) return;
  if (p.foreground === foreground) return;
  p.foreground = foreground;
  // No state broadcast — foreground is a private signal that only
  // affects manager.ts's notifyTurn gating. Pushing it to peers would
  // trip an unnecessary re-render every visibility flip.
}

function sendToTgUser(tgUserId: number, msg: ServerMessage): boolean {
  for (const [ws, c] of connections) {
    if (c.tgUserId === tgUserId) {
      try {
        ws.send(JSON.stringify(msg));
        return true;
      } catch {
        /* noop */
      }
    }
  }
  return false;
}

// Look up a tg user's name in the players of any active room before
// hitting the DB. Avoids a Postgres round-trip on every friend
// request/response when both users are mid-game and visible in memory.
function nameForTgUser(tgUserId: number): string | null {
  for (const [, conn] of connections) {
    if (conn.tgUserId !== tgUserId || !conn.roomId || !conn.playerId) continue;
    const room = getRoom(conn.roomId);
    if (!room) continue;
    const p = room.players.find((pl) => pl.id === conn.playerId);
    if (p?.name) return p.name;
  }
  return null;
}

async function nameOrFetch(tgUserId: number): Promise<string> {
  const cached = nameForTgUser(tgUserId);
  if (cached) return cached;
  const { getUserProfile } = await import("../db");
  const p = await getUserProfile(tgUserId).catch(() => null);
  return p?.name ?? "Игрок";
}

async function handleFriendRequest(conn: Conn, toUserId: number): Promise<void> {
  if (!conn.tgUserId) {
    conn.send({ type: "error", message: "not authenticated" });
    return;
  }
  const fromUserId = conn.tgUserId;
  if (fromUserId === toUserId) {
    conn.send({ type: "error", message: "can't befriend yourself" });
    return;
  }
  const { createFriendRequest } = await import("../db");
  const res = await createFriendRequest(fromUserId, toUserId).catch(() => null);
  if (!res) {
    conn.send({ type: "error", message: "friend request failed" });
    return;
  }
  if (res.alreadyExisted) {
    if (res.status === "accepted") {
      conn.send({ type: "error", message: "already friends" });
    } else if (res.status === "pending") {
      conn.send({ type: "error", message: "request already pending" });
    } else {
      conn.send({ type: "error", message: "previous request was declined" });
    }
    return;
  }
  // Push to recipient if they're online — they get the modal banner
  // immediately. If they're offline, GET /api/users/:id/friends returns
  // their pending list on next app boot.
  const fromName = await nameOrFetch(fromUserId);
  sendToTgUser(toUserId, {
    type: "friendRequestIncoming",
    requestId: res.id,
    fromUserId,
    fromName,
  });
}

async function handleFriendRespond(
  conn: Conn,
  requestId: number,
  accept: boolean,
): Promise<void> {
  if (!conn.tgUserId) {
    conn.send({ type: "error", message: "not authenticated" });
    return;
  }
  const { respondFriendRequest } = await import("../db");
  const res = await respondFriendRequest(requestId, conn.tgUserId, accept).catch(
    () => ({ ok: false }) as Awaited<ReturnType<typeof respondFriendRequest>>,
  );
  if (!res.ok || !res.fromUserId || !res.toUserId) {
    conn.send({ type: "error", message: "respond failed" });
    return;
  }
  const responderName = await nameOrFetch(conn.tgUserId);
  const senderName = await nameOrFetch(res.fromUserId);
  const status: "accepted" | "declined" = accept ? "accepted" : "declined";
  // Tell the original sender how it went.
  sendToTgUser(res.fromUserId, {
    type: "friendStatusUpdate",
    otherUserId: conn.tgUserId,
    otherName: responderName,
    status,
  });
  // Echo back to the responder so their own UI flips immediately
  // (without round-tripping a fresh GET /friends).
  conn.send({
    type: "friendStatusUpdate",
    otherUserId: res.fromUserId,
    otherName: senderName,
    status,
  });
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
  return {
    tgUserId: auth.user.id,
    displayName: name || auth.user.first_name,
    photoUrl: auth.user.photo_url,
  };
}

function handleCreate(conn: Conn, msg: ClientMessage & { type: "create" }): void {
  const auth = authenticate(msg.tgInitData, msg.name);
  if (!auth) {
    conn.send({ type: "error", message: "auth failed" });
    return;
  }
  const room = createRoom("pending", msg.isPublic ?? true, msg.maxPlayers ?? 6);
  const player = addPlayer(room, auth.tgUserId, auth.displayName, auth.photoUrl);
  if (!player) {
    conn.send({ type: "error", message: "can't add player" });
    return;
  }
  room.hostId = player.id;
  // Designer feedback 2026-05-02 #3.8 — host is auto-ready from the moment
  // the room is created so canStart can flip true once a second player
  // joins, without the host needing a UI affordance they don't have.
  player.ready = true;
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
  const player = addPlayer(room, auth.tgUserId, auth.displayName, auth.photoUrl);
  if (!player) {
    conn.send({ type: "error", message: "can't join (full or already started)" });
    return;
  }
  // Новый игрок подключился — если хост оффлайн, передаём роль ему.
  reassignHostIfNeeded(room);
  conn.roomId = room.id;
  conn.playerId = player.id;
  conn.tgUserId = auth.tgUserId;
  // Cancel any pending disconnect-grace timer for this player —
  // they're back online, no need to fire the cleanup later.
  const dKey = disconnectKey(room.id, player.id);
  const pending = disconnectTimers.get(dKey);
  if (pending) {
    clearTimeout(pending);
    disconnectTimers.delete(dKey);
  }
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
  // Designer feedback 2026-05-02 #3.8 — host UI hides the ready toggle, so
  // a stray `ready` message from an old client should not flip them out of
  // ready. Server treats host as permanently ready while in lobby.
  if (ctx.p.id === ctx.room.hostId) {
    if (!ctx.p.ready) {
      ctx.p.ready = true;
      sendState(ctx.room.id);
    }
    return;
  }
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
  // Without onStateChange the auction-bot scheduler never re-arms after a
  // human raise — bots would just sit and never counter-bid, leaving the
  // human as last-bidder-by-default after the timer never advanced.
  onStateChange(ctx.room);
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
  onStateChange(ctx.room);
}

function handleSkipBuy(conn: Conn): void {
  const ctx = getRoomAndPlayer(conn);
  if (!ctx) return;
  skipBuy(ctx.room);
  sendState(ctx.room.id);
  // skipBuy on a property tile flips phase to "auction" and starts the
  // auction state. Without onStateChange the auction-bot scheduler is
  // never invoked, so when a human declines to buy, bots never wake up
  // to bid — auction stalls until the human bids or passes themselves.
  onStateChange(ctx.room);
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
  // Active-game leave advances currentTurn inside leaveActiveGame when the
  // leaver was the current player, but without onStateChange the bot/turn
  // timers never re-arm for the new current player — bots freeze, humans
  // see no "your turn" notification, and the room appears stalled to
  // everyone still in it. Same wake-up gap that hit the auction scheduler.
  onStateChange(ctx.room);
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
  // onStateChange auto-resolves any pendingTrade aimed at a bot. Without
  // this the bot would never react to a human's offer and the trade would
  // hang in pendingTrade forever.
  onStateChange(ctx.room);
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
  onStateChange(ctx.room);
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
