const STORAGE_KEY = "jordan.automation-core-v1";
const MIN_INTERVAL_MS = 25;
const MAX_INTERVAL_MS = 3_600_000;

function normalizeTrigger(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^\s*jordan\s*[,;:!?.-]?\s*/i, "")
    .replace(/[^a-z0-9+\-_/ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampInterval(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 250;
  return Math.max(MIN_INTERVAL_MS, Math.min(MAX_INTERVAL_MS, Math.round(parsed)));
}

function normalizeAction(action = {}) {
  const kind = ["mouse_left", "mouse_right", "mouse_middle", "key", "screen_tap"].includes(action.kind)
    ? action.kind
    : "mouse_left";

  return {
    kind,
    key: String(action.key || "j").trim().slice(0, 40),
    fixedPoint: Boolean(action.fixedPoint),
    x: Number.isFinite(Number(action.x)) ? Math.round(Number(action.x)) : 0,
    y: Number.isFinite(Number(action.y)) ? Math.round(Number(action.y)) : 0
  };
}

function defaultState() {
  return {
    enabled: true,
    voiceMacrosEnabled: true,
    silentVoiceMacros: true,
    intervalMs: 250,
    action: normalizeAction({ kind: "mouse_left", key: "j" }),
    macros: []
  };
}

export class AutomationCoreService {
  constructor(nativeBridge) {
    this.nativeBridge = nativeBridge;
    this.state = defaultState();
    this.runtime = { running: false, count: 0, interval_ms: 250, last_error: null };
    this.capabilities = {
      platform: "web",
      native: false,
      global_input: false,
      mouse: false,
      keyboard: false,
      fixed_screen_tap: false,
      reason: "web-runtime"
    };
    this._load();
  }

  _load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object") return;
      this.state = {
        ...defaultState(),
        ...saved,
        intervalMs: clampInterval(saved.intervalMs),
        action: normalizeAction(saved.action),
        macros: Array.isArray(saved.macros)
          ? saved.macros
              .filter((item) => item && item.phrase)
              .slice(0, 40)
              .map((item) => ({
                id: String(item.id || globalThis.crypto?.randomUUID?.() || Date.now()),
                phrase: String(item.phrase).trim().slice(0, 80),
                action: normalizeAction(item.action)
              }))
          : []
      };
    } catch {
      this.state = defaultState();
    }
  }

  _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch { /* storage unavailable */ }
  }

  snapshot() {
    return {
      ...this.state,
      action: { ...this.state.action },
      macros: this.state.macros.map((item) => ({ ...item, action: { ...item.action } })),
      runtime: { ...this.runtime },
      capabilities: { ...this.capabilities }
    };
  }

  async init() {
    this.capabilities = await this.nativeBridge.automationCapabilities().catch((error) => ({
      platform: this.nativeBridge.platform || "web",
      native: Boolean(this.nativeBridge.native),
      global_input: false,
      mouse: false,
      keyboard: false,
      fixed_screen_tap: false,
      reason: error.message
    }));
    this.runtime = await this.nativeBridge.automationStatus().catch(() => this.runtime);
    return this.snapshot();
  }

  configure(patch = {}) {
    if ("enabled" in patch) this.state.enabled = Boolean(patch.enabled);
    if ("voiceMacrosEnabled" in patch) this.state.voiceMacrosEnabled = Boolean(patch.voiceMacrosEnabled);
    if ("silentVoiceMacros" in patch) this.state.silentVoiceMacros = Boolean(patch.silentVoiceMacros);
    if ("intervalMs" in patch) this.state.intervalMs = clampInterval(patch.intervalMs);
    if (patch.action) this.state.action = normalizeAction({ ...this.state.action, ...patch.action });
    this._save();
    return this.snapshot();
  }

  setAction(action) {
    this.state.action = normalizeAction(action);
    this._save();
    return { ...this.state.action };
  }

  setInterval(intervalMs) {
    this.state.intervalMs = clampInterval(intervalMs);
    this._save();
    return this.state.intervalMs;
  }

  addMacro({ phrase = "", action = {} } = {}) {
    const cleanPhrase = String(phrase || "").trim();
    const trigger = normalizeTrigger(cleanPhrase);
    if (!trigger) throw new Error("Digite uma frase para o comando de voz.");

    const existing = this.state.macros.find((item) => normalizeTrigger(item.phrase) === trigger);
    const next = {
      id: existing?.id || (globalThis.globalThis.crypto?.randomUUID?.() || `macro-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      phrase: cleanPhrase.slice(0, 80),
      action: normalizeAction(action)
    };

    this.state.macros = existing
      ? this.state.macros.map((item) => item.id === existing.id ? next : item)
      : [...this.state.macros, next].slice(-40);
    this._save();
    return next;
  }

  removeMacro(id) {
    const before = this.state.macros.length;
    this.state.macros = this.state.macros.filter((item) => item.id !== id);
    this._save();
    return this.state.macros.length !== before;
  }

  findVoiceMacro(transcript = "") {
    if (!this.state.enabled || !this.state.voiceMacrosEnabled) return null;
    const trigger = normalizeTrigger(transcript);
    if (!trigger) return null;
    return this.state.macros.find((item) => normalizeTrigger(item.phrase) === trigger) || null;
  }

  isStopPhrase(transcript = "") {
    const trigger = normalizeTrigger(transcript);
    return [
      "parar autoclick",
      "parar auto click",
      "pare o autoclick",
      "pare o auto click",
      "desligar autoclick",
      "desligue o autoclick",
      "stop autoclick"
    ].includes(trigger);
  }

  describeAction(action = this.state.action) {
    const normalized = normalizeAction(action);
    if (normalized.kind === "mouse_left") return normalized.fixedPoint ? `clique esquerdo em X${normalized.x} Y${normalized.y}` : "clique esquerdo";
    if (normalized.kind === "mouse_right") return normalized.fixedPoint ? `clique direito em X${normalized.x} Y${normalized.y}` : "clique direito";
    if (normalized.kind === "mouse_middle") return normalized.fixedPoint ? `clique do meio em X${normalized.x} Y${normalized.y}` : "clique do meio";
    if (normalized.kind === "screen_tap") return `toque em X${normalized.x} Y${normalized.y}`;
    return `tecla ${normalized.key || "?"}`;
  }

  _nativePayload(action = this.state.action) {
    const normalized = normalizeAction(action);
    return {
      kind: normalized.kind,
      key: normalized.kind === "key" ? normalized.key : null,
      x: normalized.fixedPoint || normalized.kind === "screen_tap" ? normalized.x : null,
      y: normalized.fixedPoint || normalized.kind === "screen_tap" ? normalized.y : null
    };
  }

  async executeOnce(action = this.state.action) {
    if (!this.state.enabled) return { ok: false, reason: "disabled" };
    const payload = this._nativePayload(action);
    const result = await this.nativeBridge.automationInputOnce(payload);
    if (result?.status) this.runtime = { ...this.runtime, ...result.status };
    return result;
  }

  async start({ action = this.state.action, intervalMs = this.state.intervalMs } = {}) {
    if (!this.state.enabled) return { ok: false, reason: "disabled" };
    const normalizedAction = normalizeAction(action);
    const normalizedInterval = clampInterval(intervalMs);
    this.state.action = normalizedAction;
    this.state.intervalMs = normalizedInterval;
    this._save();

    const result = await this.nativeBridge.automationStart({
      action: this._nativePayload(normalizedAction),
      intervalMs: normalizedInterval
    });
    if (result?.status) this.runtime = { ...this.runtime, ...result.status };
    return result;
  }

  async stop() {
    const result = await this.nativeBridge.automationStop();
    if (result?.status) this.runtime = { ...this.runtime, ...result.status };
    else this.runtime.running = false;
    return result;
  }

  async refreshRuntime() {
    this.runtime = await this.nativeBridge.automationStatus().catch(() => this.runtime);
    return { ...this.runtime };
  }

  async captureCursor() {
    const result = await this.nativeBridge.automationCursorPosition();
    if (result?.ok && Number.isFinite(result.x) && Number.isFinite(result.y)) {
      this.state.action = normalizeAction({ ...this.state.action, fixedPoint: true, x: result.x, y: result.y });
      this._save();
    }
    return result;
  }

  async handleVoiceTranscript(transcript = "") {
    if (this.isStopPhrase(transcript)) {
      const result = await this.stop().catch((error) => ({ ok: false, reason: error.message }));
      return { handled: true, type: "stop", ok: result.ok !== false, result };
    }

    const macro = this.findVoiceMacro(transcript);
    if (!macro) return { handled: false };

    const result = await this.executeOnce(macro.action).catch((error) => ({ ok: false, reason: error.message }));
    return {
      handled: true,
      type: "macro",
      macro,
      ok: result.ok !== false,
      silent: this.state.silentVoiceMacros,
      result
    };
  }
}

export { normalizeTrigger as normalizeAutomationTrigger, clampInterval as clampAutomationInterval };
