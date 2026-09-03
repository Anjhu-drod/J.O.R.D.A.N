export class SystemTelemetryService {
  constructor({ onUpdate = null } = {}) {
    this.onUpdate = onUpdate || (() => {});
    this.timer = null;
    this.execution = "idle";
    this.last = {
      online: navigator.onLine,
      downlinkMbps: 0,
      latencyMs: null,
      storageUsage: 0,
      storageQuota: 0,
      storageFreeRatio: 1,
      execution: "idle"
    };
  }

  setExecution(state = "idle") {
    this.execution = state;
    this.last.execution = state;
    this.onUpdate({ ...this.last });
  }

  async measureLatency() {
    if (!navigator.onLine) return null;
    const started = performance.now();
    try {
      await fetch(`./manifest.webmanifest?jordanPing=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin"
      });
      return Math.max(1, Math.round(performance.now() - started));
    } catch {
      return null;
    }
  }

  async measureStorage() {
    if (!navigator.storage?.estimate) return { usage: 0, quota: 0, freeRatio: 1 };
    try {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      const freeRatio = quota > 0 ? Math.max(0, Math.min(1, (quota - usage) / quota)) : 1;
      return { usage, quota, freeRatio };
    } catch {
      return { usage: 0, quota: 0, freeRatio: 1 };
    }
  }

  async sample() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const [latencyMs, storage] = await Promise.all([
      this.measureLatency(),
      this.measureStorage()
    ]);

    const downlinkMbps = navigator.onLine
      ? Number(connection?.downlink || (latencyMs ? Math.max(0.2, Math.min(50, 30 / (latencyMs / 100))) : 1))
      : 0;

    this.last = {
      online: navigator.onLine,
      downlinkMbps,
      latencyMs,
      storageUsage: storage.usage,
      storageQuota: storage.quota,
      storageFreeRatio: storage.freeRatio,
      execution: this.execution
    };
    this.onUpdate({ ...this.last });
    return this.last;
  }

  start() {
    this.stop();
    this.sample();
    this.timer = setInterval(() => this.sample(), 12000);
    window.addEventListener("online", this._online = () => this.sample());
    window.addEventListener("offline", this._offline = () => this.sample());
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    if (this._online) window.removeEventListener("online", this._online);
    if (this._offline) window.removeEventListener("offline", this._offline);
  }
}
