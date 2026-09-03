import {
  deleteCloudEvent,
  deleteCloudMemory,
  getAllCloudEvents,
  getAllCloudMemories,
  getAllCloudSettings,
  getCloudEvent,
  getCloudMemory,
  getCloudSetting,
  putCloudEvent,
  putCloudMemory,
  replaceCloudData,
  setCloudSetting,
  subscribeCloudChanges,
  waitForCloudSync
} from "./cloudDataService.js";
import { auth } from "./firebaseService.js";

// Compatibilidade com o restante da JORDAN: a partir da V0.7 este módulo não
// mantém mais agenda/memória em JordanDB. Ele encaminha as operações para o
// Cloud Firestore, cujo próprio cache persistente mantém o modo offline.
export async function openDatabase() {
  if (!auth.currentUser) {
    throw new Error("Nenhuma conta JORDAN autenticada.");
  }
  return true;
}

export async function putEvent(event) {
  return putCloudEvent(event);
}

export async function deleteEvent(id) {
  return deleteCloudEvent(id);
}

export async function getEvent(id) {
  return getCloudEvent(id);
}

export async function getAllEvents() {
  return getAllCloudEvents();
}

export async function getEventsBetween(start, end) {
  const events = await getAllCloudEvents();
  const startMs = start.getTime();
  const endMs = end.getTime();

  return events.filter((event) => {
    const eventMs = new Date(event.startAt).getTime();
    return eventMs >= startMs && eventMs < endMs;
  });
}

export async function putMemory(memory) {
  return putCloudMemory(memory);
}

export async function getMemory(idOrKey) {
  return getCloudMemory(idOrKey);
}

export async function deleteMemory(idOrKey) {
  return deleteCloudMemory(idOrKey);
}

export async function getAllMemories() {
  return getAllCloudMemories();
}

export async function setSetting(key, value) {
  return setCloudSetting(key, value);
}

export async function getSetting(key, fallback = null) {
  return getCloudSetting(key, fallback);
}

export async function exportMemory() {
  return {
    schemaVersion: 3,
    storage: "firebase-firestore",
    exportedAt: new Date().toISOString(),
    userUid: auth.currentUser?.uid || null,
    events: await getAllEvents(),
    memories: await getAllMemories(),
    settings: await getAllCloudSettings()
  };
}

export async function importMemory(data) {
  if (!data || !Array.isArray(data.events)) {
    throw new Error("Arquivo de backup inválido.");
  }

  await replaceCloudData({
    events: data.events.filter((event) => event?.id && event?.title && event?.startAt && event?.endAt),
    memories: Array.isArray(data.memories)
      ? data.memories.filter((memory) => memory?.id && memory?.key && memory?.value !== undefined)
      : [],
    settings: data.settings && typeof data.settings === "object" ? data.settings : {}
  });
}

export { subscribeCloudChanges, waitForCloudSync };
