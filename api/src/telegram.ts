import crypto from "node:crypto";
import { config } from "./config";

/**
 * Validate Telegram Mini App initData string.
 * Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * Returns parsed user object or null if invalid.
 */
export interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export function validateInitData(
  initData: string,
): { user: TgUser; authDate: number } | null {
  // Dev-mode (нет BOT_TOKEN): принимаем любой initData, если есть user — используем его.
  if (!config.botToken) {
    if (initData) {
      try {
        const params = new URLSearchParams(initData);
        const userRaw = params.get("user");
        if (userRaw) {
          const user = JSON.parse(userRaw) as TgUser;
          return { user, authDate: Number(params.get("auth_date") ?? Math.floor(Date.now() / 1000)) };
        }
      } catch {
        /* fallthrough to random */
      }
    }
    // Полный fallback — чисто рандомный гость
    const id = Math.floor(Math.random() * 1_000_000_000);
    return {
      user: { id, first_name: `Player${id % 1000}` },
      authDate: Math.floor(Date.now() / 1000),
    };
  }

  // Prod (с BOT_TOKEN): честная валидация HMAC
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(config.botToken)
    .digest();
  const calcHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (calcHash !== hash) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;
  try {
    const user = JSON.parse(userRaw) as TgUser;
    return { user, authDate: Number(params.get("auth_date") ?? 0) };
  } catch {
    return null;
  }
}

/**
 * Trigger the bot service to send a "your turn" push to a player.
 * Bot has its own HTTP endpoint that speaks to Telegram.
 */
export async function notifyTurn(
  tgUserId: number,
  roomId: string,
  playerName: string,
): Promise<void> {
  try {
    await fetch(`${config.botUrl}/notify/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tgUserId, roomId, playerName }),
    });
  } catch (err) {
    console.error("notifyTurn failed", err);
  }
}
