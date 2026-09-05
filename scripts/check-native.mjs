import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const required = [
  "package.json",
  "src-tauri/Cargo.toml",
  "src-tauri/tauri.conf.json",
  "src-tauri/src/lib.rs",
  "src-tauri/src/main.rs",
  "src-tauri/capabilities/default.json",
  "js/nativeBridgeService.js",
  "js/automationCoreService.js",
  "js/localReasoningService.js"
];

let failed = false;
for (const item of required) {
  if (!existsSync(resolve(root, item))) {
    console.error(`MISSING ${item}`);
    failed = true;
  } else {
    console.log(`OK ${item}`);
  }
}

const config = JSON.parse(readFileSync(resolve(root, "src-tauri/tauri.conf.json"), "utf8"));
if (config.version !== "0.14.0") {
  console.error(`Unexpected native version: ${config.version}`);
  failed = true;
}

if (failed) process.exit(1);
console.log("JORDAN Native Core structure OK");
