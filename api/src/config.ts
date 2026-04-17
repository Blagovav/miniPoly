export const config = {
  port: Number(process.env.PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  botToken: process.env.BOT_TOKEN ?? "",
  botUrl: process.env.BOT_URL ?? "http://bot:3001",
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://redis:6379",
  turnTimeoutSec: Number(process.env.TURN_TIMEOUT_SEC ?? 180),
};
