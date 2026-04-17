FROM node:22-alpine

WORKDIR /app/api

COPY api/package.json ./
RUN npm install

COPY api/tsconfig.json ./
COPY api/src ./src
COPY shared /app/shared

EXPOSE 3000

CMD ["npm", "run", "dev"]
