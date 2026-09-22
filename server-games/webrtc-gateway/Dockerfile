FROM node:22-alpine AS dependencies
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server-games/webrtc-gateway/package.json server-games/webrtc-gateway/package.json
RUN pnpm install --frozen-lockfile --filter @yuqing/webrtc-gateway...
RUN pnpm --filter @yuqing/webrtc-gateway deploy --legacy --prod /release

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /release ./
COPY server-games/webrtc-gateway/server.js ./server.js
EXPOSE 9000
USER node
CMD ["node", "server.js"]
