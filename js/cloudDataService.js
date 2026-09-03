import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  waitForPendingWrites,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { auth, firestore } from "./firebaseService.js";

let settingsCache = null;
let settingsCacheUid = null;

const WRITE_ACK_TIMEOUT_MS = 3500;
const SYNC_TIMEOUT_MS = 6500;

function requireUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("JORDAN Cloud precisa de uma conta autenticada.");
  return uid;
}

function pathFor(kind, id) {
  return doc(firestore, "users", requireUid(), kind, id);
}

function collectionFor(kind) {
  return collection(firestore, "users", requireUid(), kind);
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (!value || typeof value !== "object") return value;

  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    result[key] = stripUndefined(item);
  }
  return result;
}

function delay(ms, value) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export function isCloudOfflineError(error) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();

  return !navigator.onLine
    || code.includes("unavailable")
    || code.includes("network-request-failed")
    || message.includes("client is offline")
    || message.includes("network error")
    || message.includes("failed to fetch")
    || message.includes("network request failed");
}

async function readDocument(ref) {
  try {
    return await getDoc(ref);
  } catch (error) {
    if (!isCloudOfflineError(error)) throw error;

    try {
      return await getDocFromCache(ref);
    } catch {
      // Primeiro uso offline: ainda não existe cópia desse documento no cache.
      // Isso não é fatal; a JORDAN usa o fallback local/default e sincroniza
      // quando a rede voltar.
      return null;
    }
  }
}

async function readQuery(source) {
  try {
    return await getDocs(source);
  } catch (error) {
    if (!isCloudOfflineError(error)) throw error;

    try {
      return await getDocsFromCache(source);
    } catch {
      return null;
    }
  }
}

function logBackgroundWriteError(label, error) {
  if (isCloudOfflineError(error)) {
    console.info(`JORDAN Cloud: ${label} continua aguardando conexão.`);
    return;
  }
  console.warn(`JORDAN Cloud: falha posterior em ${label}.`, error);
}

// O SDK do Firestore aplica uma escrita imediatamente na visão/cache local,
// porém a Promise da escrita pode permanecer pendente até o servidor confirmar.
// Se aguardássemos essa Promise para sempre, um comando da JORDAN poderia ficar
// travado durante uma queda de internet. Mantemos a Promise viva em segundo
// plano, mas liberamos a interface depois de alguns segundos.
async function queueAwareWrite(writePromise, label = "escrita") {
  const tracked = Promise.resolve(writePromise).then(
    () => ({ acknowledged: true, queued: false, error: null }),
    (error) => ({ acknowledged: false, queued: isCloudOfflineError(error), error })
  );

  if (!navigator.onLine) {
    tracked.then((result) => {
      if (result.error) logBackgroundWriteError(label, result.error);
    });
    return { acknowledged: false, queued: true };
  }

  const result = await Promise.race([
    tracked,
    delay(WRITE_ACK_TIMEOUT_MS, { acknowledged: false, queued: true, timedOut: true })
  ]);

  if (result?.timedOut) {
    tracked.then((lateResult) => {
      if (lateResult.error) logBackgroundWriteError(label, lateResult.error);
    });
    return { acknowledged: false, queued: true };
  }

  if (result.error) {
    if (result.queued) {
      logBackgroundWriteError(label, result.error);
      return { acknowledged: false, queued: true };
    }
    throw result.error;
  }

  return result;
}

export async function putCloudEvent(event) {
  const clean = stripUndefined(event);
  await queueAwareWrite(setDoc(pathFor("events", clean.id), clean), `evento ${clean.id}`);
  return event;
}

export async function deleteCloudEvent(id) {
  await queueAwareWrite(deleteDoc(pathFor("events", id)), `exclusão de evento ${id}`);
}

export async function getCloudEvent(id) {
  const snap = await readDocument(pathFor("events", id));
  return snap?.exists?.() ? snap.data() : null;
}

export async function getAllCloudEvents() {
  const source = query(collectionFor("events"), orderBy("startAt", "asc"));
  const snap = await readQuery(source);
  return snap ? snap.docs.map((item) => item.data()) : [];
}

export async function putCloudMemory(memory) {
  const clean = stripUndefined(memory);
  await queueAwareWrite(setDoc(pathFor("memories", clean.id), clean), `memória ${clean.id}`);
  return memory;
}

export async function getCloudMemory(idOrKey) {
  const direct = await readDocument(pathFor("memories", idOrKey));
  if (direct?.exists?.()) return direct.data();

  const byKey = await readQuery(query(
    collectionFor("memories"),
    where("key", "==", idOrKey),
    limit(1)
  ));

  return !byKey || byKey.empty ? null : byKey.docs[0].data();
}

export async function deleteCloudMemory(idOrKey) {
  const directRef = pathFor("memories", idOrKey);
  const direct = await readDocument(directRef);
  if (direct?.exists?.()) {
    await queueAwareWrite(deleteDoc(directRef), `exclusão de memória ${idOrKey}`);
    return;
  }

  const byKey = await readQuery(query(
    collectionFor("memories"),
    where("key", "==", idOrKey),
    limit(1)
  ));

  if (byKey && !byKey.empty) {
    await queueAwareWrite(deleteDoc(byKey.docs[0].ref), `exclusão de memória ${idOrKey}`);
  }
}

export async function getAllCloudMemories() {
  const snap = await readQuery(collectionFor("memories"));
  if (!snap) return [];

  return snap.docs.map((item) => item.data()).sort(
    (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
  );
}

function settingsRef() {
  return doc(firestore, "users", requireUid(), "config", "settings");
}

async function loadSettings() {
  const uid = requireUid();
  if (settingsCache && settingsCacheUid === uid) return settingsCache;

  const snap = await readDocument(settingsRef());
  settingsCache = snap?.exists?.() ? snap.data() : {};
  settingsCacheUid = uid;
  return settingsCache;
}

export async function setCloudSetting(key, value) {
  const settings = await loadSettings();
  settings[key] = value;
  await queueAwareWrite(
    setDoc(settingsRef(), { [key]: stripUndefined(value) }, { merge: true }),
    `configuração ${key}`
  );
}

export async function getCloudSetting(key, fallback = null) {
  const settings = await loadSettings();
  return Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] : fallback;
}

export async function getAllCloudSettings() {
  return { ...(await loadSettings()) };
}

export function clearCloudSessionCache() {
  settingsCache = null;
  settingsCacheUid = null;
}

async function clearCollection(kind) {
  const snap = await readQuery(collectionFor(kind));
  if (!snap) return { queued: true };

  const docs = [...snap.docs];
  let queued = false;

  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(firestore);
    docs.slice(i, i + 450).forEach((item) => batch.delete(item.ref));
    const result = await queueAwareWrite(batch.commit(), `limpeza de ${kind}`);
    queued ||= Boolean(result.queued);
  }

  return { queued };
}

async function writeDocuments(kind, values = []) {
  let queued = false;

  for (let i = 0; i < values.length; i += 400) {
    const batch = writeBatch(firestore);
    let hasWrites = false;

    for (const value of values.slice(i, i + 400)) {
      if (!value?.id) continue;
      batch.set(pathFor(kind, value.id), stripUndefined(value));
      hasWrites = true;
    }

    if (!hasWrites) continue;
    const result = await queueAwareWrite(batch.commit(), `lote de ${kind}`);
    queued ||= Boolean(result.queued);
  }

  return { queued };
}

export async function replaceCloudData({ events = [], memories = [], settings = {} }) {
  const clearEvents = await clearCollection("events");
  const clearMemories = await clearCollection("memories");
  const eventWrite = await writeDocuments("events", events);
  const memoryWrite = await writeDocuments("memories", memories);

  settingsCache = { ...settings };
  settingsCacheUid = requireUid();
  const settingsWrite = await queueAwareWrite(
    setDoc(settingsRef(), stripUndefined(settings)),
    "restauração das configurações"
  );

  return {
    queued: Boolean(
      clearEvents.queued
      || clearMemories.queued
      || eventWrite.queued
      || memoryWrite.queued
      || settingsWrite.queued
    )
  };
}

export async function mergeCloudData({ events = [], memories = [], settings = {} }) {
  const eventWrite = await writeDocuments("events", events);
  const memoryWrite = await writeDocuments("memories", memories);
  let settingsQueued = false;

  if (settings && Object.keys(settings).length) {
    const current = await loadSettings();
    Object.assign(current, settings);
    const result = await queueAwareWrite(
      setDoc(settingsRef(), stripUndefined(settings), { merge: true }),
      "migração das configurações"
    );
    settingsQueued = Boolean(result.queued);
  }

  return { queued: eventWrite.queued || memoryWrite.queued || settingsQueued };
}

export async function waitForCloudSync(timeoutMs = SYNC_TIMEOUT_MS) {
  if (!navigator.onLine) return false;

  const tracked = waitForPendingWrites(firestore).then(
    () => ({ synced: true, error: null }),
    (error) => ({ synced: false, error })
  );

  const result = await Promise.race([
    tracked,
    delay(Math.max(1000, Number(timeoutMs) || SYNC_TIMEOUT_MS), { synced: false, timedOut: true })
  ]);

  if (result?.timedOut) return false;
  if (result.error) {
    if (isCloudOfflineError(result.error)) return false;
    throw result.error;
  }

  return true;
}

export function subscribeCloudChanges(callback) {
  const uid = requireUid();
  let eventState = { fromCache: true, pending: false };
  let memoryState = { fromCache: true, pending: false };
  let settingsState = { fromCache: true, pending: false };

  const emit = (kind) => callback?.({
    kind,
    fromCache: eventState.fromCache && memoryState.fromCache && settingsState.fromCache,
    pending: eventState.pending || memoryState.pending || settingsState.pending,
    online: navigator.onLine
  });

  const handleSnapshotError = (error) => {
    if (isCloudOfflineError(error)) {
      callback?.({ kind: "offline", fromCache: true, pending: true, online: false });
      return;
    }
    callback?.({ kind: "error", error, online: navigator.onLine });
  };

  const unsubscribeEvents = onSnapshot(
    collection(firestore, "users", uid, "events"),
    { includeMetadataChanges: true },
    (snap) => {
      eventState = {
        fromCache: snap.metadata.fromCache,
        pending: snap.metadata.hasPendingWrites
      };
      emit("events");
    },
    handleSnapshotError
  );

  const unsubscribeMemories = onSnapshot(
    collection(firestore, "users", uid, "memories"),
    { includeMetadataChanges: true },
    (snap) => {
      memoryState = {
        fromCache: snap.metadata.fromCache,
        pending: snap.metadata.hasPendingWrites
      };
      emit("memories");
    },
    handleSnapshotError
  );

  const unsubscribeSettings = onSnapshot(
    doc(firestore, "users", uid, "config", "settings"),
    { includeMetadataChanges: true },
    (snap) => {
      settingsState = {
        fromCache: snap.metadata.fromCache,
        pending: snap.metadata.hasPendingWrites
      };

      if (snap.exists()) {
        settingsCache = snap.data();
        settingsCacheUid = uid;
      }

      emit("settings");
    },
    handleSnapshotError
  );

  return () => {
    unsubscribeEvents();
    unsubscribeMemories();
    unsubscribeSettings();
  };
}

export async function getMigrationMarker(deviceId) {
  const ref = doc(firestore, "users", requireUid(), "migrations", deviceId);
  const snap = await readDocument(ref);
  return snap?.exists?.() ? snap.data() : null;
}

export async function setMigrationMarker(deviceId, data = {}) {
  const ref = doc(firestore, "users", requireUid(), "migrations", deviceId);
  return queueAwareWrite(setDoc(ref, {
    ...stripUndefined(data),
    completed: true,
    completedAt: new Date().toISOString()
  }, { merge: true }), `marcador de migração ${deviceId}`);
}
