# syntax=docker/dockerfile:1

# BASE
FROM node:26.13-alpine AS base

# BUILD
FROM base AS build

WORKDIR /app

COPY package.json package-lock.json .

RUN npm ci

COPY src/ ./src
COPY tsconfig.json .

RUN npm run build

RUN npm prune --omit=dev

# RUNTIME
FROM base

WORKDIR /app

COPY package.json package-lock.json .
COPY sql/ ./sql
COPY views/ ./views
COPY public/ ./public

COPY --from=build /app/dist/ ./dist
COPY --from=build /app/node_modules/ ./node_modules

VOLUME ["/data"]
ENV DB_PATH=/data/main.db

EXPOSE 4321
CMD ["npm", "start"]
