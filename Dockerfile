FROM node:18-alpine AS base
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm test && npm run lint

FROM node:18-alpine AS final
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules ./node_modules
COPY src ./src
COPY data ./data
COPY .env.example .env.example
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
	CMD wget -q --spider "http://127.0.0.1:${PORT:-3000}/health" || exit 1
CMD ["node", "src/server.js"]
