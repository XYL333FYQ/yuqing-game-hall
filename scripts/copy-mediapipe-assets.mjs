import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const entryPath = require.resolve("@mediapipe/tasks-vision/vision_wasm_internal.js");
const sourceDir = path.dirname(entryPath);
const destinationDir = path.resolve("public/wasm");

fs.mkdirSync(destinationDir, { recursive: true });

for (const fileName of fs.readdirSync(sourceDir)) {
  if (!fileName.includes("wasm")) continue;
  const sourceFile = path.join(sourceDir, fileName);
  if (!fs.statSync(sourceFile).isFile()) continue;
  fs.copyFileSync(sourceFile, path.join(destinationDir, fileName));
}

console.log("MediaPipe WASM assets are ready in public/wasm.");
