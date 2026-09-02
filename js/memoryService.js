import {
  deleteMemory,
  getAllMemories,
  getMemory,
  putMemory
} from "./db.js";
import { createId, normalizeText } from "./utils.js";

export class MemoryService {
  async remember({ key, label, value, type = "fact", source = "conversation" }) {
    const now = new Date().toISOString();
    const existing = key ? await getMemory(key) : null;

    const memory = {
      id: existing?.id ?? key ?? createId("mem"),
      key: key ?? existing?.key ?? createId("fact"),
      label: label?.trim() || existing?.label || "Informação",
      labelNormalized: normalizeText(label || existing?.label || "informacao"),
      value: String(value).trim(),
      valueNormalized: normalizeText(String(value)),
      type,
      source,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    await putMemory(memory);
    return memory;
  }

  async forget(idOrKey) {
    await deleteMemory(idOrKey);
  }

  async all() {
    return getAllMemories();
  }

  async get(key) {
    return getMemory(key);
  }

  async find(query) {
    const normalized = normalizeText(query);
    const all = await this.all();

    return all.filter((memory) =>
      memory.key.includes(normalized) ||
      memory.labelNormalized.includes(normalized) ||
      memory.valueNormalized.includes(normalized)
    );
  }

  async setPreference(key, value, label = key) {
    return this.remember({
      key: `preference.${key}`,
      label,
      value,
      type: "preference"
    });
  }

  async getPreference(key, fallback = null) {
    const memory = await this.get(`preference.${key}`);
    return memory?.value ?? fallback;
  }

  async getProfileName() {
    return (await this.get("profile.name"))?.value ?? null;
  }

  async summarizeFacts(limit = 12) {
    const all = await this.all();
    return all
      .filter((memory) => memory.type === "fact")
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, limit);
  }
}
