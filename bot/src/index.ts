import { Bot, InlineKeyboard } from "grammy";
import Fastify from "fastify";

const BOT_TOKEN = process.env.BOT_TOKEN ?? "";
const WEBAPP_URL = process.env.WEBAPP_URL ?? "http://localhost:5174";
const API_URL = process.env.API_URL ?? "http://api:3000";
const PORT = Number(process.env.PORT ?? 3001);

if (!BOT_TOKEN) {
  console.warn("[bot] BOT_TOKEN is empty — bot will not start Telegram polling. API notify endpoint still available.");
}

const bot = BOT_TOKEN ? new Bot(BOT_TOKEN) : null;

if (bot) {
  bot.command("start", async (ctx) => {
    const payload = ctx.match?.trim();
    const isRoomInvite = payload && payload.startsWith("room_");
    const roomId = isRoomInvite ? payload.slice(5) : null;

    const url = roomId ? `${WEBAPP_URL}?room=${encodeURIComponent(roomId)}` : WEBAPP_URL;

    const kb = new InlineKeyboard().webApp(
      roomId ? `🎲 Войти в комнату ${roomId}` : "🎲 Играть в Minipoly",
      url,
    );

    const lang = ctx.from?.language_code?.startsWith("ru") ? "ru" : "en";
    const text =
      lang === "ru"
        ? roomId
          ? `Тебя пригласили в комнату <b>${roomId}</b>. Жми «Играть»!`
          : "Привет! Minipoly — Монополия в Telegram 🎲\n\nЖми кнопку ниже и стартуй игру — приглашай друзей, кидай кости, скупай города.\n\n✅ Бот будет пинговать, когда твой ход."
        : roomId
          ? `You've been invited to room <b>${roomId}</b>. Tap to join!`
          : "Welcome to Minipoly on Telegram 🎲\n\nTap below to play. Invite friends, roll dice, buy streets.\n\n✅ Bot will ping you when it's your turn.";

    await ctx.reply(text, { reply_markup: kb, parse_mode: "HTML" });
  });

  bot.command("help", async (ctx) => {
    await ctx.reply("Команды:\n/start — открыть игру\n/new — создать новую комнату");
  });

  bot.command("new", async (ctx) => {
    const kb = new InlineKeyboard().webApp("🎲 Создать комнату", `${WEBAPP_URL}?new=1`);
    await ctx.reply("Создай комнату и пригласи друзей!", { reply_markup: kb });
  });

  // Pre-checkout — всегда одобряем.
  bot.on("pre_checkout_query", async (ctx) => {
    try {
      await ctx.answerPreCheckoutQuery(true);
    } catch (err) {
      console.error("[bot] pre_checkout_query failed:", err);
    }
  });

  // Успешная оплата — регистрируем покупку в API.
  bot.on("message:successful_payment", async (ctx) => {
    const sp = ctx.message.successful_payment;
    const payload = sp.invoice_payload; // "itemId|tgUserId"
    const [itemId, uidStr] = payload.split("|");
    const tgUserId = Number(uidStr || ctx.from?.id);
    try {
      const res = await fetch(`${API_URL}/api/internal/purchase`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-bot-token": BOT_TOKEN,
        },
        body: JSON.stringify({
          tgUserId,
          itemId,
          stars: sp.total_amount,
          chargeId: sp.telegram_payment_charge_id,
        }),
      });
      if (!res.ok) {
        console.error("[bot] API didn't accept purchase:", res.status);
      }
      await ctx.reply(`✅ Оплата принята! <b>${itemId}</b> добавлен в твой инвентарь.`, { parse_mode: "HTML" });
    } catch (err) {
      console.error("[bot] successful_payment forwarding failed:", err);
    }
  });

  bot.catch((err) => {
    console.error("[bot] error", err);
  });

  bot
    .start({
      onStart: (info) => console.log(`[bot] @${info.username} started`),
    })
    .catch((err) => {
      console.error("[bot] failed to start Telegram polling — check BOT_TOKEN. Notify HTTP endpoint still works.");
      console.error("[bot]", err?.description || err?.message || err);
    });
}

const app = Fastify({ logger: false });

app.post<{ Body: { tgUserId: number; roomId: string; playerName: string } }>(
  "/notify/turn",
  async (req, reply) => {
    const { tgUserId, roomId, playerName } = req.body;
    if (!bot) return { ok: false, reason: "no bot" };

    const url = `${WEBAPP_URL}?room=${encodeURIComponent(roomId)}`;
    const kb = new InlineKeyboard().webApp("🎲 Сделать ход", url);

    try {
      await bot.api.sendMessage(
        tgUserId,
        `🎲 <b>${playerName}</b>, твой ход в комнате <b>${roomId}</b>!\n\n⏱ На ход 3 минуты, иначе пропустим.`,
        { reply_markup: kb, parse_mode: "HTML" },
      );
      return { ok: true };
    } catch (err: any) {
      console.error("[bot] notify failed (user may not have started bot):", err?.description || err?.message);
      return reply.code(200).send({ ok: false, reason: "no chat access" });
    }
  },
);

// Создать invoice-link для Telegram Stars.
app.post<{ Body: { tgUserId: number; itemId: string; title: string; stars: number } }>(
  "/invoice/create",
  async (req, reply) => {
    if (!bot) return reply.code(503).send({ error: "bot not running" });
    const { tgUserId, itemId, title, stars } = req.body;
    if (!tgUserId || !itemId || !stars) return reply.code(400).send({ error: "bad request" });
    try {
      // payload — содержит itemId и пользователя, чтобы получить на successful_payment
      const payload = `${itemId}|${tgUserId}`;
      const link = await bot.api.createInvoiceLink(
        title,
        `Покупка ${title} за Telegram Stars`,
        payload,
        "", // provider_token для Stars должен быть пустым
        "XTR", // currency = Telegram Stars
        [{ label: title, amount: stars }],
      );
      return { link };
    } catch (err: any) {
      console.error("[bot] createInvoiceLink failed:", err?.description || err?.message);
      return reply.code(500).send({ error: "invoice failed", reason: err?.description });
    }
  },
);

app.listen({ port: PORT, host: "0.0.0.0" })
  .then(() => console.log(`[bot] notify HTTP on :${PORT}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
