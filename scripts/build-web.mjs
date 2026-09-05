import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const files = [
  "index.html",
  "manifest.webmanifest",
  "sw.js",
  "firestore.rules"
];
const dirs = ["assets", "css", "js"];

for (const file of files) await cp(resolve(root, file), resolve(dist, file));
for (const dir of dirs) await cp(resolve(root, dir), resolve(dist, dir), { recursive: true });

console.log(`JORDAN web shell copied to ${dist}`);
