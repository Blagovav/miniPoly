import { Bot, InlineKeyboard } from "grammy";
import Fastify from "fastify";

const BOT_TOKEN = process.env.BOT_TOKEN ?? "";
const BOT_USERNAME = process.env.BOT_USERNAME ?? "poly_mini_bot";
const WEBAPP_URL = process.env.WEBAPP_URL ?? "http://localhost:5174";
const API_URL = process.env.API_URL ?? "http://api:3000";
const PORT = Number(process.env.PORT ?? 3001);
// Картинка-превью для shareMessage карточки (thumbnail_url). Должна быть
// публично доступна и не превышать 1 МБ. Если нет — пропускаем thumbnail,
// карточка будет без картинки.
const OG_IMAGE_URL = process.env.OG_IMAGE_URL ?? "";

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

// Отправить инвайт в комнату другу в Telegram-DM.
app.post<{ Body: { tgUserId: number; roomId: string; fromName: string } }>(
  "/invite/send",
  async (req, reply) => {
    if (!bot) return reply.code(503).send({ ok: false, reason: "no bot" });
    const { tgUserId, roomId, fromName } = req.body;
    if (!tgUserId || !roomId) return reply.code(400).send({ ok: false, reason: "bad request" });

    const url = `${WEBAPP_URL}?room=${encodeURIComponent(roomId)}`;
    const kb = new InlineKeyboard().webApp(`🎲 Войти в комнату ${roomId}`, url);
    const safeName = String(fromName || "Игрок").replace(/[<>&]/g, "");

    try {
      await bot.api.sendMessage(
        tgUserId,
        `🎲 <b>${safeName}</b> зовёт тебя в партию Minipoly!\n\nКомната <b>${roomId}</b> ждёт — жми кнопку и присоединяйся.`,
        { reply_markup: kb, parse_mode: "HTML" },
      );
      return { ok: true };
    } catch (err: any) {
      const reason = err?.description || err?.message || "send failed";
      console.error("[bot] invite send failed:", reason);
      return reply.code(200).send({ ok: false, reason });
    }
  },
);

// Подготовить «prepared inline message» для tg.shareMessage на фронте.
// Возвращает id, который клиент передаёт в Telegram WebApp — юзер выбирает
// чат из нативного пикера, сообщение приходит адресату карточкой с кнопкой.
// Метод savePreparedInlineMessage появился в Bot API 7.12 (ноябрь 2024).
// Grammy 1.30+ его поддерживает через bot.api.savePreparedInlineMessage.
app.post<{ Body: { tgUserId: number; roomId: string; fromName: string } }>(
  "/invite/prepare",
  async (req, reply) => {
    if (!bot) return reply.code(503).send({ ok: false, reason: "no bot" });
    const { tgUserId, roomId, fromName } = req.body ?? ({} as any);
    if (!tgUserId || !roomId) {
      return reply.code(400).send({ ok: false, reason: "bad request" });
    }

    // Deep-link обязан быть https (web_app-кнопки в inline-сообщениях запрещены Telegram).
    const deepLink = `https://t.me/${BOT_USERNAME}?startapp=room_${encodeURIComponent(roomId)}`;
    const safeName = String(fromName || "Игрок").replace(/[<>&"]/g, "").slice(0, 40);
    const safeRoom = String(roomId).replace(/[<>&"]/g, "").slice(0, 40);

    // Inline-article с карточкой (title/desc/thumb) + кнопкой «Играть».
    const result: any = {
      type: "article",
      id: `inv_${safeRoom}_${Date.now()}`,
      title: "🎲 Minipoly",
      description: `${safeName} зовёт тебя в партию · Игра ${safeRoom}`,
      input_message_content: {
        message_text:
          `🎲 <b>${safeName}</b> зовёт тебя в партию Minipoly!\n\n` +
          `Игра <b>${safeRoom}</b> — жми «Играть» и присоединяйся.`,
        parse_mode: "HTML",
      },
      reply_markup: {
        inline_keyboard: [[{ text: `🎲 Играть · ${safeRoom}`, url: deepLink }]],
      },
    };
    if (OG_IMAGE_URL) {
      result.thumbnail_url = OG_IMAGE_URL;
      result.thumbnail_width = 512;
      result.thumbnail_height = 512;
    }

    try {
      // Используем raw для максимальной совместимости со старыми версиями grammy.
      const prepared = await (bot.api.raw as any).savePreparedInlineMessage({
        user_id: tgUserId,
        result,
        allow_user_chats: true,
        allow_bot_chats: false,
        allow_group_chats: true,
        allow_channel_chats: false,
      });
      return { ok: true, id: prepared.id, expirationDate: prepared.expiration_date };
    } catch (err: any) {
      const reason = err?.description || err?.message || "prepare failed";
      console.error("[bot] invite prepare failed:", reason);
      return reply.code(500).send({ ok: false, reason });
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
