import { createServer } from "node:net";

const start = Number.parseInt(process.argv[2] ?? "8787", 10);
const end = Number.parseInt(process.argv[3] ?? String(start + 100), 10);

if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > 65_535) {
  process.stderr.write("端口范围无效。\n");
  process.exit(1);
}

for (let port = start; port <= end; port += 1) {
  if (await isAvailable(port)) {
    process.stdout.write(String(port));
    process.exit(0);
  }
}

process.stderr.write(`没有找到可用端口（${start}–${end}）。\n`);
process.exit(1);

function isAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.close(() => resolve(true));
    });
  });
}
