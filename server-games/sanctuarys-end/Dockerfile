FROM node:22-alpine AS dependencies
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server-games/sanctuarys-end/package.json server-games/sanctuarys-end/package.json
RUN pnpm install --frozen-lockfile --filter @yuqing/sanctuary-relay...
RUN pnpm --filter @yuqing/sanctuary-relay deploy --legacy --prod /release

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /release ./
COPY server-games/sanctuarys-end/server.js ./server.js
EXPOSE 8787
USER node
CMD ["node", "server.js"]
