export function createId(prefix = "evt") {
  if (crypto?.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function normalizeText(text = "") {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[?!,;.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function capitalize(text = "") {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date = new Date()) {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDate(date, options = {}) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options
  }).format(date);
}

export function formatLongDate(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(date);
}

export function formatTime(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatDateTime(date) {
  return `${formatLongDate(date)} às ${formatTime(date)}`;
}

export function minutesBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 60000);
}

export function humanDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (!rest) return `${hours}h`;
  return `${hours}h${String(rest).padStart(2, "0")}`;
}

export function humanCountdown(target, now = new Date()) {
  const minutes = Math.max(0, minutesBetween(now, target));

  if (minutes < 1) return "agora";
  if (minutes < 60) return `em ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (hours < 24) {
    return remaining ? `em ${hours}h ${remaining}min` : `em ${hours}h`;
  }

  const days = Math.floor(hours / 24);
  return days === 1 ? "em 1 dia" : `em ${days} dias`;
}

export function toDateInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function toTimeInputValue(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
