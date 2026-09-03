import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
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

export async function putCloudEvent(event) {
  const clean = stripUndefined(event);
  await setDoc(pathFor("events", clean.id), clean);
  return event;
}

export async function deleteCloudEvent(id) {
  await deleteDoc(pathFor("events", id));
}

export async function getCloudEvent(id) {
  const snap = await getDoc(pathFor("events", id));
  return snap.exists() ? snap.data() : null;
}

export async function getAllCloudEvents() {
  const snap = await getDocs(query(collectionFor("events"), orderBy("startAt", "asc")));
  return snap.docs.map((item) => item.data());
}

export async function putCloudMemory(memory) {
  const clean = stripUndefined(memory);
  await setDoc(pathFor("memories", clean.id), clean);
  return memory;
}

export async function getCloudMemory(idOrKey) {
  const direct = await getDoc(pathFor("memories", idOrKey));
  if (direct.exists()) return direct.data();

  const byKey = await getDocs(query(
    collectionFor("memories"),
    where("key", "==", idOrKey),
    limit(1)
  ));
  return byKey.empty ? null : byKey.docs[0].data();
}

export async function deleteCloudMemory(idOrKey) {
  const directRef = pathFor("memories", idOrKey);
  const direct = await getDoc(directRef);
  if (direct.exists()) {
    await deleteDoc(directRef);
    return;
  }

  const byKey = await getDocs(query(
    collectionFor("memories"),
    where("key", "==", idOrKey),
    limit(1)
  ));

  if (!byKey.empty) await deleteDoc(byKey.docs[0].ref);
}

export async function getAllCloudMemories() {
  const snap = await getDocs(collectionFor("memories"));
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

  const snap = await getDoc(settingsRef());
  settingsCache = snap.exists() ? snap.data() : {};
  settingsCacheUid = uid;
  return settingsCache;
}

export async function setCloudSetting(key, value) {
  const settings = await loadSettings();
  settings[key] = value;
  await setDoc(settingsRef(), { [key]: stripUndefined(value) }, { merge: true });
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
  const snap = await getDocs(collectionFor(kind));
  const docs = [...snap.docs];

  for (let i = 0; i < docs.length; i += 450) {
    const batch = writeBatch(firestore);
    docs.slice(i, i + 450).forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
}

async function writeDocuments(kind, values = []) {
  for (let i = 0; i < values.length; i += 400) {
    const batch = writeBatch(firestore);
    for (const value of values.slice(i, i + 400)) {
      if (!value?.id) continue;
      batch.set(pathFor(kind, value.id), stripUndefined(value));
    }
    await batch.commit();
  }
}

export async function replaceCloudData({ events = [], memories = [], settings = {} }) {
  await clearCollection("events");
  await clearCollection("memories");
  await writeDocuments("events", events);
  await writeDocuments("memories", memories);
  settingsCache = { ...settings };
  settingsCacheUid = requireUid();
  await setDoc(settingsRef(), stripUndefined(settings));
}

export async function mergeCloudData({ events = [], memories = [], settings = {} }) {
  await writeDocuments("events", events);
  await writeDocuments("memories", memories);
  if (settings && Object.keys(settings).length) {
    const current = await loadSettings();
    Object.assign(current, settings);
    await setDoc(settingsRef(), stripUndefined(settings), { merge: true });
  }
}

export async function waitForCloudSync() {
  await waitForPendingWrites(firestore);
}

export function subscribeCloudChanges(callback) {
  const uid = requireUid();
  let eventState = { fromCache: true, pending: false };
  let memoryState = { fromCache: true, pending: false };

  const emit = (kind) => callback?.({
    kind,
    fromCache: eventState.fromCache && memoryState.fromCache,
    pending: eventState.pending || memoryState.pending,
    online: navigator.onLine
  });

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
    (error) => callback?.({ kind: "error", error, online: navigator.onLine })
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
    (error) => callback?.({ kind: "error", error, online: navigator.onLine })
  );

  return () => {
    unsubscribeEvents();
    unsubscribeMemories();
  };
}

export async function getMigrationMarker(deviceId) {
  const ref = doc(firestore, "users", requireUid(), "migrations", deviceId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function setMigrationMarker(deviceId, data = {}) {
  const ref = doc(firestore, "users", requireUid(), "migrations", deviceId);
  await setDoc(ref, {
    ...stripUndefined(data),
    completed: true,
    completedAt: new Date().toISOString()
  }, { merge: true });
}
