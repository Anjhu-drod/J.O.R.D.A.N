const DB_NAME = "JordanDB";
const DB_VERSION = 2;

const STORES = {
  events: "events",
  settings: "settings",
  memories: "memories"
};

let dbPromise = null;

export function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB não está disponível neste navegador."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORES.events)) {
        const events = db.createObjectStore(STORES.events, { keyPath: "id" });
        events.createIndex("startAt", "startAt", { unique: false });
        events.createIndex("titleNormalized", "titleNormalized", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: "key" });
      }

      if (!db.objectStoreNames.contains(STORES.memories)) {
        const memories = db.createObjectStore(STORES.memories, { keyPath: "id" });
        memories.createIndex("key", "key", { unique: false });
        memories.createIndex("type", "type", { unique: false });
        memories.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

async function storeTransaction(storeName, mode = "readonly") {
  const db = await openDatabase();
  return db.transaction(storeName, mode).objectStore(storeName);
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putEvent(event) {
  const store = await storeTransaction(STORES.events, "readwrite");
  await requestToPromise(store.put(event));
  return event;
}

export async function deleteEvent(id) {
  const store = await storeTransaction(STORES.events, "readwrite");
  await requestToPromise(store.delete(id));
}

export async function getEvent(id) {
  const store = await storeTransaction(STORES.events);
  return requestToPromise(store.get(id));
}

export async function getAllEvents() {
  const store = await storeTransaction(STORES.events);
  const events = await requestToPromise(store.getAll());
  return events.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
}

export async function getEventsBetween(start, end) {
  const events = await getAllEvents();
  const startMs = start.getTime();
  const endMs = end.getTime();

  return events.filter((event) => {
    const eventMs = new Date(event.startAt).getTime();
    return eventMs >= startMs && eventMs < endMs;
  });
}

export async function putMemory(memory) {
  const store = await storeTransaction(STORES.memories, "readwrite");
  await requestToPromise(store.put(memory));
  return memory;
}

export async function getMemory(idOrKey) {
  const store = await storeTransaction(STORES.memories);

  const byId = await requestToPromise(store.get(idOrKey));
  if (byId) return byId;

  const index = store.index("key");
  return requestToPromise(index.get(idOrKey));
}

export async function deleteMemory(idOrKey) {
  const store = await storeTransaction(STORES.memories, "readwrite");

  const direct = await requestToPromise(store.get(idOrKey));
  if (direct) {
    await requestToPromise(store.delete(direct.id));
    return;
  }

  const index = store.index("key");
  const found = await requestToPromise(index.get(idOrKey));
  if (found) {
    await requestToPromise(store.delete(found.id));
  }
}

export async function getAllMemories() {
  const store = await storeTransaction(STORES.memories);
  const memories = await requestToPromise(store.getAll());

  return memories.sort(
    (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
  );
}

export async function setSetting(key, value) {
  const store = await storeTransaction(STORES.settings, "readwrite");
  await requestToPromise(store.put({ key, value }));
}

export async function getSetting(key, fallback = null) {
  const store = await storeTransaction(STORES.settings);
  const result = await requestToPromise(store.get(key));
  return result?.value ?? fallback;
}

export async function exportMemory() {
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    events: await getAllEvents(),
    memories: await getAllMemories(),
    settings: {
      voiceEnabled: await getSetting("voiceEnabled", true),
      alwaysListening: await getSetting("alwaysListening", true),
      assistantVolume: await getSetting("assistantVolume", 1),
      languageMode: await getSetting("languageMode", "pt")
    }
  };
}

export async function importMemory(data) {
  if (!data || !Array.isArray(data.events)) {
    throw new Error("Arquivo de backup inválido.");
  }

  const db = await openDatabase();
  const transaction = db.transaction(
    [STORES.events, STORES.settings, STORES.memories],
    "readwrite"
  );

  const eventsStore = transaction.objectStore(STORES.events);
  const settingsStore = transaction.objectStore(STORES.settings);
  const memoriesStore = transaction.objectStore(STORES.memories);

  eventsStore.clear();
  memoriesStore.clear();

  for (const event of data.events) {
    if (event?.id && event?.title && event?.startAt && event?.endAt) {
      eventsStore.put(event);
    }
  }

  if (Array.isArray(data.memories)) {
    for (const memory of data.memories) {
      if (memory?.id && memory?.key && memory?.value !== undefined) {
        memoriesStore.put(memory);
      }
    }
  }

  if (data.settings && typeof data.settings === "object") {
    for (const [key, value] of Object.entries(data.settings)) {
      settingsStore.put({ key, value });
    }
  }

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}
