FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server-games/fruit-party/package.json server-games/fruit-party/package.json
RUN pnpm install --frozen-lockfile --filter @yuqing/fruit-party-server...

COPY games/fruit-party/src/shared games/fruit-party/src/shared
COPY server-games/fruit-party server-games/fruit-party
RUN pnpm --dir server-games/fruit-party build
RUN pnpm --filter @yuqing/fruit-party-server deploy --legacy --prod /release

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /release ./
COPY --from=build /app/server-games/fruit-party/dist ./dist
EXPOSE 8790
USER node
CMD ["node", "dist/server.mjs"]
