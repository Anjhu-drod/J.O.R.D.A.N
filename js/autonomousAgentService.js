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
        const available = Boolean(data?.available);
        this.lastHealth = {
          ...data,
          httpOk: response.ok,
          reachable: response.ok,
          available,
          ok: Boolean(response.ok && available),
          reason: response.ok
            ? (available ? null : (data?.reason || "Agent Core não configurado."))
            : (data?.detail || data?.reason || `HTTP ${response.status}`)
        };
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      this.lastHealth = { ok: false, reason: error?.name === "AbortError" ? "timeout" : "unreachable", error };
    }

    this.lastHealthAt = Date.now();
    return this.lastHealth;
  }

  async diagnose() {
    if (!this.enabled) return { ok: false, enabled: false, reason: "disabled" };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15_000);
      const options = { method: "GET", mode: "cors", cache: "no-store", signal: controller.signal };
      if (isLoopback(this.endpoint)) options.targetAddressSpace = "loopback";
      try {
        const response = await fetch(`${this.endpoint}/agent/diagnose`, options);
        const data = await response.json().catch(() => ({}));
        const result = {
          ...data,
          reachable: response.ok,
          httpOk: response.ok,
          available: Boolean(data?.available),
          ok: Boolean(response.ok && data?.ok),
          reason: data?.reason || (response.ok ? null : `HTTP ${response.status}`)
        };
        this.lastHealth = result;
        this.lastHealthAt = Date.now();
        return result;
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      const result = { ok: false, reachable: false, available: false, reason: error?.name === "AbortError" ? "timeout" : (error?.message || "unreachable"), error };
      this.lastHealth = result;
      this.lastHealthAt = Date.now();
      return result;
    }
  }

  async execute(message, { context = {}, toolHandlers = {}, onToolCall = null } = {}) {
    if (!this.enabled) return null;
    const text = String(message || "").trim();
    if (!text) return null;

    const health = await this.health().catch(() => null);
    if (health && !health.ok) {
      const error = new Error(health.reason || "JORDAN Agent Core indisponível.");
      error.code = health.reachable ? "agent-unavailable" : "agent-unreachable";
      throw error;
    }

    let previousResponseId = this.lastResponseId;
    let toolOutputs = null;
    let initialMessage = text;
    let retriedConversation = false;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      let payload;
      try {
        payload = await postJson(`${this.endpoint}/agent/turn`, {
          message: initialMessage,
          previous_response_id: previousResponseId,
          tool_outputs: toolOutputs,
          context
        });
      } catch (error) {
        // Se o servidor perdeu um previous_response_id antigo, recomeçamos a
        // conversa uma única vez em vez de jogar o usuário no fallback legado.
        if (!toolOutputs && previousResponseId && !retriedConversation && [400, 404, 409].includes(Number(error?.status))) {
          retriedConversation = true;
          previousResponseId = null;
          this.lastResponseId = null;
          initialMessage = text;
          round -= 1;
          continue;
        }
        throw error;
      }

      if (payload.response_id) previousResponseId = payload.response_id;
      const calls = Array.isArray(payload.tool_calls) ? payload.tool_calls : [];

      if (!calls.length) {
        const answerText = String(payload.text || "").trim();
        if (!answerText) throw new Error("O Agent Core respondeu sem texto e sem ação.");
        this.lastResponseId = previousResponseId || this.lastResponseId;
        this.lastHealth = { ok: true, reachable: true, available: true, model: payload.model || this.lastHealth?.model || null };
        this.lastHealthAt = Date.now();
        return {
          text: answerText,
          speak: String(payload.speak || answerText).trim(),
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
