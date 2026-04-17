# nini_polia — Telegram Monopoly

Многопользовательская классическая Монополия для Telegram:
- **Mini App** (Vue 3 + TS) — красивый борд, анимации, i18n (EN/RU)
- **Backend** (Node + Fastify + WebSocket) — комнаты, realtime-ходы, движок правил
- **Bot** (grammY) — точка входа, инвайты друзей через `startapp`-ссылки
- **Postgres + Redis** — хранение партий, presence, сессии
- Всё поднимается одним `docker compose up`.

## Быстрый старт

```bash
cp .env.example .env
# впиши BOT_TOKEN от @BotFather
docker compose up --build
```

После старта:
- Mini App (dev): http://localhost:5174
- API: http://localhost:3000
- Bot: подключается к Telegram long-polling автоматически

## Telegram Mini App — HTTPS

Telegram требует HTTPS для Mini App. Для локальной разработки:

```bash
# в отдельном терминале
cloudflared tunnel --url http://localhost:5174
# или
ngrok http 5173
```

Получившийся `https://...` пропиши в `.env` как `WEBAPP_URL` и перезапусти `bot`:

```bash
docker compose restart bot
```

Затем в @BotFather выполни `/setmenubutton` → укажи этот URL и название кнопки.

## Структура

```
nini_polia/
├── bot/        # grammY-бот
├── api/        # Fastify + WebSocket сервер, игровой движок
├── web/        # Vue 3 Mini App
├── shared/     # общие типы (game state, board data)
└── docker-compose.yml
```

## Правила игры

Классическая Монополия (Hasbro Atlantic City, 40 клеток):
- 2–6 игроков в комнате
- Покупка/аренда улиц, ж/д, инфраструктуры
- Монополии (цветовые группы), дома, отели
- Шанс / Общественная казна
- Налоги, тюрьма, StartGO ($200 за круг)
- Торговля, аукционы, залог
- Победа: все остальные банкроты

## Production-деплой на VPS (tapcade.online)

Один раз на сервере:

```bash
# 1. Установи Docker + Compose
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# 2. Склонируй репо
git clone https://github.com/Blagovav/miniPoly.git /opt/minipoly
cd /opt/minipoly

# 3. Создай .env (из .env.prod.example)
cp .env.prod.example .env
nano .env   # впиши BOT_TOKEN и POSTGRES_PASSWORD

# 4. DNS: направь A-записи tapcade.online и www.tapcade.online на IP сервера

# 5. Открой порты 80/443 в файрволе (ufw/iptables)
ufw allow 80 && ufw allow 443

# 6. Поднимай
docker compose -f docker-compose.prod.yml up -d --build
```

Caddy сам получит SSL от Let's Encrypt при первом запросе к `tapcade.online`. Почта уведомлений — в [Caddyfile](./Caddyfile).

Обновление после `git push`:
```bash
cd /opt/minipoly
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Разработка

- `shared/` монтируется в `api/` и `web/` — общие типы не дублируются.
- API перезагружается через `tsx watch`, Vite HMR работает сразу.
- Бот использует long-polling (webhooks можно включить позже).
