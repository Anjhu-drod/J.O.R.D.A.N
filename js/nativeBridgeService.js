const DEFAULT_RELEASE_BASE = "https://github.com/anjhu-drod/J.O.R.D.A.N/releases/latest/download";

function detectWebPlatform() {
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/windows/i.test(ua)) return "windows";
  if (/macintosh|mac os x/i.test(ua)) return "macos";
  if (/linux/i.test(ua)) return "linux";
  return "web";
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export class NativeBridgeService {
  constructor() {
    this.native = false;
    this.platform = detectWebPlatform();
    this.version = "0.13.0";
    this.backgroundCapable = false;
    this.autostart = false;
    this.lastError = null;
  }

  get tauri() {
    return globalThis.__TAURI__ || null;
  }

  async invoke(command, args = {}) {
    const invoker = this.tauri?.core?.invoke;
    if (typeof invoker !== "function") throw new Error("Tauri IPC indisponível.");
    return invoker(command, args);
  }

  async init() {
    this.native = Boolean(this.tauri?.core?.invoke);
    if (!this.native) return this.status();

    try {
      const info = await this.invoke("jordan_platform");
      this.platform = info?.platform || this.platform;
      this.version = info?.version || this.version;
      this.backgroundCapable = Boolean(info?.background_capable);
    } catch (error) {
      this.lastError = error.message;
    }

    try {
      this.autostart = Boolean(await this.invoke("get_autostart"));
    } catch {
      this.autostart = false;
    }

    return this.status();
  }

  status() {
    return {
      native: this.native,
      platform: this.platform,
      version: this.version,
      backgroundCapable: this.backgroundCapable,
      autostart: this.autostart,
      mode: this.native ? "native" : "web",
      lastError: this.lastError
    };
  }

  async setAutostart(enabled) {
    if (!this.native) {
      this.autostart = false;
      return { ok: false, reason: "web-runtime" };
    }
    this.autostart = Boolean(await this.invoke("set_autostart", { enabled: Boolean(enabled) }));
    return { ok: true, enabled: this.autostart };
  }

  async minimize() {
    if (!this.native) return { ok: false, reason: "web-runtime" };
    try {
      await this.invoke("minimize_main");
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error.message };
    }
  }

  async hideToBackground() {
    if (!this.native) return { ok: false, reason: "web-runtime" };
    try {
      await this.invoke("hide_main");
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error.message };
    }
  }

  async showMain() {
    if (!this.native) return { ok: false, reason: "web-runtime" };
    try {
      await this.invoke("show_main");
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error.message };
    }
  }

  async openUrl(rawUrl, { title = "JORDAN Browser", inApp = true } = {}) {
    const url = safeHttpUrl(rawUrl);
    if (!url) return { ok: false, reason: "invalid-url" };

    if (this.native) {
      try {
        if (inApp) {
          const nativeMode = await this.invoke("open_jordan_webview", { url, title });
          return { ok: true, mode: nativeMode || "jordan-window", url };
        }

        await this.invoke("open_external_url", { url });
        return { ok: true, mode: "external", url };
      } catch (error) {
        this.lastError = error.message;
      }
    }

    const popup = window.open(url, "_blank", "noopener,noreferrer");
    return { ok: Boolean(popup), mode: popup ? "browser-tab" : "blocked", url, reason: popup ? null : "popup-blocked" };
  }

  async launchTarget(target, { inApp = true } = {}) {
    if (!target?.url) return { ok: false, reason: "missing-target" };

    const opened = await this.openUrl(target.url, { title: target.label || "JORDAN Browser", inApp });
    return { ...opened, app: target.label };
  }

  async openYoutube(query = "") {
    const clean = String(query || "").trim();
    const url = clean
      ? `https://www.youtube.com/results?search_query=${encodeURIComponent(clean)}`
      : "https://www.youtube.com/";
    return this.openUrl(url, { title: clean ? `YouTube · ${clean}` : "YouTube", inApp: true });
  }

  downloadTargets() {
    return {
      windows: `${DEFAULT_RELEASE_BASE}/JORDAN-Windows-x64-setup.exe`,
      android: `${DEFAULT_RELEASE_BASE}/JORDAN-Android-universal.apk`,
      ios: `${DEFAULT_RELEASE_BASE}/JORDAN-iOS.ipa`
    };
  }
}
