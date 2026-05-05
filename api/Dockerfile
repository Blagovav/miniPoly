# Production image for the api server. tsx interprets the TS source
# directly — there's no separate `tsc` build step, but `--omit=dev`
# trims test/types deps from node_modules so the runtime image stays
# small. For local development run `npm run dev` from api/ directly;
# this file isn't a dev workflow.

FROM node:22-alpine

WORKDIR /app/api

COPY api/package.json ./
RUN npm install --omit=dev && npm install tsx

COPY api/tsconfig.json ./
COPY api/src ./src
COPY shared /app/shared

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npx", "tsx", "src/index.ts"]
