const CORE_NAME = "JORDAN LOCAL REASONING";
const SYSTEM_PROMPT = `You are JORDAN, a private personal assistant running locally on the user's device.
Answer naturally in Brazilian Portuguese unless the user explicitly requests another language.
Be concise but useful. Keep continuity with the recent conversation context provided by the app.
Do not claim to have performed device actions unless the app explicitly says the action was executed.
For dangerous electrical, medical, weapon, chemical, self-harm or other high-risk situations, prioritize safety and avoid giving reckless step-by-step instructions.
When you do not know something, say so instead of inventing facts.`;

function clip(value = "", max = 1200) {
  const text = String(value || "").trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export class LocalReasoningService {
  constructor() {
    this.session = null;
    this.availability = "unknown";
    this.lastError = null;
    this.progress = 0;
  }

  get api() {
    return globalThis.LanguageModel || null;
  }

  async status() {
    if (!this.api) {
      this.availability = "unavailable";
      return this.snapshot();
    }
    try {
      this.availability = await this.api.availability();
    } catch (error) {
      this.availability = "unavailable";
      this.lastError = error.message;
    }
    return this.snapshot();
  }

  snapshot() {
    return {
      name: CORE_NAME,
      supported: Boolean(this.api),
      ready: Boolean(this.session),
      availability: this.availability,
      progress: this.progress,
      lastError: this.lastError
    };
  }

  async prepare({ onProgress = null } = {}) {
    if (!this.api) throw new Error("A API de IA local não está disponível neste navegador/runtime.");
    if (this.session) return this.snapshot();

    this.availability = await this.api.availability();
    if (this.availability === "unavailable") throw new Error("Este dispositivo não oferece um modelo de linguagem local compatível.");

    this.session = await this.api.create({
      initialPrompts: [{ role: "system", content: SYSTEM_PROMPT }],
      monitor: (monitor) => {
        monitor.addEventListener("downloadprogress", (event) => {
          this.progress = Math.round(Number(event.loaded || 0) * 100);
          onProgress?.(this.progress);
        });
      }
    });
    this.availability = "available";
    this.progress = 100;
    return this.snapshot();
  }

  async answer(userText, context = {}) {
    if (!this.session) return { ok: false, reason: "not-ready" };

    const recent = Array.isArray(context?.recentConversation)
      ? context.recentConversation.slice(-6).map((item) => `${item.role}: ${clip(item.text, 280)}`).join("\n")
      : "";
    const memories = Array.isArray(context?.memories)
      ? context.memories.slice(0, 6).map((item) => `${item.label}: ${item.value}`).join("; ")
      : "";

    const prompt = [
      recent ? `Recent conversation:\n${recent}` : "",
      memories ? `Relevant user memory supplied by the app: ${clip(memories, 700)}` : "",
      `User message: ${clip(userText, 1800)}`,
      "Respond as JORDAN in Brazilian Portuguese."
    ].filter(Boolean).join("\n\n");

    try {
      const text = String(await this.session.prompt(prompt)).trim();
      return text ? { ok: true, text, source: "local-language-model" } : { ok: false, reason: "empty" };
    } catch (error) {
      this.lastError = error.message;
      return { ok: false, reason: error.message };
    }
  }

  destroy() {
    try { this.session?.destroy?.(); } catch { /* noop */ }
    this.session = null;
  }
}
