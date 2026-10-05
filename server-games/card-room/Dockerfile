FROM node:22-alpine AS dependencies
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server-games/card-room/package.json server-games/card-room/package.json
RUN pnpm install --frozen-lockfile --filter @yuqing/card-room...
RUN pnpm --filter @yuqing/card-room deploy --legacy --prod /release

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /release ./
COPY server-games/card-room/*.js ./
COPY server-games/card-room/rules ./rules
COPY server-games/card-room/LICENSE ./LICENSE
EXPOSE 8002
USER node
CMD ["node", "server.js"]
