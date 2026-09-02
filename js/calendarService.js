import {
  deleteEvent,
  getAllEvents,
  getEvent,
  getEventsBetween,
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

export class CalendarService {
  async create({
    title,
    startAt,
    endAt,
    description = "",
    source = "manual",
    category = null,
    reminderOffsets = null
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
      reminderOffsets: reminderOffsets ?? buildReminderOffsets(profile, startAt, now),
      deliveredReminderKeys: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    await putEvent(event);
    return event;
  }

  async update(id, changes) {
    const existing = await getEvent(id);
    if (!existing) throw new Error("Compromisso não encontrado.");

    const updated = {
      ...existing,
      ...changes,
      id,
      titleNormalized: normalizeText(changes.title ?? existing.title),
      updatedAt: new Date().toISOString()
    };

    if (updated.startAt instanceof Date) updated.startAt = updated.startAt.toISOString();
    if (updated.endAt instanceof Date) updated.endAt = updated.endAt.toISOString();

    const start = new Date(updated.startAt);
    const end = new Date(updated.endAt);
    updated.durationMinutes = Math.max(1, Math.round((end - start) / 60000));

    // Ao remarcar um compromisso, os avisos ainda não entregues são recriados.
    if (changes.startAt || changes.endAt || changes.category) {
      const profile = getEventProfile(updated.category ?? "default");
      updated.reminderOffsets = buildReminderOffsets(
        profile,
        start,
        new Date()
      );
      updated.deliveredReminderKeys = [];
    }

    await putEvent(updated);
    return updated;
  }

  async remove(id) {
    await deleteEvent(id);
  }

  async get(id) {
    return getEvent(id);
  }

  async all() {
    const events = await getAllEvents();
    return events.map((event) => this.ensureDefaults(event));
  }

  async between(start, end) {
    const events = await getEventsBetween(start, end);
    return events.map((event) => this.ensureDefaults(event));
  }

  ensureDefaults(event) {
    const profile = getEventProfile(event.category ?? "default");
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);

    return {
      ...event,
      category: event.category ?? profile.id,
      durationMinutes:
        event.durationMinutes ?? Math.max(1, Math.round((end - start) / 60000)),
      reminderOffsets: event.reminderOffsets ?? profile.reminderOffsets,
      deliveredReminderKeys: event.deliveredReminderKeys ?? []
    };
  }

  async forDay(date) {
    return this.between(startOfDay(date), endOfDay(date));
  }

  async today() {
    return this.forDay(new Date());
  }

  async next(now = new Date()) {
    const all = await this.all();
    return all.find((event) => new Date(event.endAt) >= now) ?? null;
  }

  async upcoming(limit = 20, now = new Date()) {
    const all = await this.all();
    return all
      .filter((event) => new Date(event.endAt) >= now)
      .slice(0, limit);
  }

  async nextDays(days = 7) {
    const start = startOfDay(new Date());
    return this.between(start, addDays(start, days));
  }

  async search(query, { futureOnly = false } = {}) {
    const normalized = normalizeText(query);
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
    const all = await this.all();
    const start = startAt.getTime();
    const end = endAt.getTime();

    return all.filter((event) => {
      if (event.id === ignoreId) return false;

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

      if (gap >= minMinutes) {
        slots.push({ start: new Date(cursor), end: new Date(clippedStart) });
      }

      if (clippedEnd > cursor) cursor = new Date(clippedEnd);
    }

    const finalGap = Math.round((end - cursor) / 60000);
    if (finalGap >= minMinutes) {
      slots.push({ start: new Date(cursor), end: new Date(end) });
    }

    return slots;
  }
}
