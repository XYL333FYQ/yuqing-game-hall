FROM node:22-alpine AS dependencies
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server-games/gobang/package.json server-games/gobang/package.json
RUN pnpm install --frozen-lockfile --filter @yuqing/gobang-server...
RUN pnpm --filter @yuqing/gobang-server deploy --legacy --prod /release

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /release ./
COPY server-games/gobang/server.js ./server.js
COPY server-games/gobang/LICENSE ./LICENSE
EXPOSE 8792
USER node
CMD ["node", "server.js"]
