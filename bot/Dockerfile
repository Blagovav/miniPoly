FROM node:22-alpine

WORKDIR /app/bot

COPY bot/package.json ./
RUN npm install

COPY bot/tsconfig.json ./
COPY bot/src ./src

EXPOSE 3001

CMD ["npm", "run", "dev"]
