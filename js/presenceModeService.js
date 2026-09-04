import { normalizeText } from "./utils.js";

function parseClock(text = "") {
  const t = normalizeText(text);
  const m = t.match(/\b(?:as|a|para)\s*(\d{1,2})(?::(\d{2}))?\s*(?:h|horas?)?\b/);
  if (!m) return null;
  const hour = Number(m[1]), minute = Number(m[2] || 0);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}`;
}

export class PresenceModeService {
  constructor({ getSetting, setSetting } = {}) {
    this.getSetting = getSetting;
    this.setSetting = setSetting;
    this.sleeping = false;
    this.silent = false;
    this.sleepTime = null;
    this.sleepReminderTime = null;
    this.lastReminderDate = "";
  }

  async initialize() {
    this.sleeping = Boolean(await this.getSetting?.("presence.sleeping", false));
    this.silent = Boolean(await this.getSetting?.("presence.silent", false));
    this.sleepTime = await this.getSetting?.("presence.sleepTime", null);
    this.sleepReminderTime = await this.getSetting?.("presence.sleepReminderTime", null);
    return this.state();
  }

  state() { return { sleeping:this.sleeping, silent:this.silent, sleepTime:this.sleepTime, sleepReminderTime:this.sleepReminderTime }; }
  isWake(text = "") { return /^\s*(?:jordan[\s,:-]*)?bom dia[!.?]*\s*$/i.test(text); }
  isSleep(text = "") { return /^\s*(?:jordan[\s,:-]*)?boa noite[!.?]*\s*$/i.test(text); }
  isEmergency(text = "") { return /^\s*(?:jordan[\s,:-]*)?(?:socorro|emergencia|emergência)[!.?]*\s*$/i.test(text); }
  isSilence(text = "") { return /^\s*(?:jordan[\s,:-]*)?(?:silencio|silêncio|fica quieta)[!.?]*\s*$/i.test(text); }

  async enterSleep() { this.sleeping = true; this.silent = false; await this.setSetting?.("presence.sleeping", true); await this.setSetting?.("presence.silent", false); }
  async wake() { this.sleeping = false; this.silent = false; await this.setSetting?.("presence.sleeping", false); await this.setSetting?.("presence.silent", false); }
  async enterSilence() { this.silent = true; await this.setSetting?.("presence.silent", true); }
  async clearSilence() { if (!this.silent) return; this.silent = false; await this.setSetting?.("presence.silent", false); }

  async parseSchedule(raw = "") {
    const text = normalizeText(raw);
    const cancel = /\b(cancele|cancelar|remova|apague)\b.*\b(horario de dormir|hora de dormir|sono)\b/.test(text);
    if (cancel) {
      this.sleepTime = null; this.sleepReminderTime = null;
      await this.setSetting?.("presence.sleepTime", null);
      await this.setSetting?.("presence.sleepReminderTime", null);
      return { handled:true, text:"Beleza. Removi o horário programado de sono." };
    }
    const time = parseClock(raw);
    if (!time) return null;
    if (/\b(me lembre|lembrete|avise|avisa)\b.*\b(dormir|sono)\b/.test(text)) {
      this.sleepReminderTime = time;
      await this.setSetting?.("presence.sleepReminderTime", time);
      return { handled:true, text:`Fechou. Vou te lembrar de dormir às ${time}.` };
    }
    if (/\b(programe|programa|modo sono|durma|dormir)\b/.test(text)) {
      this.sleepTime = time;
      await this.setSetting?.("presence.sleepTime", time);
      return { handled:true, text:`Modo sono programado para ${time}.` };
    }
    return null;
  }

  due(now = new Date()) {
    const hhmm = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
    const dateKey = now.toISOString().slice(0,10);
    return {
      shouldSleep: Boolean(this.sleepTime && !this.sleeping && hhmm === this.sleepTime),
      shouldRemind: Boolean(this.sleepReminderTime && hhmm === this.sleepReminderTime && this.lastReminderDate !== dateKey),
      dateKey
    };
  }
}
