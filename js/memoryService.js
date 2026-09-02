import {
  deleteMemory,
  getAllMemories,
  getMemory,
  putMemory
} from "./db.js";
import { createId, normalizeText } from "./utils.js";

// Memórias centrais são parte da identidade local da JORDAN.
// Elas são restauradas na inicialização e não podem ser apagadas/alteradas
// por conversa, importação de backup ou pela interface.
const CORE_MEMORIES = Object.freeze([
  Object.freeze({
    id: "core.creator",
    key: "core.creator",
    label: "Criador",
    value: "Jhuan",
    spokenValue: "Ruan",
    pronunciation: "Ruan",
    type: "core",
    source: "system-core",
    protected: true
  }),
  Object.freeze({
    id: "core.creatorPronunciation",
    key: "core.creatorPronunciation",
    label: "Pronúncia do criador",
    value: "Ruan",
    spokenValue: "Ruan",
    pronunciation: "Ruan",
    type: "core",
    source: "system-core",
    protected: true
  })
]);

function coreMemoryFor(idOrKey = "") {
  return CORE_MEMORIES.find(
    (memory) => memory.id === idOrKey || memory.key === idOrKey
  ) ?? null;
}

export class MemoryService {
  async ensureCoreMemories() {
    const now = new Date().toISOString();

    for (const definition of CORE_MEMORIES) {
      const existing = await getMemory(definition.key);
      await putMemory({
        ...definition,
        labelNormalized: normalizeText(definition.label),
        valueNormalized: normalizeText(definition.value),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      });
    }
  }

  async remember({
    key,
    label,
    value,
    type = "fact",
    source = "conversation",
    internal = false
  }) {
    const protectedDefinition = key ? coreMemoryFor(key) : null;

    if (protectedDefinition && !internal) {
      await this.ensureCoreMemories();
      return this.get(protectedDefinition.key);
    }

    const now = new Date().toISOString();
    const existing = key ? await getMemory(key) : null;

    if (existing?.protected && !internal) {
      return existing;
    }

    const memory = {
      id: existing?.id ?? key ?? createId("mem"),
      key: key ?? existing?.key ?? createId("fact"),
      label: label?.trim() || existing?.label || "Informação",
      labelNormalized: normalizeText(label || existing?.label || "informacao"),
      value: String(value).trim(),
      valueNormalized: normalizeText(String(value)),
      type: internal ? (type || existing?.type || "core") : type,
      source,
      protected: Boolean(internal && protectedDefinition) || Boolean(existing?.protected),
      pronunciation: existing?.pronunciation,
      spokenValue: existing?.spokenValue,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    await putMemory(memory);
    return memory;
  }

  async forget(idOrKey) {
    const memory = await getMemory(idOrKey);
    if (memory?.protected || coreMemoryFor(idOrKey)) {
      await this.ensureCoreMemories();
      return false;
    }

    await deleteMemory(idOrKey);
    return true;
  }

  async all() {
    const memories = await getAllMemories();
    return memories.sort((a, b) => {
      if (a.protected && !b.protected) return -1;
      if (!a.protected && b.protected) return 1;
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });
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

  async getCreator() {
    await this.ensureCoreMemories();
    return this.get("core.creator");
  }

  async summarizeFacts(limit = 12) {
    const all = await this.all();
    return all
      .filter((memory) => memory.type === "fact")
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, limit);
  }
}
