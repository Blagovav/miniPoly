FROM node:22-alpine

WORKDIR /app/web

COPY web/package.json ./
RUN npm install

COPY web/tsconfig.json web/tsconfig.node.json web/vite.config.ts web/index.html ./
COPY web/src ./src
COPY web/public ./public
COPY shared /app/shared

EXPOSE 5173

CMD ["npm", "run", "dev"]
