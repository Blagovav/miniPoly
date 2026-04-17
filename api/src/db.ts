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
