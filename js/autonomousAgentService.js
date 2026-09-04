const DEFAULT_ENDPOINT = "http://127.0.0.1:8787";
const MAX_TOOL_ROUNDS = 8;

function normalizeEndpoint(value = "") {
  return String(value || DEFAULT_ENDPOINT).trim().replace(/\/+$/, "");
}

function isLoopback(url = "") {
  return /^http:\/\/(127(?:\.\d+){3}|localhost|\[::1\])(?::\d+)?/i.test(url);
}

async function postJson(url, body, timeoutMs = 45_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const options = {
      method: "POST",
      mode: "cors",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    };
    if (isLoopback(url)) options.targetAddressSpace = "loopback";
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.detail || payload?.error || `Agent Core HTTP ${response.status}`;
      const error = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      error.status = response.status;
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

export class AutonomousAgentService {
  constructor({ endpoint = DEFAULT_ENDPOINT, enabled = true } = {}) {
    this.endpoint = normalizeEndpoint(endpoint);
    this.enabled = Boolean(enabled);
    this.lastResponseId = null;
    this.lastHealth = null;
    this.lastHealthAt = 0;
  }

  configure({ endpoint = this.endpoint, enabled = this.enabled } = {}) {
    const nextEndpoint = normalizeEndpoint(endpoint);
    if (nextEndpoint !== this.endpoint) this.resetConversation();
    this.endpoint = nextEndpoint;
    this.enabled = Boolean(enabled);
  }

  resetConversation() {
    this.lastResponseId = null;
  }

  async health({ force = false } = {}) {
    if (!this.enabled) return { ok: false, enabled: false, reason: "disabled" };
    if (!force && this.lastHealth && Date.now() - this.lastHealthAt < 30_000) return this.lastHealth;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const options = { method: "GET", mode: "cors", cache: "no-store", signal: controller.signal };
      if (isLoopback(this.endpoint)) options.targetAddressSpace = "loopback";
      try {
        const response = await fetch(`${this.endpoint}/agent/health`, options);
        const data = await response.json().catch(() => ({}));
        this.lastHealth = response.ok ? { ok: true, ...data } : { ok: false, reason: data?.detail || `HTTP ${response.status}` };
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      this.lastHealth = { ok: false, reason: error?.name === "AbortError" ? "timeout" : "unreachable", error };
    }

    this.lastHealthAt = Date.now();
    return this.lastHealth;
  }

  async execute(message, { context = {}, toolHandlers = {}, onToolCall = null } = {}) {
    if (!this.enabled) return null;
    const text = String(message || "").trim();
    if (!text) return null;

    let previousResponseId = this.lastResponseId;
    let toolOutputs = null;
    let initialMessage = text;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const payload = await postJson(`${this.endpoint}/agent/turn`, {
        message: initialMessage,
        previous_response_id: previousResponseId,
        tool_outputs: toolOutputs,
        context
      });

      if (payload.response_id) previousResponseId = payload.response_id;
      const calls = Array.isArray(payload.tool_calls) ? payload.tool_calls : [];

      if (!calls.length) {
        this.lastResponseId = previousResponseId || this.lastResponseId;
        return {
          text: String(payload.text || "").trim(),
          speak: String(payload.speak || payload.text || "").trim(),
          mood: payload.mood || "neutral",
          source: "agent",
          model: payload.model || null,
          responseId: previousResponseId || null
        };
      }

      toolOutputs = [];
      for (const call of calls) {
        const name = String(call?.name || "");
        const handler = toolHandlers[name];
        onToolCall?.(call);

        let output;
        try {
          if (typeof handler !== "function") {
            output = { ok: false, error: `Ferramenta não implementada no dispositivo: ${name}` };
          } else {
            output = await handler(call.arguments || {});
            if (output === undefined) output = { ok: true };
          }
        } catch (error) {
          output = { ok: false, error: error?.message || String(error) };
        }

        toolOutputs.push({ call_id: call.call_id, output });
      }

      initialMessage = "";
    }

    throw new Error("O Agent Core excedeu o limite de ações desta solicitação.");
  }
}

export const DEFAULT_JORDAN_AGENT_ENDPOINT = DEFAULT_ENDPOINT;
