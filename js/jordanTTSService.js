const HEALTH_CACHE_MS = 45_000;
const DEFAULT_ENDPOINT = "http://127.0.0.1:8787";

function normalizedEndpoint(value = "") {
  return String(value || DEFAULT_ENDPOINT).trim().replace(/\/+$/, "");
}

function isLoopback(url = "") {
  return /^http:\/\/(127(?:\.\d+){3}|localhost|\[::1\])(?::\d+)?/i.test(url);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Chromium 2026 pode solicitar permissão explícita para loopback/local network.
    // Navegadores que ainda não conhecem targetAddressSpace simplesmente ignoram.
    const requestOptions = { ...options, signal: controller.signal };
    if (isLoopback(url) && !requestOptions.targetAddressSpace) {
      requestOptions.targetAddressSpace = "loopback";
    }
    return await fetch(url, requestOptions);
  } finally {
    clearTimeout(timer);
  }
}

export class JordanTTSService {
  constructor({ endpoint = DEFAULT_ENDPOINT, enabled = true } = {}) {
    this.endpoint = normalizedEndpoint(endpoint);
    this.enabled = Boolean(enabled);
    this.audio = null;
    this.abortController = null;
    this.lastHealth = null;
    this.lastHealthAt = 0;
    this.currentObjectUrl = null;
  }

  setEndpoint(endpoint) {
    this.endpoint = normalizedEndpoint(endpoint);
    this.lastHealth = null;
    this.lastHealthAt = 0;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this.stop();
  }

  get label() {
    return "JORDAN Spark Neural V1";
  }

  get isPlaying() {
    return Boolean(this.audio && !this.audio.paused && !this.audio.ended);
  }

  async health({ force = false } = {}) {
    if (!this.enabled || !this.endpoint) {
      return { ok: false, reason: "disabled", endpoint: this.endpoint };
    }

    if (!force && this.lastHealth && Date.now() - this.lastHealthAt < HEALTH_CACHE_MS) {
      return this.lastHealth;
    }

    try {
      const response = await fetchWithTimeout(`${this.endpoint}/health`, {
        method: "GET",
        cache: "no-store",
        mode: "cors"
      }, 3500);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json().catch(() => ({}));
      this.lastHealth = { ok: true, endpoint: this.endpoint, ...data };
    } catch (error) {
      this.lastHealth = {
        ok: false,
        endpoint: this.endpoint,
        reason: error?.name === "AbortError" ? "timeout" : "unreachable",
        error
      };
    }

    this.lastHealthAt = Date.now();
    return this.lastHealth;
  }

  stop() {
    try { this.abortController?.abort(); } catch {}
    this.abortController = null;

    if (this.audio) {
      try { this.audio.pause(); } catch {}
      try { this.audio.removeAttribute("src"); } catch {}
      try { this.audio.load(); } catch {}
      this.audio = null;
    }

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
  }

  async speak(text, {
    emotion = "auto",
    volume = 1,
    tuning = {},
    timeoutMs = 90_000,
    onStart = null,
    onEnd = null
  } = {}) {
    if (!this.enabled || !String(text || "").trim()) return false;

    this.stop();
    this.abortController = new AbortController();
    const controller = this.abortController;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${this.endpoint}/speak`, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: String(text), emotion, tuning: tuning || {} }),
        signal: controller.signal,
        ...(isLoopback(this.endpoint) ? { targetAddressSpace: "loopback" } : {})
      });

      if (!response.ok) {
        const message = await response.text().catch(() => "");
        throw new Error(message || `Voice Core HTTP ${response.status}`);
      }

      const blob = await response.blob();
      if (controller.signal.aborted) return false;

      const objectUrl = URL.createObjectURL(blob);
      this.currentObjectUrl = objectUrl;
      const audio = new Audio(objectUrl);
      audio.preload = "auto";
      audio.volume = Math.max(0, Math.min(1, Number(volume) || 1));
      this.audio = audio;

      await new Promise((resolve, reject) => {
        const cleanup = () => {
          audio.onended = null;
          audio.onerror = null;
          audio.onplay = null;
        };

        audio.onplay = () => onStart?.();
        audio.onended = () => {
          cleanup();
          onEnd?.();
          resolve();
        };
        audio.onerror = () => {
          cleanup();
          reject(new Error("Não consegui reproduzir o áudio neural da JORDAN."));
        };

        audio.play().catch((error) => {
          cleanup();
          reject(error);
        });
      });

      return true;
    } finally {
      clearTimeout(timer);
      if (this.abortController === controller) this.abortController = null;
      if (this.audio?.ended) this.audio = null;
      if (this.currentObjectUrl) {
        URL.revokeObjectURL(this.currentObjectUrl);
        this.currentObjectUrl = null;
      }
    }
  }
}

export const DEFAULT_JORDAN_TTS_ENDPOINT = DEFAULT_ENDPOINT;
