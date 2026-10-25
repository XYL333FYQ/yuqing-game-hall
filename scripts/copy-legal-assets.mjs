import fs from "node:fs";
import path from "node:path";

const sourceDirectory = path.resolve("licenses");
const destinationDirectory = path.resolve("public/legal/licenses");
const legalRoot = path.resolve("public/legal");

fs.mkdirSync(destinationDirectory, { recursive: true });
for (const fileName of fs.readdirSync(sourceDirectory)) {
  const source = path.join(sourceDirectory, fileName);
  if (!fs.statSync(source).isFile()) continue;
  fs.copyFileSync(source, path.join(destinationDirectory, fileName));
}

// 来源审计放在 docs/maintenance/，发布时仍复制到 public/legal/ 根部，线上路径不变。
const legalFiles = ["LICENSE", "THIRD_PARTY_NOTICES.md", "docs/maintenance/SOURCE_AUDIT.md"];
for (const file of legalFiles) {
  fs.copyFileSync(path.resolve(file), path.join(legalRoot, path.basename(file)));
}

console.log("License and source-audit files are ready in public/legal.");
