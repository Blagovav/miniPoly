import { Bot, InlineKeyboard } from "grammy";
import Fastify from "fastify";

const BOT_TOKEN = process.env.BOT_TOKEN ?? "";
const WEBAPP_URL = process.env.WEBAPP_URL ?? "http://localhost:5173";
const PORT = Number(process.env.PORT ?? 3001);

if (!BOT_TOKEN) {
  console.warn("[bot] BOT_TOKEN is empty — bot will not start Telegram polling. API notify endpoint still available.");
}

// Храним tgUserId → chatId для отправки уведомлений (in-memory).
const userChats = new Map<number, number>();

const bot = BOT_TOKEN ? new Bot(BOT_TOKEN) : null;

if (bot) {
  bot.command("start", async (ctx) => {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    if (userId && chatId) userChats.set(userId, chatId);

    const payload = ctx.match?.trim();
    const isRoomInvite = payload && payload.startsWith("room_");
    const roomId = isRoomInvite ? payload.slice(5) : null;

    const url = roomId ? `${WEBAPP_URL}?room=${encodeURIComponent(roomId)}` : WEBAPP_URL;

    const kb = new InlineKeyboard().webApp(
      roomId ? `🎲 Войти в комнату ${roomId}` : "🎲 Играть в Монополию",
      url,
    );

    const lang = ctx.from?.language_code?.startsWith("ru") ? "ru" : "en";
    const text =
      lang === "ru"
        ? roomId
          ? `Тебя пригласили в комнату <b>${roomId}</b>. Жми «Играть»!`
          : "Привет! Монополия в Telegram 🎲\n\nЖми кнопку ниже и стартуй игру — приглашай друзей, кидай кости, скупай города."
        : roomId
          ? `You've been invited to room <b>${roomId}</b>. Tap to join!`
          : "Welcome to Monopoly on Telegram 🎲\n\nTap below to play. Invite friends, roll dice, buy streets.";

    await ctx.reply(text, { reply_markup: kb, parse_mode: "HTML" });
  });

  bot.command("help", async (ctx) => {
    await ctx.reply("Команды:\n/start — открыть игру\n/new — создать новую комнату");
  });

  bot.command("new", async (ctx) => {
    const kb = new InlineKeyboard().webApp("🎲 Создать комнату", `${WEBAPP_URL}?new=1`);
    await ctx.reply("Создай комнату и пригласи друзей!", { reply_markup: kb });
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

// HTTP API для уведомлений от `api` контейнера
const app = Fastify({ logger: false });

app.post<{ Body: { tgUserId: number; roomId: string; playerName: string } }>(
  "/notify/turn",
  async (req, reply) => {
    const { tgUserId, roomId, playerName } = req.body;
    const chatId = userChats.get(tgUserId);
    if (!bot || !chatId) return { ok: false, reason: "no chat or bot" };

    const url = `${WEBAPP_URL}?room=${encodeURIComponent(roomId)}`;
    const kb = new InlineKeyboard().webApp("🎲 Мой ход!", url);

    try {
      await bot.api.sendMessage(
        chatId,
        `🎲 <b>${playerName}</b>, твой ход в комнате <b>${roomId}</b>!`,
        { reply_markup: kb, parse_mode: "HTML" },
      );
      return { ok: true };
    } catch (err) {
      console.error("[bot] notify failed", err);
      return reply.code(500).send({ ok: false });
    }
  },
);

app.listen({ port: PORT, host: "0.0.0.0" })
  .then(() => console.log(`[bot] notify HTTP on :${PORT}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
