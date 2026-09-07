import { spawn } from "node:child_process";

const url = process.argv[2];
const timeoutMs = Number(process.argv[3] ?? 120_000);

if (!url) process.exit(0);

const deadline = Date.now() + timeoutMs;
let ready = false;

while (Date.now() < deadline) {
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(1_500),
    });
    if (response.status < 500) {
      ready = true;
      break;
    }
  } catch {
    // The local server is still starting.
  }

  await new Promise((resolve) => setTimeout(resolve, 300));
}

if (!ready) {
  process.stderr.write(`\n[提示] 等待本地服务超时，请手动打开：${url}\n`);
  process.exit(1);
}

process.stdout.write(`\n[就绪] 本地网页已经启动：${url}\n`);

if (process.platform === "win32") {
  const command = process.env.ComSpec ?? "cmd.exe";
  spawn(command, ["/d", "/s", "/c", `start "" "${url}"`], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();
} else {
  const command = process.platform === "darwin" ? "open" : "xdg-open";
  spawn(command, [url], { detached: true, stdio: "ignore" }).unref();
}
