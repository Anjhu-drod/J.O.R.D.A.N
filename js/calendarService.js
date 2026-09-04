import {
  deleteEvent,
  getAllEvents,
  getEvent,
  putEvent
} from "./db.js";

import {
  addDays,
  createId,
  endOfDay,
  normalizeText,
  startOfDay
} from "./utils.js";

import {
  buildReminderOffsets,
  detectEventProfile,
  getEventProfile
} from "./eventProfiles.js";
import { getSystemBirthdays } from "./lineageConfig.js";

const DAY_MS = 86400000;

function addYears(date, years) {
  const value = new Date(date);
  value.setFullYear(value.getFullYear() + years);
  return value;
}

function overlaps(event, start, end) {
  const eventStart = new Date(event.startAt).getTime();
  const eventEnd = new Date(event.endAt).getTime();
  return eventStart < end.getTime() && eventEnd > start.getTime();
}

export class CalendarService {
  async create({
    title,
    startAt,
    endAt,
    description = "",
    source = "manual",
    category = null,
    reminderOffsets = null,
    allDay = false,
    recurrence = null,
    locked = false,
    system = false
  }) {
    const now = new Date();
    const profile = category
      ? getEventProfile(category)
      : detectEventProfile(`${title} ${description}`);

    const durationMinutes = Math.max(
      1,
      Math.round((endAt.getTime() - startAt.getTime()) / 60000)
    );

    const event = {
      id: createId(),
      title: title.trim(),
      titleNormalized: normalizeText(title),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      durationMinutes,
      description: description.trim(),
      source,
      category: profile.id,
      allDay: Boolean(allDay),
      recurrence: recurrence || null,
      locked: Boolean(locked),
      system: Boolean(system),
      reminderOffsets: allDay
        ? (reminderOffsets ?? [720, 0])
        : (reminderOffsets ?? buildReminderOffsets(profile, startAt, now)),
      deliveredReminderKeys: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    await putEvent(event);
    return event;
  }

  baseId(id = "") {
    return String(id).split("::")[0];
  }

  async update(id, changes) {
    if (String(id).startsWith("system-birthday-")) {
      throw new Error("Aniversários da linhagem são eventos fixos do sistema.");
    }

    const baseId = this.baseId(id);
    const existing = await getEvent(baseId);
    if (!existing) throw new Error("Compromisso não encontrado.");
    if (existing.locked) throw new Error("Este compromisso é protegido pelo sistema.");

    const updated = {
      ...existing,
      ...changes,
      id: baseId,
      titleNormalized: normalizeText(changes.title ?? existing.title),
      updatedAt: new Date().toISOString()
    };

    if (updated.startAt instanceof Date) updated.startAt = updated.startAt.toISOString();
    if (updated.endAt instanceof Date) updated.endAt = updated.endAt.toISOString();

    const start = new Date(updated.startAt);
    const end = new Date(updated.endAt);
    updated.durationMinutes = Math.max(1, Math.round((end - start) / 60000));

    if (changes.startAt || changes.endAt || changes.category || changes.allDay) {
      const profile = getEventProfile(updated.category ?? "default");
      updated.reminderOffsets = updated.allDay
        ? [720, 0]
        : buildReminderOffsets(profile, start, new Date());
      updated.deliveredReminderKeys = [];
    }

    await putEvent(updated);
    return updated;
  }

  async remove(id) {
    if (String(id).startsWith("system-birthday-")) {
      throw new Error("Aniversários da linhagem não podem ser removidos.");
    }
    const baseId = this.baseId(id);
    const event = await getEvent(baseId);
    if (event?.locked) throw new Error("Este compromisso é protegido pelo sistema.");
    await deleteEvent(baseId);
  }

  async get(id) {
    if (String(id).startsWith("system-birthday-")) {
      const match = String(id).match(/^system-birthday-([a-z]+)-(\d{4})$/);
      if (!match) return null;
      return this.systemBirthdayForYear(match[1], Number(match[2]));
    }

    const [baseId, yearText] = String(id).split("::");
    const event = await getEvent(baseId);
    if (!event) return null;
    if (yearText && event.recurrence?.frequency === "yearly") {
      return this.yearlyOccurrence(this.ensureDefaults(event), Number(yearText));
    }
    return this.ensureDefaults(event);
  }

  ensureDefaults(event) {
    const profile = getEventProfile(event.category ?? "default");
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);

    return {
      ...event,
      category: event.category ?? profile.id,
      allDay: Boolean(event.allDay),
      recurrence: event.recurrence || null,
      locked: Boolean(event.locked),
      system: Boolean(event.system),
      durationMinutes:
        event.durationMinutes ?? Math.max(1, Math.round((end - start) / 60000)),
      reminderOffsets: event.reminderOffsets ?? profile.reminderOffsets,
      deliveredReminderKeys: event.deliveredReminderKeys ?? []
    };
  }

  yearlyOccurrence(event, year) {
    const originalStart = new Date(event.startAt);
    const originalEnd = new Date(event.endAt);
    const start = new Date(year, originalStart.getMonth(), originalStart.getDate(), originalStart.getHours(), originalStart.getMinutes(), 0, 0);
    const duration = Math.max(1, originalEnd.getTime() - originalStart.getTime());
    const end = new Date(start.getTime() + duration);
    return {
      ...event,
      id: `${event.id}::${year}`,
      recurrenceParentId: event.id,
      virtualOccurrence: true,
      startAt: start.toISOString(),
      endAt: end.toISOString()
    };
  }

  systemBirthdayForYear(identityId, year) {
    const item = getSystemBirthdays().find((entry) => entry.identityId === identityId);
    if (!item) return null;
    const start = new Date(year, item.month - 1, item.day, 0, 0, 0, 0);
    const end = new Date(start.getTime() + DAY_MS);
    return {
      id: `system-birthday-${identityId}-${year}`,
      title: item.title,
      titleNormalized: normalizeText(item.title),
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      durationMinutes: 1440,
      description: "Aniversário fixo da linhagem JORDAN.",
      source: "lineage-system",
      category: "birthday",
      allDay: true,
      recurrence: { frequency: "yearly", interval: 1 },
      locked: true,
      system: true,
      reminderOffsets: [],
      deliveredReminderKeys: []
    };
  }

  systemBirthdaysBetween(start, end) {
    const result = [];
    for (let year = start.getFullYear() - 1; year <= end.getFullYear() + 1; year++) {
      for (const birthday of getSystemBirthdays()) {
        const occurrence = this.systemBirthdayForYear(birthday.identityId, year);
        if (occurrence && overlaps(occurrence, start, end)) result.push(occurrence);
      }
    }
    return result;
  }

  recurringOccurrence(event, startAt) {
    const originalStart = new Date(event.startAt);
    const originalEnd = new Date(event.endAt);
    const duration = Math.max(1, originalEnd.getTime() - originalStart.getTime());
    const occurrenceStart = new Date(startAt);
    return {
      ...event,
      id: `${event.id}::r${occurrenceStart.getTime()}`,
      recurrenceParentId: event.id,
      virtualOccurrence: true,
      startAt: occurrenceStart.toISOString(),
      endAt: new Date(occurrenceStart.getTime() + duration).toISOString()
    };
  }

  expandForRange(event, start, end) {
    const normalized = this.ensureDefaults(event);
    const recurrence = normalized.recurrence;
    if (!recurrence) return overlaps(normalized, start, end) ? [normalized] : [];
    if (recurrence.frequency === "yearly") {
      const result = [];
      for (let year = start.getFullYear() - 1; year <= end.getFullYear() + 1; year++) {
        const occurrence = this.yearlyOccurrence(normalized, year);
        if (overlaps(occurrence, start, end)) result.push(occurrence);
      }
      return result;
    }

    const interval = Math.max(1, Number(recurrence.interval || 1));
    const base = new Date(normalized.startAt);
    const result = [];

    if (recurrence.frequency === "daily" || recurrence.frequency === "weekly") {
      const stepDays = interval * (recurrence.frequency === "weekly" ? 7 : 1);
      const stepMs = stepDays * DAY_MS;
      let index = Math.max(0, Math.floor((start.getTime() - base.getTime()) / stepMs) - 1);
      let occurrenceStart = new Date(base.getTime() + index * stepMs);
      let guard = 0;
      while (occurrenceStart < end && guard++ < 5000) {
        const occurrence = this.recurringOccurrence(normalized, occurrenceStart);
        if (overlaps(occurrence, start, end)) result.push(occurrence);
        index += 1;
        occurrenceStart = new Date(base.getTime() + index * stepMs);
      }
      return result;
    }

    if (recurrence.frequency === "monthly") {
      let index = Math.max(0, ((start.getFullYear() - base.getFullYear()) * 12 + start.getMonth() - base.getMonth()) - interval);
      index = Math.floor(index / interval) * interval;
      let guard = 0;
      while (guard++ < 500) {
        const occurrenceStart = new Date(base);
        occurrenceStart.setMonth(base.getMonth() + index);
        if (occurrenceStart >= end) break;
        const occurrence = this.recurringOccurrence(normalized, occurrenceStart);
        if (overlaps(occurrence, start, end)) result.push(occurrence);
        index += interval;
      }
      return result;
    }

    return overlaps(normalized, start, end) ? [normalized] : [];
  }

  async between(start, end) {
    const stored = await getAllEvents();
    const expanded = stored.flatMap((event) => this.expandForRange(event, start, end));
    const birthdays = this.systemBirthdaysBetween(start, end);
    return [...expanded, ...birthdays].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  }

  async all() {
    const now = new Date();
    return this.between(addYears(now, -1), addYears(now, 3));
  }

  async forDay(date) {
    return this.between(startOfDay(date), endOfDay(date));
  }

  async today() {
    return this.forDay(new Date());
  }

  async next(now = new Date()) {
    const upcoming = await this.upcoming(1, now);
    return upcoming[0] ?? null;
  }

  async upcoming(limit = 20, now = new Date()) {
    const events = await this.between(now, addYears(now, 3));
    return events
      .filter((event) => new Date(event.endAt) >= now)
      .slice(0, limit);
  }

  async nextDays(days = 7) {
    const start = startOfDay(new Date());
    return this.between(start, addDays(start, days));
  }

  async search(searchText, { futureOnly = false } = {}) {
    const normalized = normalizeText(searchText);
    const now = new Date();
    const all = await this.all();

    return all.filter((event) => {
      const matches =
        event.titleNormalized.includes(normalized) ||
        normalizeText(event.description || "").includes(normalized);

      const futureOk = !futureOnly || new Date(event.endAt) >= now;
      return matches && futureOk;
    });
  }

  async conflicts(startAt, endAt, ignoreId = null) {
    const candidates = await this.between(addDays(startAt, -1), addDays(endAt, 1));
    const start = startAt.getTime();
    const end = endAt.getTime();

    return candidates.filter((event) => {
      if (event.id === ignoreId || event.recurrenceParentId === ignoreId) return false;
      if (event.allDay) return false;
      const eventStart = new Date(event.startAt).getTime();
      const eventEnd = new Date(event.endAt).getTime();
      return start < eventEnd && end > eventStart;
    });
  }

  async freeSlots(date, {
    dayStartHour = 8,
    dayEndHour = 22,
    minMinutes = 30
  } = {}) {
    const events = (await this.forDay(date))
      .filter((event) => !event.allDay)
      .map((event) => ({
        ...event,
        start: new Date(event.startAt),
        end: new Date(event.endAt)
      }))
      .sort((a, b) => a.start - b.start);

    const start = startOfDay(date);
    start.setHours(dayStartHour, 0, 0, 0);

    const end = startOfDay(date);
    end.setHours(dayEndHour, 0, 0, 0);

    const slots = [];
    let cursor = new Date(start);

    for (const event of events) {
      if (event.end <= start || event.start >= end) continue;

      const clippedStart = event.start < start ? start : event.start;
      const clippedEnd = event.end > end ? end : event.end;
      const gap = Math.round((clippedStart - cursor) / 60000);

      if (gap >= minMinutes) slots.push({ start: new Date(cursor), end: new Date(clippedStart) });
      if (clippedEnd > cursor) cursor = new Date(clippedEnd);
    }

    const finalGap = Math.round((end - cursor) / 60000);
    if (finalGap >= minMinutes) slots.push({ start: new Date(cursor), end: new Date(end) });

    return slots;
  }
}
