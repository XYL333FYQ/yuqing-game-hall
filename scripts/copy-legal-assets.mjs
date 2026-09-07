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

for (const fileName of ["LICENSE", "THIRD_PARTY_NOTICES.md", "SOURCE_AUDIT.md"]) {
  fs.copyFileSync(path.resolve(fileName), path.join(legalRoot, fileName));
}

console.log("License and source-audit files are ready in public/legal.");
