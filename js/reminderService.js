import { formatTime } from "./utils.js";

export class ReminderService {
  constructor(calendar, {
    onReminder = () => {},
    scanIntervalMs = 15000
  } = {}) {
    this.calendar = calendar;
    this.onReminder = onReminder;
    this.scanIntervalMs = scanIntervalMs;
    this.interval = null;
    this.running = false;
  }

  get notificationSupported() {
    return "Notification" in window;
  }

  get notificationPermission() {
    if (!this.notificationSupported) return "unsupported";
    return Notification.permission;
  }

  async requestPermission() {
    if (!this.notificationSupported) return "unsupported";
    return Notification.requestPermission();
  }

  start() {
    if (this.interval) return;

    this.scan();
    this.interval = setInterval(() => this.scan(), this.scanIntervalMs);
  }

  stop() {
    clearInterval(this.interval);
    this.interval = null;
  }

  async scan() {
    if (this.running || document.visibilityState !== "visible") return;
    this.running = true;

    try {
      const now = new Date();
      const events = await this.calendar.upcoming(100, new Date(now.getTime() - 2 * 60000));

      for (const event of events) {
        await this.checkEvent(event, now);
      }
    } finally {
      this.running = false;
    }
  }

  async checkEvent(event, now) {
    const start = new Date(event.startAt);
    const offsets = Array.isArray(event.reminderOffsets) ? event.reminderOffsets : [30, 10, 0];
    const delivered = new Set(event.deliveredReminderKeys ?? []);
    let changed = false;

    for (const offset of offsets) {
      const key = `offset:${offset}`;
      if (delivered.has(key)) continue;

      const fireAt = new Date(start.getTime() - offset * 60000);
      const lateBy = now.getTime() - fireAt.getTime();

      if (lateBy < 0) continue;

      // Janela de tolerância. Se o navegador ficou fechado por muito tempo,
      // não queremos que a JORDAN dispare uma fila de avisos antigos ao abrir.
      if (lateBy > 90000) {
        delivered.add(key);
        changed = true;
        continue;
      }

      const message = this.buildMessage(event, offset, start);
      await this.fire(event, message);
      delivered.add(key);
      changed = true;
    }

    if (changed) {
      await this.calendar.update(event.id, {
        deliveredReminderKeys: [...delivered]
      });
    }
  }

  buildMessage(event, offset, start) {
    if (offset === 0) {
      return `Está na hora de ${event.title}.`;
    }

    if (offset === 1) {
      return `Falta 1 minuto para ${event.title}.`;
    }

    return `Faltam ${offset} minutos para ${event.title}. Está marcado para ${formatTime(start)}.`;
  }

  async fire(event, message) {
    if (this.notificationPermission === "granted") {
      try {
        new Notification("JORDAN", {
          body: message,
          icon: "./assets/icon-192.png",
          tag: `jordan-${event.id}`,
          renotify: true
        });
      } catch {}
    }

    await this.onReminder({ event, message });
  }
}
