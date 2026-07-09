# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3333
RUN addgroup -S nest && adduser -S nest -G nest
COPY --from=build --chown=nest:nest /app/package.json ./
COPY --from=build --chown=nest:nest /app/node_modules ./node_modules
COPY --from=build --chown=nest:nest /app/dist ./dist
USER nest
EXPOSE 3333
HEALTHCHECK --interval=10s --timeout=3s --start-period=25s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3333/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
