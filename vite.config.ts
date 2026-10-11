import { defineConfig, type Plugin } from "vite";

function localRuntimeConfigPlugin(): Plugin {
  return {
    name: "yuqing-local-runtime-config",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        if (url === "/api/runtime-config" || url.startsWith("/api/runtime-config?")) {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-store");
          res.end(
            JSON.stringify({
              fruitPartyServiceUrl: process.env.FRUIT_PARTY_SERVICE_URL || "http://127.0.0.1:8790",
              sanctuaryRelayUrl: process.env.SANCTUARY_RELAY_URL || "ws://127.0.0.1:8787/socket",
              webrtcServiceUrl: process.env.WEBRTC_SERVICE_URL || "http://127.0.0.1:9000",
              cardRoomServiceUrl: process.env.CARD_ROOM_SERVICE_URL || "http://127.0.0.1:8002",
              gobangServiceUrl: process.env.GOBANG_SERVICE_URL || "ws://127.0.0.1:8792/socket",
            })
          );
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [localRuntimeConfigPlugin()],
  optimizeDeps: {
    entries: ["index.html"],
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
  build: {
    target: "es2022",
    sourcemap: false,
  },
});
