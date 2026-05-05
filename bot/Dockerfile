# Production image for the Telegram bot. Same pattern as api/Dockerfile —
# tsx runtime, --omit=dev strims test/types deps. For local development
# run `npm run dev` from bot/ directly.

FROM node:22-alpine

WORKDIR /app/bot

COPY bot/package.json ./
RUN npm install --omit=dev && npm install tsx

COPY bot/tsconfig.json ./
COPY bot/src ./src

ENV NODE_ENV=production

EXPOSE 3001

CMD ["npx", "tsx", "src/index.ts"]
