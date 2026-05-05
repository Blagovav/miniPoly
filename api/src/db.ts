import pg from "pg";
import { config } from "./config";

const pool = new pg.Pool({ connectionString: config.databaseUrl });

export async function initDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      tg_user_id BIGINT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar TEXT,
      games_played INT NOT NULL DEFAULT 0,
      games_won INT NOT NULL DEFAULT 0,
      total_earned BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS match_history (
      id BIGSERIAL PRIMARY KEY,
      room_id TEXT NOT NULL,
      tg_user_id BIGINT NOT NULL,
      won BOOLEAN NOT NULL,
      cash_at_end INT NOT NULL,
      played_with BIGINT[] NOT NULL,
      ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_match_user ON match_history (tg_user_id);
    CREATE INDEX IF NOT EXISTS idx_match_ended ON match_history (ended_at DESC);

    CREATE TABLE IF NOT EXISTS stars_purchases (
      id BIGSERIAL PRIMARY KEY,
      tg_user_id BIGINT NOT NULL,
      item_id TEXT NOT NULL,
      stars INT NOT NULL,
      tg_payment_charge_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_purchases_user ON stars_purchases (tg_user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_charge ON stars_purchases (tg_payment_charge_id) WHERE tg_payment_charge_id IS NOT NULL;

    -- In-game friend network (independent of Telegram contacts). Direct
    -- consent flow: A sends, B accepts → status flips to 'accepted'.
    -- Pair uniqueness is enforced via an expression index over the
    -- ordered (lo, hi) tuple so A→B and B→A can't coexist.
    CREATE TABLE IF NOT EXISTS friend_requests (
      id BIGSERIAL PRIMARY KEY,
      from_user_id BIGINT NOT NULL,
      to_user_id BIGINT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      responded_at TIMESTAMPTZ,
      CHECK (from_user_id <> to_user_id)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uq_friend_pair ON friend_requests (
      LEAST(from_user_id, to_user_id),
      GREATEST(from_user_id, to_user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_friend_to_status ON friend_requests (to_user_id, status);
    CREATE INDEX IF NOT EXISTS idx_friend_from_status ON friend_requests (from_user_id, status);
  `);
}

export interface UserProfile {
  tgUserId: number;
  name: string;
  avatar: string | null;
  gamesPlayed: number;
  gamesWon: number;
  totalEarned: number;
  winRate: number; // 0..1
}

export async function upsertUser(tgUserId: number, name: string, avatar: string | null = null): Promise<void> {
  await pool.query(
    `INSERT INTO users (tg_user_id, name, avatar)
     VALUES ($1, $2, $3)
     ON CONFLICT (tg_user_id)
     DO UPDATE SET name = EXCLUDED.name, avatar = COALESCE(EXCLUDED.avatar, users.avatar), updated_at = NOW()`,
    [tgUserId, name, avatar],
  );
}

export async function getUserProfile(tgUserId: number): Promise<UserProfile | null> {
  const { rows } = await pool.query(
    `SELECT tg_user_id, name, avatar, games_played, games_won, total_earned
     FROM users WHERE tg_user_id = $1`,
    [tgUserId],
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    tgUserId: Number(r.tg_user_id),
    name: r.name,
    avatar: r.avatar,
    gamesPlayed: Number(r.games_played),
    gamesWon: Number(r.games_won),
    totalEarned: Number(r.total_earned),
    winRate: Number(r.games_played) > 0 ? Number(r.games_won) / Number(r.games_played) : 0,
  };
}

export async function recordMatch(args: {
  roomId: string;
  tgUserId: number;
  name: string;
  won: boolean;
  cashAtEnd: number;
  playedWith: number[];
}): Promise<void> {
  // Гарантируем существование юзера
  await upsertUser(args.tgUserId, args.name);
  // Инкрементим статистику
  await pool.query(
    `UPDATE users
     SET games_played = games_played + 1,
         games_won = games_won + $2,
         total_earned = total_earned + $3,
         updated_at = NOW()
     WHERE tg_user_id = $1`,
    [args.tgUserId, args.won ? 1 : 0, Math.max(0, args.cashAtEnd)],
  );
  await pool.query(
    `INSERT INTO match_history (room_id, tg_user_id, won, cash_at_end, played_with)
     VALUES ($1, $2, $3, $4, $5)`,
    [args.roomId, args.tgUserId, args.won, args.cashAtEnd, args.playedWith],
  );
}

export async function recordPurchase(args: {
  tgUserId: number;
  itemId: string;
  stars: number;
  tgPaymentChargeId: string;
}): Promise<void> {
  await pool.query(
    `INSERT INTO stars_purchases (tg_user_id, item_id, stars, tg_payment_charge_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tg_payment_charge_id) DO NOTHING`,
    [args.tgUserId, args.itemId, args.stars, args.tgPaymentChargeId],
  );
}

export async function getUserPurchases(tgUserId: number): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT item_id FROM stars_purchases WHERE tg_user_id = $1`,
    [tgUserId],
  );
  return rows.map((r) => r.item_id);
}

export interface MatchHistoryRow {
  id: number;
  roomId: string;
  endedAt: string;
  won: boolean;
  cashAtEnd: number;
  /** Names of every other player at the table (humans + bots), in row order. */
  opponentNames: string[];
  /** Their final cash, same order as opponentNames. Bot rows still come back
   *  here — recordMatch treats bots and humans identically. */
  opponentCash: number[];
  /** When neither side reached `won`, the engine never recorded the match,
   *  so by definition every row in this table HAS a winner. The flag is
   *  here for the UI's "не завершена" state which is derived elsewhere. */
}

/** History of a player's matches, newest first. Bots and humans are joined
 *  through the users table (every player — bot or not — gets upsertUser'd
 *  in recordMatch), so the opponent list shows real names instead of raw
 *  ids. Used by GET /api/users/:id/history. */
export async function getMatchHistory(
  tgUserId: number,
  limit = 50,
): Promise<MatchHistoryRow[]> {
  // The aggregate join: for each match row, look up names of every
  // other player at the table. ARRAY_AGG with FILTER skips ids missing
  // from users (shouldn't happen given recordMatch's upsert, but safe).
  const { rows } = await pool.query(
    `SELECT
       mh.id,
       mh.room_id,
       mh.ended_at,
       mh.won,
       mh.cash_at_end,
       COALESCE(
         (
           SELECT array_agg(u.name ORDER BY ord)
           FROM unnest(mh.played_with) WITH ORDINALITY AS pw(id, ord)
           LEFT JOIN users u ON u.tg_user_id = pw.id
         ),
         ARRAY[]::TEXT[]
       ) AS opponent_names,
       COALESCE(
         (
           SELECT array_agg(opp.cash_at_end ORDER BY pw.ord)
           FROM unnest(mh.played_with) WITH ORDINALITY AS pw(id, ord)
           LEFT JOIN match_history opp
             ON opp.room_id = mh.room_id AND opp.tg_user_id = pw.id
         ),
         ARRAY[]::INT[]
       ) AS opponent_cash
     FROM match_history mh
     WHERE mh.tg_user_id = $1
     ORDER BY mh.ended_at DESC
     LIMIT $2`,
    [tgUserId, limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    roomId: r.room_id,
    endedAt: r.ended_at instanceof Date ? r.ended_at.toISOString() : String(r.ended_at),
    won: !!r.won,
    cashAtEnd: Number(r.cash_at_end),
    opponentNames: (r.opponent_names ?? []) as string[],
    opponentCash: ((r.opponent_cash ?? []) as (number | null)[]).map((v) => Number(v ?? 0)),
  }));
}

// ───── Friend network ─────────────────────────────────────────────────

export interface FriendRequestRow {
  id: number;
  fromUserId: number;
  toUserId: number;
  status: "pending" | "accepted" | "declined";
  fromName: string | null;
  toName: string | null;
  createdAt: string;
}

/** Insert a pending request. Returns the row id, or null if a row for the
 *  same unordered pair already exists (in any state). Caller decides what
 *  to do — usually surface "уже отправлено" / "уже друзья". */
export async function createFriendRequest(
  fromUserId: number,
  toUserId: number,
): Promise<{ id: number; alreadyExisted: boolean; status: string } | null> {
  if (fromUserId === toUserId) return null;
  // Try insert. If the unique pair index trips, fetch the existing row so
  // we can tell the client whether it's pending / accepted / declined.
  try {
    const { rows } = await pool.query(
      `INSERT INTO friend_requests (from_user_id, to_user_id)
       VALUES ($1, $2)
       RETURNING id, status`,
      [fromUserId, toUserId],
    );
    return { id: Number(rows[0].id), alreadyExisted: false, status: rows[0].status };
  } catch (err: any) {
    if (err?.code !== "23505") throw err; // 23505 = unique_violation
    const { rows } = await pool.query(
      `SELECT id, status FROM friend_requests
       WHERE LEAST(from_user_id, to_user_id) = LEAST($1::bigint, $2::bigint)
         AND GREATEST(from_user_id, to_user_id) = GREATEST($1::bigint, $2::bigint)
       LIMIT 1`,
      [fromUserId, toUserId],
    );
    if (rows.length === 0) return null;
    return { id: Number(rows[0].id), alreadyExisted: true, status: rows[0].status };
  }
}

/** Respond to a pending request. Only the original `to_user_id` can accept
 *  or decline — anyone else gets {ok:false}. */
export async function respondFriendRequest(
  requestId: number,
  responderId: number,
  accept: boolean,
): Promise<{ ok: boolean; fromUserId?: number; toUserId?: number; status?: string }> {
  const status = accept ? "accepted" : "declined";
  const { rows } = await pool.query(
    `UPDATE friend_requests
     SET status = $3, responded_at = NOW()
     WHERE id = $1 AND to_user_id = $2 AND status = 'pending'
     RETURNING from_user_id, to_user_id, status`,
    [requestId, responderId, status],
  );
  if (rows.length === 0) return { ok: false };
  return {
    ok: true,
    fromUserId: Number(rows[0].from_user_id),
    toUserId: Number(rows[0].to_user_id),
    status: rows[0].status,
  };
}

/** Pending requests waiting on this user's response. Used to repopulate the
 *  banner on app boot if a request was sent while they were offline. */
export async function getIncomingFriendRequests(
  tgUserId: number,
): Promise<FriendRequestRow[]> {
  const { rows } = await pool.query(
    `SELECT fr.id, fr.from_user_id, fr.to_user_id, fr.status, fr.created_at,
            uf.name AS from_name, ut.name AS to_name
     FROM friend_requests fr
     LEFT JOIN users uf ON uf.tg_user_id = fr.from_user_id
     LEFT JOIN users ut ON ut.tg_user_id = fr.to_user_id
     WHERE fr.to_user_id = $1 AND fr.status = 'pending'
     ORDER BY fr.created_at DESC`,
    [tgUserId],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    fromUserId: Number(r.from_user_id),
    toUserId: Number(r.to_user_id),
    status: r.status,
    fromName: r.from_name,
    toName: r.to_name,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

/** All friends (accepted only). Returns `UserProfile` for each so the UI can
 *  render exactly like the existing coplayers list — same shape, same rows. */
export async function getFriends(tgUserId: number): Promise<UserProfile[]> {
  const { rows } = await pool.query(
    `SELECT u.tg_user_id, u.name, u.avatar, u.games_played, u.games_won, u.total_earned
     FROM friend_requests fr
     JOIN users u ON u.tg_user_id = CASE
       WHEN fr.from_user_id = $1 THEN fr.to_user_id ELSE fr.from_user_id
     END
     WHERE fr.status = 'accepted'
       AND $1 IN (fr.from_user_id, fr.to_user_id)
     ORDER BY u.name`,
    [tgUserId],
  );
  return rows.map((r) => ({
    tgUserId: Number(r.tg_user_id),
    name: r.name,
    avatar: r.avatar,
    gamesPlayed: Number(r.games_played),
    gamesWon: Number(r.games_won),
    totalEarned: Number(r.total_earned),
    winRate: Number(r.games_played) > 0 ? Number(r.games_won) / Number(r.games_played) : 0,
  }));
}

/** Status of A→B friendship from A's perspective: 'none' (no row),
 *  'pending-out' (A sent), 'pending-in' (B sent), 'accepted', 'declined'. */
export async function getFriendStatus(
  aUserId: number,
  bUserId: number,
): Promise<{ status: "none" | "pending-out" | "pending-in" | "accepted" | "declined"; requestId: number | null }> {
  const { rows } = await pool.query(
    `SELECT id, from_user_id, to_user_id, status FROM friend_requests
     WHERE LEAST(from_user_id, to_user_id) = LEAST($1::bigint, $2::bigint)
       AND GREATEST(from_user_id, to_user_id) = GREATEST($1::bigint, $2::bigint)
     LIMIT 1`,
    [aUserId, bUserId],
  );
  if (rows.length === 0) return { status: "none", requestId: null };
  const r = rows[0];
  if (r.status === "accepted") return { status: "accepted", requestId: Number(r.id) };
  if (r.status === "declined") return { status: "declined", requestId: Number(r.id) };
  // pending: which direction?
  if (Number(r.from_user_id) === aUserId) return { status: "pending-out", requestId: Number(r.id) };
  return { status: "pending-in", requestId: Number(r.id) };
}

/** Последние N соигроков — люди, с которыми недавно играл. */
export async function getRecentCoPlayers(tgUserId: number, limit = 20): Promise<UserProfile[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT u.tg_user_id, u.name, u.avatar, u.games_played, u.games_won, u.total_earned
     FROM match_history mh
     JOIN LATERAL unnest(mh.played_with) AS pw ON TRUE
     JOIN users u ON u.tg_user_id = pw
     WHERE mh.tg_user_id = $1 AND pw <> $1
     ORDER BY u.tg_user_id
     LIMIT $2`,
    [tgUserId, limit],
  );
  return rows.map((r) => ({
    tgUserId: Number(r.tg_user_id),
    name: r.name,
    avatar: r.avatar,
    gamesPlayed: Number(r.games_played),
    gamesWon: Number(r.games_won),
    totalEarned: Number(r.total_earned),
    winRate: Number(r.games_played) > 0 ? Number(r.games_won) / Number(r.games_played) : 0,
  }));
}

// ───── Admin dashboard queries ────────────────────────────────────────
// Read-only and tolerant of an empty/fresh DB — admin panel renders
// even before the first user signs in.

export interface AdminStats {
  totalUsers: number;
  newUsersToday: number;
  totalMatches: number;
  matchesToday: number;
  totalPurchases: number;
  purchasesToday: number;
  starsToday: number;
  starsTotal: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '24 hours') AS new_users_today,
      (SELECT COUNT(*) FROM match_history) AS total_matches,
      (SELECT COUNT(*) FROM match_history WHERE ended_at >= NOW() - INTERVAL '24 hours') AS matches_today,
      (SELECT COUNT(*) FROM stars_purchases) AS total_purchases,
      (SELECT COUNT(*) FROM stars_purchases WHERE created_at >= NOW() - INTERVAL '24 hours') AS purchases_today,
      (SELECT COALESCE(SUM(stars), 0) FROM stars_purchases WHERE created_at >= NOW() - INTERVAL '24 hours') AS stars_today,
      (SELECT COALESCE(SUM(stars), 0) FROM stars_purchases) AS stars_total
  `);
  const r = rows[0] ?? {};
  return {
    totalUsers: Number(r.total_users ?? 0),
    newUsersToday: Number(r.new_users_today ?? 0),
    totalMatches: Number(r.total_matches ?? 0),
    matchesToday: Number(r.matches_today ?? 0),
    totalPurchases: Number(r.total_purchases ?? 0),
    purchasesToday: Number(r.purchases_today ?? 0),
    starsToday: Number(r.stars_today ?? 0),
    starsTotal: Number(r.stars_total ?? 0),
  };
}

export interface AdminUserRow {
  tgUserId: number;
  name: string;
  gamesPlayed: number;
  gamesWon: number;
  createdAt: string;
  updatedAt: string;
}

export async function listAdminUsers(
  sort: "recent" | "active" | "wins" = "recent",
  limit = 50,
): Promise<AdminUserRow[]> {
  const orderBy =
    sort === "active" ? "updated_at DESC" :
    sort === "wins" ? "games_won DESC, games_played DESC" :
    "created_at DESC";
  const { rows } = await pool.query(
    `SELECT tg_user_id, name, games_played, games_won, created_at, updated_at
       FROM users
       ORDER BY ${orderBy}
       LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    tgUserId: Number(r.tg_user_id),
    name: r.name,
    gamesPlayed: Number(r.games_played),
    gamesWon: Number(r.games_won),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  }));
}

export interface AdminMatchRow {
  roomId: string;
  endedAt: string;
  winnerName: string | null;
  winnerId: number | null;
  playerCount: number;
}

export async function listAdminMatches(limit = 50): Promise<AdminMatchRow[]> {
  // Group rows by room (each match writes one row per player). Pick the
  // winner's id+name for the headline; player count is the row count.
  const { rows } = await pool.query(
    `SELECT
       mh.room_id,
       MAX(mh.ended_at) AS ended_at,
       MAX(CASE WHEN mh.won THEN mh.tg_user_id END) AS winner_id,
       MAX(CASE WHEN mh.won THEN u.name END) AS winner_name,
       COUNT(*) AS player_count
     FROM match_history mh
     LEFT JOIN users u ON u.tg_user_id = mh.tg_user_id
     GROUP BY mh.room_id
     ORDER BY MAX(mh.ended_at) DESC
     LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    roomId: r.room_id,
    endedAt: r.ended_at instanceof Date ? r.ended_at.toISOString() : String(r.ended_at),
    winnerId: r.winner_id == null ? null : Number(r.winner_id),
    winnerName: r.winner_name ?? null,
    playerCount: Number(r.player_count),
  }));
}

export interface AdminPurchaseRow {
  id: number;
  tgUserId: number;
  userName: string | null;
  itemId: string;
  stars: number;
  createdAt: string;
}

export async function listAdminPurchases(limit = 50): Promise<AdminPurchaseRow[]> {
  const { rows } = await pool.query(
    `SELECT sp.id, sp.tg_user_id, u.name, sp.item_id, sp.stars, sp.created_at
       FROM stars_purchases sp
       LEFT JOIN users u ON u.tg_user_id = sp.tg_user_id
       ORDER BY sp.created_at DESC
       LIMIT $1`,
    [limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    tgUserId: Number(r.tg_user_id),
    userName: r.name ?? null,
    itemId: r.item_id,
    stars: Number(r.stars),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}
