import type { RoomState, ServerMessage } from "../../../shared/types";
import { BOARD } from "../../../shared/board";
import { config } from "../config";
import { notifyTurn } from "../telegram";
import {
  currentPlayer,
  endTurn as engineEndTurn,
  passAuction,
  payJailFine,
  preRollCurrentPlayer,
  resolveTrade,
  rollAndMove,
  rollForOrder,
  skipBuy,
} from "../game/engine";

// Bots move fast so 2+1 or 2+2 human-vs-bot games stay snappy.
const BOT_TURN_DELAY_MS = 2500;
// Auction bidding cadence — slightly faster than a full turn so an
// all-bot auction doesn't drag, but not instant so humans can read
// the bidding war.
const BOT_AUCTION_DELAY_MS = 1200;
// Delay before a bot accepts/declines a trade — long enough that the
// human reads the trade banner ("Bot Alfred is thinking…") so the
// outcome doesn't feel like a no-op, short enough to not stall a
// motivated trader.
const BOT_TRADE_DELAY_MS = 1500;

const rooms = new Map<string, RoomState>();
const turnTimers = new Map<string, NodeJS.Timeout>();
// Separate timer for non-current bots in an auction. The regular
// turnTimer only ticks for `currentPlayer`; an auction can stretch
// across multiple bots who aren't the current turn — each needs to be
// nudged into placing a bid or passing, otherwise the auction freezes.
const auctionTimers = new Map<string, NodeJS.Timeout>();
// Wall-clock deadline for the auction itself. Without this, an auction
// sits indefinitely if every active bidder is a human and nobody bids
// — playtester 2026-05-07 «нужно сделать таймер аукциона». Fires when
// AuctionState.deadline elapses, force-passes all non-leading active
// players to trigger engine.maybeEndAuction.
const auctionDeadlineTimers = new Map<string, NodeJS.Timeout>();
// Pending bot-trade resolve timers, one per room. We dedup so a fast
// chain of state changes (which all re-enter onStateChange) doesn't
// pile up multiple resolves for the same pendingTrade.
const tradeTimers = new Map<string, NodeJS.Timeout>();
const notifiedTurns = new Map<string, string>();

// Broadcasters are injected by the WS server on startup so the bot-turn
// timer can push `diceRolled` + `state` to clients. Without these, the bot
// would mutate state silently and the client would stall on "Ход Bot X".
let broadcastMsg: ((roomId: string, msg: ServerMessage) => void) | null = null;
let broadcastState: ((roomId: string) => void) | null = null;

export function registerBroadcasters(
  msg: (roomId: string, m: ServerMessage) => void,
  state: (roomId: string) => void,
): void {
  broadcastMsg = msg;
  broadcastState = state;
}

export function saveRoom(room: RoomState): void {
  rooms.set(room.id, room);
}

export function getRoom(id: string): RoomState | null {
  return rooms.get(id) ?? null;
}

export function deleteRoom(id: string): void {
  rooms.delete(id);
  const t = turnTimers.get(id);
  if (t) clearTimeout(t);
  turnTimers.delete(id);
  const at = auctionTimers.get(id);
  if (at) clearTimeout(at);
  auctionTimers.delete(id);
  const ad = auctionDeadlineTimers.get(id);
  if (ad) clearTimeout(ad);
  auctionDeadlineTimers.delete(id);
  const tt = tradeTimers.get(id);
  if (tt) clearTimeout(tt);
  tradeTimers.delete(id);
  notifiedTurns.delete(id);
}

export function allRooms(): RoomState[] {
  return [...rooms.values()];
}

/**
 * Проверяет, сменился ли текущий игрок — если да, пушит уведомление через бота.
 * Вызывается после каждого применённого изменения состояния.
 */
export function onStateChange(room: RoomState): void {
  if (room.phase === "lobby" || room.phase === "ended") {
    clearTurnTimer(room.id);
    room.turnDeadline = null;
    return;
  }

  // Nobody real is watching — freeze the turn timer and skip push
  // notifications. The room survives in memory for reconnects; if anyone
  // comes back we call onStateChange again and pick up where we left off.
  // Without this, a deserted room would keep pinging "your turn" forever
  // and bots would pointlessly cycle state.
  const anyHumanOnline = room.players.some((p) => p.connected && !p.isBot);
  if (!anyHumanOnline) {
    clearTurnTimer(room.id);
    room.turnDeadline = null;
    clearAuctionTimer(room.id);
    return;
  }

  // Trade targeted at a bot: schedule a delayed accept/decline so the
  // human briefly sees the trade banner, then broadcast the resolution.
  // The earlier synchronous resolve fired before the WS handler had a
  // chance to broadcast the pendingTrade snapshot — clients never saw
  // the trade resolve, banner hung forever («обмен с ботами не работает»).
  if (room.pendingTrade) {
    const target = room.players.find((pl) => pl.id === room.pendingTrade!.toId);
    if (target?.isBot) scheduleBotTradeResolve(room, target.id);
  }

  // Auction running with non-current bots in the bidder list?
  // Schedule the next bot to act so the auction doesn't freeze on
  // bots that aren't `currentPlayer` — the regular turnTimer only
  // ticks for the current turn, and an auction stretches across
  // every non-bankrupt player.
  if (room.auction && room.phase === "auction") {
    scheduleAuctionBotTick(room);
    scheduleAuctionDeadlineTick(room);
  } else {
    clearAuctionTimer(room.id);
    clearAuctionDeadlineTimer(room.id);
  }

  // Pre-roll: current roller lives in the first bracket's pending queue, not
  // room.currentTurn. Always reset the timer — every roll hands off to the
  // next player, so there's no "same turn continues" case to skip.
  if (room.phase === "preRoll") {
    const roller = preRollCurrentPlayer(room);
    if (!roller) return;
    notifiedTurns.set(room.id, roller.id);
    resetTurnTimer(room);
    return;
  }

  const p = currentPlayer(room);
  if (!p) return;

  const prev = notifiedTurns.get(room.id);
  if (prev !== p.id) {
    notifiedTurns.set(room.id, p.id);
    // Push notification for any real human who isn't actively looking
    // at the app — either fully disconnected (WS dropped) OR the WebApp
    // is backgrounded (visibilitychange → hidden, p.foreground=false).
    // The earlier `!p.connected` gate missed the backgrounded case
    // because Telegram keeps the WS alive when the user swipes away,
    // so playtesters stopped getting "ваш ход" pings on minimised
    // sessions even though they used to. Bots are skipped — their
    // synthetic tgUserIds would 400 on the bot push API.
    const inForeground = p.foreground !== false;
    if (!p.isBot && (!p.connected || !inForeground)) {
      notifyTurn(p.tgUserId, room.id, p.name);
    }
    resetTurnTimer(room);
  } else if (
    (!p.connected || p.isBot)
    && (room.phase === "rolling" || room.phase === "buyPrompt" || room.phase === "action")
  ) {
    // currentTurn didn't change but the bot still has work to do — and
    // the original turn timer has already fired and exited. Cases:
    //   - rolling: doubles bonus turn, bot needs to auto-roll again.
    //   - action: bot started an auction during its turn, the auction
    //     finished out-of-band via a human's bid/pass, phase flipped
    //     back to action, and engineEndTurn never ran. Without this
    //     re-arm the room freezes with the bot still marked as
    //     currentPlayer in phase=action.
    //   - buyPrompt: defensive — same shape if a human action ever
    //     leaves the bot mid-buyPrompt.
    // auction phase is handled by scheduleAuctionBotTick above.
    resetTurnTimer(room);
  }
}

function resetTurnTimer(room: RoomState): void {
  clearTurnTimer(room.id);
  const current =
    room.phase === "preRoll" ? preRollCurrentPlayer(room) : currentPlayer(room);
  // Bots act almost immediately. Connected humans get the per-room
  // turnTimeoutSec (default 180s). Disconnected humans get DOUBLE the
  // grace before AI takes over their turn — playtester 2026-05-07
  // «крит — блокировка экрана банкротит игрока». Brief screen lock
  // (phone fade-out, swipe to chat) shouldn't lose them a tile to a
  // mistimed AI auction bid. Tradeoff: longer pause for the rest of
  // the table when someone genuinely walks away, but a one-step AI
  // bankruptcy is far worse than a 3-min wait.
  const baseDelayMs = config.turnTimeoutSec * 1000;
  const humanDelay = current?.connected ? baseDelayMs : baseDelayMs * 2;
  const delay = current?.isBot ? BOT_TURN_DELAY_MS : humanDelay;
  // Stamp the wall-clock deadline so the client can render a countdown
  // next to "ВАШ ХОД!" — bots get such a tight delay (≈800ms) that
  // there's no point showing a timer for them, so we skip those.
  const newDeadline = current?.isBot ? null : Date.now() + delay;
  if (room.turnDeadline !== newDeadline) {
    room.turnDeadline = newDeadline;
    // The upstream WS handler already broadcast the state with the
    // OLD deadline before invoking onStateChange (which called us).
    // Push another broadcast so the client's countdown picks up the
    // new value immediately — without this the timer drifts by a
    // whole turn cycle. Cheap; only fires when the deadline actually
    // changed.
    if (broadcastState) broadcastState(room.id);
  }
  const timer = setTimeout(async () => {
    const fresh = getRoom(room.id);
    if (!fresh) return;

    // Pre-roll branch: auto-roll for whichever player is up. Same semantics as
    // the in-game timeout — bots act fast, AFK humans get the full grace period.
    if (fresh.phase === "preRoll") {
      const roller = preRollCurrentPlayer(fresh);
      if (!roller) return;
      const result = rollForOrder(fresh);
      if (result && broadcastMsg) {
        broadcastMsg(fresh.id, {
          type: "diceRolled",
          by: roller.id,
          dice: result.dice,
          from: roller.position,
          to: roller.position,
        });
      }
      if (broadcastState) broadcastState(fresh.id);
      onStateChange(fresh);
      return;
    }

    const p = currentPlayer(fresh);
    if (!p) return;

    // Bots always auto-act; humans only when offline.
    const aiMode = !p.connected || !!p.isBot;

    // Bots pay the jail fine if they can afford it rather than sitting
    // and eventually going bankrupt.
    if (aiMode && p.inJail && p.cash >= 50 && p.getOutCards.length === 0) {
      payJailFine(fresh, p.id);
    }

    if (fresh.phase === "rolling") {
      const rollRes = rollAndMove(fresh);
      // Broadcast diceRolled so clients animate the token walk exactly like
      // they do for human rolls. Without this the bot silently teleports.
      if (rollRes && broadcastMsg) {
        broadcastMsg(fresh.id, {
          type: "diceRolled",
          by: p.id,
          dice: rollRes.dice,
          from: rollRes.from,
          to: rollRes.to,
        });
      }
    }
    if (fresh.phase === "buyPrompt") {
      const { BOARD } = await import("../../../shared/board");
      const tile = BOARD[p.position];
      const price = (tile as any).price ?? 0;
      if (aiMode && price > 0 && p.cash >= price * 1.5) {
        const { buyCurrentProperty } = await import("../game/engine");
        buyCurrentProperty(fresh);
      } else {
        skipBuy(fresh);
      }
    }

    // Bots bid in auctions instead of always passing — otherwise a bot
    // that declines to buy effectively gifts every tile to the human for
    // free. Willingness is 50-85% of tile price, capped so the bot keeps
    // a $300 reserve for rents + jail fines.
    //
    // Disconnected HUMANS (screen lock, signal drop) just pass — bidding
    // on their behalf risks burning cash they can't actively defend.
    // Playtester 2026-05-07 «блокировка экрана банкротит игрока»: the
    // AI takeover used to bid aggressively on Boardwalk for a player
    // who'd just stepped away.
    if (aiMode && fresh.auction && !fresh.auction.passedIds.includes(p.id) && p.isBot) {
      const { placeBid: engPlaceBid } = await import("../game/engine");
      const a = fresh.auction;
      const tile = BOARD[a.tileIndex];
      const price = (tile as { price?: number }).price ?? 0;
      const reserve = 300;
      const willingness = Math.floor(price * (0.5 + Math.random() * 0.35));
      const affordable = Math.max(0, p.cash - reserve);
      const myCap = Math.min(willingness, affordable);
      const nextBid = a.highBid + Math.floor(10 + Math.random() * 20);
      if (myCap > 0 && nextBid > a.highBid && nextBid <= myCap && a.highBidderId !== p.id) {
        engPlaceBid(fresh, p.id, nextBid);
      } else {
        passAuction(fresh, p.id);
      }
    }

    // AI: если есть монополии и деньги — строим дом на самой дешёвой улице без построек.
    if (aiMode) {
      await aiAutoBuild(fresh, p.id);
    }

    if (fresh.phase === "action") {
      engineEndTurn(fresh);
    }
    // Push the final state so the client sees the bot's purchases, builds,
    // and turn handoff. Done AFTER all mutations but BEFORE onStateChange so
    // the next timer's resetTurnTimer sees a stable broadcast baseline.
    if (broadcastState) broadcastState(fresh.id);
    onStateChange(fresh);
  }, delay);
  turnTimers.set(room.id, timer);
}

async function aiAutoBuild(room: RoomState, playerId: string): Promise<void> {
  const { BOARD, GROUP_SIZE } = await import("../../../shared/board");
  const { buildHouse } = await import("../game/engine");
  const p = room.players.find((pl) => pl.id === playerId);
  if (!p) return;

  // Улицы, где у нас полная монополия, сортируем по стоимости дома (дешёвле — раньше)
  const myStreets = BOARD.filter(
    (t) => t.kind === "street" && room.properties[t.index]?.ownerId === playerId,
  ) as any[];

  // Группируем по цвету
  const byGroup = new Map<string, any[]>();
  for (const s of myStreets) {
    const arr = byGroup.get(s.group) ?? [];
    arr.push(s);
    byGroup.set(s.group, arr);
  }

  const monopolies: any[] = [];
  for (const [group, list] of byGroup) {
    if (list.length === (GROUP_SIZE[group] ?? 0)) monopolies.push(...list);
  }

  monopolies.sort((a, b) => a.houseCost - b.houseCost);

  // Строим пока хватает денег, оставляя запас $300
  for (const street of monopolies) {
    if (p.cash < street.houseCost + 300) break;
    const res = buildHouse(room, playerId, street.index);
    if (!res.ok) continue;
  }
}

function clearTurnTimer(roomId: string): void {
  const t = turnTimers.get(roomId);
  if (t) clearTimeout(t);
  turnTimers.delete(roomId);
}

function clearAuctionTimer(roomId: string): void {
  const t = auctionTimers.get(roomId);
  if (t) clearTimeout(t);
  auctionTimers.delete(roomId);
}

function clearAuctionDeadlineTimer(roomId: string): void {
  const t = auctionDeadlineTimers.get(roomId);
  if (t) clearTimeout(t);
  auctionDeadlineTimers.delete(roomId);
}

/**
 * Wall-clock auction deadline. When room.auction.deadline elapses, we
 * force-pass every active bidder who isn't the high bidder so engine.
 * maybeEndAuction resolves the auction in favour of the leader (or with
 * no winner if there were zero bids). Re-armed on every onStateChange
 * so a fresh bid that pushed the deadline forward extends the timer.
 */
function scheduleAuctionDeadlineTick(room: RoomState): void {
  if (!room.auction || !room.auction.deadline) {
    clearAuctionDeadlineTimer(room.id);
    return;
  }
  const ms = Math.max(0, room.auction.deadline - Date.now());
  clearAuctionDeadlineTimer(room.id);
  const timer = setTimeout(async () => {
    auctionDeadlineTimers.delete(room.id);
    const fresh = getRoom(room.id);
    if (!fresh || !fresh.auction) return;
    if (fresh.phase !== "auction") return;
    // Deadline drifted forward (a fresh bid arrived) — re-arm instead
    // of resolving on the stale schedule.
    if (fresh.auction.deadline && fresh.auction.deadline > Date.now() + 50) {
      scheduleAuctionDeadlineTick(fresh);
      return;
    }
    const a = fresh.auction;
    // Force-pass every still-in player except the current leader. With
    // only the leader left active engine.maybeEndAuction finishes the
    // auction in their favour. If there's no leader (no bids at all),
    // passing the last active player triggers the no-winner branch.
    for (const p of fresh.players) {
      if (p.bankrupt) continue;
      if (a.passedIds.includes(p.id)) continue;
      if (a.highBidderId === p.id) continue;
      passAuction(fresh, p.id);
      // passAuction may have ended the auction mid-loop — bail out.
      if (!fresh.auction || fresh.phase !== "auction") break;
    }
    if (broadcastState) broadcastState(fresh.id);
    onStateChange(fresh);
  }, ms);
  auctionDeadlineTimers.set(room.id, timer);
}

function clearTradeTimer(roomId: string): void {
  const t = tradeTimers.get(roomId);
  if (t) clearTimeout(t);
  tradeTimers.delete(roomId);
}

/**
 * Bot is the recipient of a pending trade — schedule a delayed
 * accept/decline so the human briefly sees the trade banner. After the
 * bot resolves we MUST broadcast state ourselves: the WS handler that
 * triggered onStateChange already sent its sendState BEFORE we got
 * here, so the post-resolve mutation never reaches clients otherwise.
 *
 * Idempotent — re-entry while a timer is already armed for the same
 * pending trade is a no-op.
 */
function scheduleBotTradeResolve(room: RoomState, botId: string): void {
  if (tradeTimers.has(room.id)) return;
  const timer = setTimeout(async () => {
    tradeTimers.delete(room.id);
    const fresh = getRoom(room.id);
    if (!fresh || !fresh.pendingTrade) return;
    if (fresh.pendingTrade.toId !== botId) return;
    const accept = botShouldAcceptTrade(fresh, botId);
    resolveTrade(fresh, botId, accept);
    if (broadcastState) broadcastState(fresh.id);
    onStateChange(fresh);
  }, BOT_TRADE_DELAY_MS);
  tradeTimers.set(room.id, timer);
}

/**
 * Pick the next bot in the auction's active bidder list that needs to
 * act (i.e. isn't already the high bidder, isn't passed, isn't
 * bankrupt) and arm a single setTimeout to bid or pass on its behalf.
 *
 * After the bot acts we broadcast state, which feeds back into
 * `onStateChange` and re-arms this scheduler — chained handoff that
 * naturally walks every bot in the bidder pool until one of these
 * exits is hit:
 *   - a human is now expected to bid (we pause; placeBid/passAuction
 *     from the human triggers the next onStateChange and we resume),
 *   - only the high bidder remains active → engine.maybeEndAuction
 *     finishes the auction.
 *
 * Idempotent: replaces any existing auction timer for the room.
 */
function scheduleAuctionBotTick(room: RoomState): void {
  if (!room.auction) {
    clearAuctionTimer(room.id);
    return;
  }
  const a = room.auction;
  const candidate = room.players.find(
    (p) =>
      p.isBot
      && !p.bankrupt
      && !a.passedIds.includes(p.id)
      && a.highBidderId !== p.id,
  );
  if (!candidate) {
    // Either the high bidder is the only active bidder (engine will
    // finish the auction), or only humans are left to act. Either way
    // the bot tick has nothing to do.
    clearAuctionTimer(room.id);
    return;
  }

  clearAuctionTimer(room.id);
  const timer = setTimeout(async () => {
    const fresh = getRoom(room.id);
    if (!fresh || !fresh.auction) return;
    const auction = fresh.auction;
    const bot = fresh.players.find((p) => p.id === candidate.id);
    if (!bot || bot.bankrupt) return;
    if (auction.passedIds.includes(bot.id)) return;
    if (auction.highBidderId === bot.id) return;

    // Same bidding heuristic as the in-turn auction branch: 50–85% of
    // tile price, capped to keep a $300 reserve.
    const tile = BOARD[auction.tileIndex];
    const price = (tile as { price?: number }).price ?? 0;
    const reserve = 300;
    const willingness = Math.floor(price * (0.5 + Math.random() * 0.35));
    const affordable = Math.max(0, bot.cash - reserve);
    const myCap = Math.min(willingness, affordable);
    const nextBid = auction.highBid + Math.floor(10 + Math.random() * 20);

    const { placeBid: engPlaceBid, passAuction: engPassAuction } = await import("../game/engine");
    if (myCap > 0 && nextBid > auction.highBid && nextBid <= myCap) {
      engPlaceBid(fresh, bot.id, nextBid);
    } else {
      engPassAuction(fresh, bot.id);
    }
    if (broadcastState) broadcastState(fresh.id);
    onStateChange(fresh);
  }, BOT_AUCTION_DELAY_MS);
  auctionTimers.set(room.id, timer);
}

/** Простая оценка входящего обмена глазами бота: принимаем если ценность того
 *  что получаем заметно выше того, что отдаём. Дома/отели на клетке плюсуют
 *  к её цене. Карточка "выйти из тюрьмы" оценена в $50 (стоимость штрафа). */
function botShouldAcceptTrade(room: RoomState, botId: string): boolean {
  const t = room.pendingTrade;
  if (!t || t.toId !== botId) return false;
  const bot = room.players.find((p) => p.id === botId);
  if (!bot) return false;
  // Бот не может отдать то, чего у него нет (на всякий — engine это тоже проверит).
  if (bot.cash < t.takeCash) return false;
  if (bot.getOutCards.length < t.takeJailCards) return false;

  const JAIL_CARD_VALUE = 50;

  function tileValue(idx: number): number {
    const tile = BOARD[idx];
    if (!tile) return 0;
    const base = (tile as { price?: number }).price ?? 0;
    const owned = room.properties[idx];
    if (owned?.hotel) return base + 5 * ((tile as { houseCost?: number }).houseCost ?? 0);
    if (owned?.houses) return base + owned.houses * ((tile as { houseCost?: number }).houseCost ?? 0);
    return base;
  }

  const botReceives =
    t.giveTiles.reduce((s, i) => s + tileValue(i), 0) + t.giveCash + t.giveJailCards * JAIL_CARD_VALUE;
  const botGives =
    t.takeTiles.reduce((s, i) => s + tileValue(i), 0) + t.takeCash + t.takeJailCards * JAIL_CARD_VALUE;

  // Accept any non-zero trade where the bot's haul covers the cost,
  // plus a $50 cushion so the bot doesn't take a strict-equal trade
  // (zero EV for the bot, only the human profits via inflated tile
  // values vs cash). The earlier 1.2× hurdle rejected nearly every
  // human-initiated trade, which playtesters read as «обмен с ботами
  // не работает».
  return botReceives >= botGives + 50 && botReceives > 0;
}
