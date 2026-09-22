// 把公开的运行时地址从 GitHub Variables 同步到 Cloudflare Pages 项目的运行时环境配置。
//
// 用法：node server-games/scripts/sync-pages-config.mjs
// 需要的环境变量：
//   CLOUDFLARE_API_TOKEN       （复用现有的 Pages 部署 token）
//   CLOUDFLARE_ACCOUNT_ID
//   PAGES_PROJECT              默认 yuqing-game-hall
//   FRUIT_PARTY_SERVICE_URL / SANCTUARY_RELAY_URL / WEBRTC_SERVICE_URL
//
// 为什么需要这一步：Cloudflare Pages 的运行时变量是在**部署时**快照进该次部署的，
// 所以必须在 `wrangler pages deploy` 之前同步，改动才会对本次部署生效。
//
// 安全约定：
//   - 项目 GET 的返回体里可能含有 secret 类型的值，因此**从不打印整个响应**，
//     只打印被同步的键名；
//   - 同步采用「先读、合并、再写」：只会新增/覆盖我们负责的三个键，
//     其它已有变量（包括用户手动加的）原样保留。
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const MANAGED_KEYS = Object.freeze([
  "FRUIT_PARTY_SERVICE_URL",
  "SANCTUARY_RELAY_URL",
  "WEBRTC_SERVICE_URL",
]);

// 每个键允许的协议与是否允许带路径
const KEY_RULES = Object.freeze({
  FRUIT_PARTY_SERVICE_URL: { protocols: ["http:", "https:"], allowPath: true, label: "http(s)" },
  // 庇护所中继通常写成 wss://host/socket，路径是有意义的
  SANCTUARY_RELAY_URL: { protocols: ["ws:", "wss:"], allowPath: true, label: "ws(s)" },
  // gateway 必须独占主机根路径：PeerJS 客户端会拼成 `<path>peerjs/id`
  WEBRTC_SERVICE_URL: { protocols: ["http:", "https:"], allowPath: false, label: "http(s)（不能带路径）" },
});

function reject(message) {
  return { ok: false, message };
}

/** 校验单个地址；空值代表“这项服务还没部署”，是合法的。 */
export function validateServiceUrl(key, value) {
  const rule = KEY_RULES[key];
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return { ok: true, value: "" };

  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return reject(`${key} 不是合法 URL：${trimmed}`);
  }
  if (!rule.protocols.includes(url.protocol)) {
    return reject(`${key} 必须是 ${rule.label} 地址，当前为 ${trimmed}`);
  }
  if (url.username || url.password || url.search || url.hash) {
    return reject(`${key} 不能带用户名、密码、查询串或片段：${trimmed}`);
  }
  const path = url.pathname.replace(/\/+$/, "");
  if (!rule.allowPath && path) {
    return reject(`${key} 必须是主机根路径（不能带 ${url.pathname}）：PeerJS 信令路径由 gateway 决定`);
  }
  // 统一去掉尾部斜杠：消费方（果切按路径拼接、庇护所直接 new URL）对尾斜杠敏感
  const normalized = path ? `${url.protocol}//${url.host}${path}` : `${url.protocol}//${url.host}`;
  return { ok: true, value: normalized };
}

/**
 * 把待同步的值合并进项目现有的 env_vars。
 * @returns {{ ok: true, payload: object, changes: Array, cleared: string[], preserved: string[] } | { ok: false, message: string }}
 */
export function buildProjectPatch(project, rawValues) {
  const production = project?.deployment_configs?.production ?? {};
  const existing = production.env_vars ?? {};

  // Cloudflare 的 GET 会把 secret 类型的值一并返回；万一某条 secret 没有值，
  // 我们就无法安全地把它原样写回去（可能被清空），此时宁可中止。
  for (const [key, entry] of Object.entries(existing)) {
    if (entry?.type === "secret_text" && (entry.value === undefined || entry.value === null)) {
      return reject(
        `Cloudflare 上的 ${key} 是 secret 类型但没有返回值。为避免误删，本次不做任何修改；` +
          "请把它改为 GitHub Secrets 管理，或在 Cloudflare 上改成明文变量。",
      );
    }
  }

  const merged = { ...existing };
  const changes = [];
  const cleared = [];

  for (const key of MANAGED_KEYS) {
    const result = validateServiceUrl(key, rawValues[key]);
    if (!result.ok) return reject(result.message);
    if (result.value) {
      merged[key] = { type: "plain_text", value: result.value };
      if (existing[key]?.value !== result.value) changes.push(`${key}=${result.value}`);
    } else {
      merged[key] = { type: "plain_text", value: "" };
      if (existing[key]?.value) cleared.push(key);
      if (!existing[key]) changes.push(`${key}=（空）`);
    }
  }

  const preserved = Object.keys(existing).filter((key) => !MANAGED_KEYS.includes(key));
  return {
    ok: true,
    payload: { deployment_configs: { production: { env_vars: merged } } },
    changes,
    cleared,
    preserved,
  };
}

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const project = process.env.PAGES_PROJECT || "yuqing-game-hall";

  if (!token || !accountId) {
    process.stderr.write("::error title=缺少 Cloudflare 凭据::需要 CLOUDFLARE_API_TOKEN 与 CLOUDFLARE_ACCOUNT_ID。\n");
    process.exit(1);
  }

  const emptyKeys = MANAGED_KEYS.filter((key) => !String(process.env[key] ?? "").trim());
  if (emptyKeys.length > 0) {
    // 这是警告而不是失败：某些服务可能还没部署，对应变量留空会让游戏显示
    // “联机服务未配置”，属于明确的可降级状态，不是残缺服务。
    process.stdout.write(
      `::warning title=运行时地址未设置::以下 GitHub Variables 为空，Cloudflare 上对应变量会被清空，` +
        `游戏会显示“未配置”提示：${emptyKeys.join(" ")}\n`,
    );
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}`;
  const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };

  const currentResponse = await fetch(endpoint, { headers });
  if (currentResponse.status === 404) {
    process.stdout.write(`::warning title=Pages 项目不存在::${project} 尚未创建，跳过运行时变量同步。\n`);
    return;
  }
  if (currentResponse.status === 401 || currentResponse.status === 403) {
    process.stderr.write(
      `::error title=Cloudflare 权限不足::现有 CLOUDFLARE_API_TOKEN 无法读取 Pages 项目（HTTP ${currentResponse.status}）。` +
        "该 token 需要 Account 级别的 “Cloudflare Pages: Edit” 权限（与 pages deploy 所需权限相同）。\n",
    );
    process.exit(1);
  }
  if (!currentResponse.ok) {
    process.stderr.write(`::error title=读取 Pages 项目失败::HTTP ${currentResponse.status}\n`);
    process.exit(1);
  }

  const current = await currentResponse.json();
  const built = buildProjectPatch(current.result, process.env);
  if (!built.ok) {
    process.stderr.write(`::error title=运行时地址格式错误::${built.message}\n`);
    process.exit(1);
  }

  if (built.changes.length === 0 && built.cleared.length === 0) {
    process.stdout.write("Cloudflare 运行时变量已是最新，无需修改。\n");
    process.stdout.write(`保留的其它变量：${built.preserved.join(" ") || "（无）"}\n`);
    return;
  }

  const patchResponse = await fetch(endpoint, {
    method: "PATCH",
    headers,
    body: JSON.stringify(built.payload),
  });
  if (!patchResponse.ok) {
    process.stderr.write(`::error title=同步运行时变量失败::HTTP ${patchResponse.status}\n`);
    try {
      const body = await patchResponse.json();
      for (const error of body.errors ?? []) {
        process.stderr.write(`  - ${error.code} ${error.message}\n`);
      }
    } catch {
      /* 响应不是 JSON 就不解析 */
    }
    process.exit(1);
  }

  const patched = await patchResponse.json();
  const applied = Object.keys(patched.result?.deployment_configs?.production?.env_vars ?? {});
  process.stdout.write(`已同步 Cloudflare Pages（${project}）运行时变量：\n`);
  for (const change of built.changes) process.stdout.write(`  · ${change}\n`);
  if (built.cleared.length > 0) {
    process.stdout.write(`已清空（GitHub 上为空）：${built.cleared.join(" ")}\n`);
  }
  process.stdout.write(`当前全部变量键：${applied.join(" ")}\n`);
}

// 直接执行时才跑；被 import（测试）时不跑。
// 不要拿 argv[1] 和 import.meta.url 的 pathname 直接比字符串：Windows 上是反斜杠，
// 路径含中文时 pathname 还会被百分号编码。
function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return pathToFileURL(realpathSync(entry)).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  await main();
}
