# Multi-stage prod build for web. Stage 1 produces /app/web/dist via
# vite build with VITE_* baked in from build args; stage 2 serves it via
# nginx on :80 with the SPA fallback config in web/nginx.conf.
#
# For local development run `npm run dev` from web/ directly — this file
# isn't a dev workflow.

FROM node:22-alpine AS build

ARG VITE_BOT_USERNAME=poly_mini_bot
ENV VITE_BOT_USERNAME=$VITE_BOT_USERNAME

# TURN server config — baked into the web bundle at build time so the
# WebRTC client knows where to relay media. These creds end up visible
# in JS, so pair with server-side rate limits.
ARG VITE_TURN_URL=
ARG VITE_TURN_USER=
ARG VITE_TURN_PASS=
ENV VITE_TURN_URL=$VITE_TURN_URL
ENV VITE_TURN_USER=$VITE_TURN_USER
ENV VITE_TURN_PASS=$VITE_TURN_PASS

WORKDIR /app/web

COPY web/package.json ./
RUN npm install

COPY web/tsconfig.json web/tsconfig.node.json web/vite.config.ts web/index.html ./
COPY web/src ./src
COPY web/public ./public
COPY shared /app/shared

RUN npm run build


FROM nginx:alpine

COPY --from=build /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
