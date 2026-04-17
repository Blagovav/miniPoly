import { Bot, InlineKeyboard } from "grammy";
import Fastify from "fastify";

const BOT_TOKEN = process.env.BOT_TOKEN ?? "";
const WEBAPP_URL = process.env.WEBAPP_URL ?? "http://localhost:5174";
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
    if (!bot) return { ok: false, reason: "no bot" };

    const url = `${WEBAPP_URL}?room=${encodeURIComponent(roomId)}`;
    const kb = new InlineKeyboard().webApp("🎲 Сделать ход", url);

    try {
      // В приватных чатах chat_id === user_id.
      // Работает если юзер /start'ил бота ИЛИ дал requestWriteAccess.
      await bot.api.sendMessage(
        tgUserId,
        `🎲 <b>${playerName}</b>, твой ход в комнате <b>${roomId}</b>!\n\n⏱ На ход 3 минуты, иначе пропустим.`,
        { reply_markup: kb, parse_mode: "HTML" },
      );
      return { ok: true };
    } catch (err: any) {
      // Если бот не может писать — юзер не давал разрешения. Не страшно, просто скипнется.
      console.error("[bot] notify failed (user may not have started bot):", err?.description || err?.message);
      return reply.code(200).send({ ok: false, reason: "no chat access" });
    }
  },
);

app.listen({ port: PORT, host: "0.0.0.0" })
  .then(() => console.log(`[bot] notify HTTP on :${PORT}`))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
