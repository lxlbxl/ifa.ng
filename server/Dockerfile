# Build context: repository root (needs both server/ and db/).
FROM node:22-alpine AS build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/server
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY server/package.json ./
COPY db /app/db
# Local file storage when no R2 bucket is configured (a named volume mounts here).
RUN mkdir -p /data/files && chown node:node /data/files
USER node
EXPOSE 8787
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:8787/health || exit 1
# Apply pending migrations, then serve.
CMD ["sh", "-c", "node dist/migrate.js && exec node dist/index.js"]
