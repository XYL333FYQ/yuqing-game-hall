// 从外部验证自建 STUN/TURN 是否真的可达。
//
// 用途：部署后验收时，从 CI runner（或你自己的电脑）向 VPS 的 3478/udp 发一个
// STUN Binding Request。它能一次性证明三件事：
//   1. VPS 防火墙真的放行了 UDP 3478；
//   2. coturn 真的在监听并且能回包；
//   3. DNS / 公网 IP 指向的就是这台 VPS（TURN_EXTERNAL_IP 配对了）。
//
// 只用 Node 内置的 dgram，不引入额外依赖，也不需要把 TURN 密钥带进来。
//
// 用法：
//   node server-games/scripts/check-turn.mjs turn.example.com 3478
//   TURN_HOST=turn.example.com TURN_PORT=3478 node server-games/scripts/check-turn.mjs

import { createSocket } from "node:dgram";
import { randomBytes } from "node:crypto";

const STUN_BINDING_REQUEST = 0x0001;
const STUN_BINDING_SUCCESS = 0x0101;
const MAGIC_COOKIE = 0x2112a442;
const ATTR_XOR_MAPPED_ADDRESS = 0x0020;
const ATTR_MAPPED_ADDRESS = 0x0001;
const TIMEOUT_MS = 5000;

const host = (process.argv[2] || process.env.TURN_HOST || "").trim();
const port = Number(process.argv[3] || process.env.TURN_PORT || 3478);

if (!host) {
  console.error("用法：node check-turn.mjs <turn-host> [port]");
  process.exit(2);
}
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`端口不合法：${process.argv[3] || process.env.TURN_PORT}`);
  process.exit(2);
}

const transactionId = randomBytes(12);
const request = Buffer.alloc(20);
request.writeUInt16BE(STUN_BINDING_REQUEST, 0);
request.writeUInt16BE(0, 2);
request.writeUInt32BE(MAGIC_COOKIE, 4);
transactionId.copy(request, 8);

const socket = createSocket("udp4");
const timer = setTimeout(() => {
  console.error(`✗ ${host}:${port}/udp 在 ${TIMEOUT_MS} ms 内没有回应 STUN Binding Request。`);
  console.error("  请检查：VPS 防火墙是否放行 UDP 3478、coturn 是否在运行、DNS 是否指向这台 VPS。");
  socket.close();
  process.exit(1);
}, TIMEOUT_MS);

socket.once("error", (error) => {
  clearTimeout(timer);
  console.error(`✗ 无法向 ${host}:${port} 发送 STUN 请求：${error.message}`);
  process.exit(1);
});

socket.on("message", (message) => {
  const parsed = parseStunResponse(message);
  if (!parsed) return;
  clearTimeout(timer);
  socket.close();
  if (parsed.type !== STUN_BINDING_SUCCESS) {
    console.error(`✗ ${host}:${port} 返回了非 Binding Success 响应（0x${parsed.type.toString(16)}）。`);
    process.exit(1);
  }
  const mapped = parsed.mappedAddress || "（响应里没有 MAPPED-ADDRESS）";
  console.log(`✓ 自建 STUN/TURN 可达：${host}:${port}/udp → 服务器看到的来源地址 ${mapped}`);
  process.exit(0);
});

socket.send(request, port, host);

function parseStunResponse(buffer) {
  if (buffer.length < 20) return null;
  const type = buffer.readUInt16BE(0);
  const length = buffer.readUInt16BE(2);
  const cookie = buffer.readUInt32BE(4);
  if (cookie !== MAGIC_COOKIE) return null;
  if (!buffer.subarray(8, 20).equals(transactionId)) return null;

  let offset = 20;
  const end = Math.min(buffer.length, 20 + length);
  let mappedAddress = null;
  while (offset + 4 <= end) {
    const attrType = buffer.readUInt16BE(offset);
    const attrLength = buffer.readUInt16BE(offset + 2);
    const value = buffer.subarray(offset + 4, offset + 4 + attrLength);
    if (attrType === ATTR_XOR_MAPPED_ADDRESS || attrType === ATTR_MAPPED_ADDRESS) {
      mappedAddress = readMappedAddress(value, attrType === ATTR_XOR_MAPPED_ADDRESS);
    }
    offset += 4 + attrLength + ((4 - (attrLength % 4)) % 4);
  }
  return { type, mappedAddress };
}

function readMappedAddress(value, xor) {
  if (value.length < 8) return null;
  const family = value.readUInt8(1);
  const rawPort = value.readUInt16BE(2);
  const addressPort = xor ? rawPort ^ (MAGIC_COOKIE >>> 16) : rawPort;
  if (family !== 0x01) return `[family 0x${family.toString(16)}]:${addressPort}`;
  const raw = value.subarray(4, 8);
  const bytes = xor
    ? raw.map((byte, index) => byte ^ ((MAGIC_COOKIE >>> (24 - index * 8)) & 0xff))
    : [...raw];
  return `${bytes.join(".")}:${addressPort}`;
}
