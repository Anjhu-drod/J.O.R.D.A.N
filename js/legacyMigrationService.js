import {
  getMigrationMarker,
  mergeCloudData,
  setMigrationMarker,
  waitForCloudSync
} from "./cloudDataService.js";

const LEGACY_DB_NAME = "JordanDB";
const DEVICE_KEY = "jordan.cloud.legacy-device-id";

function deviceMigrationId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function legacyDatabaseExists() {
  if (!indexedDB?.databases) return true;
  const databases = await indexedDB.databases();
  return databases.some((item) => item.name === LEGACY_DB_NAME);
}

async function readLegacyDatabase() {
  if (!("indexedDB" in window)) return null;
  if (!(await legacyDatabaseExists())) return null;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LEGACY_DB_NAME);

    request.onupgradeneeded = () => {
      // Banco inexistente: não criamos uma estrutura nova só para migrar.
      request.transaction?.abort();
    };

    request.onerror = () => {
      if (request.error?.name === "AbortError") resolve(null);
      else reject(request.error);
    };

    request.onsuccess = async () => {
      const db = request.result;
      try {
        const names = [...db.objectStoreNames];
        const result = { events: [], memories: [], settings: {} };

        if (names.includes("events")) {
          const tx = db.transaction("events", "readonly");
          result.events = await requestResult(tx.objectStore("events").getAll());
        }

        if (names.includes("memories")) {
          const tx = db.transaction("memories", "readonly");
          result.memories = await requestResult(tx.objectStore("memories").getAll());
        }

        if (names.includes("settings")) {
          const tx = db.transaction("settings", "readonly");
          const records = await requestResult(tx.objectStore("settings").getAll());
          for (const record of records || []) {
            if (!record?.key) continue;
            result.settings[record.key] = record.value;
          }
        }

        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        db.close();
      }
    };
  });
}

function deleteLegacyDatabase() {
  return new Promise((resolve) => {
    if (!("indexedDB" in window)) return resolve(false);
    const request = indexedDB.deleteDatabase(LEGACY_DB_NAME);
    request.onsuccess = () => resolve(true);
    request.onerror = () => resolve(false);
    request.onblocked = () => resolve(false);
  });
}

export async function migrateLegacyJordanDB() {
  const deviceId = deviceMigrationId();

  // Nunca arriscamos apagar o banco antigo durante uma inicialização offline.
  // Ele continua como cópia de segurança até o Firestore confirmar que recebeu
  // a migração deste aparelho.
  if (!navigator.onLine) {
    return {
      migrated: false,
      deferred: true,
      reason: "offline",
      deletedLegacy: false
    };
  }

  const marker = await getMigrationMarker(deviceId);
  if (marker?.completed) {
    return { migrated: false, reason: "already-migrated", deletedLegacy: false };
  }

  const legacy = await readLegacyDatabase();
  const total = (legacy?.events?.length || 0) + (legacy?.memories?.length || 0);
  const settingsCount = Object.keys(legacy?.settings || {}).length;

  if (!legacy || (total === 0 && settingsCount === 0)) {
    await setMigrationMarker(deviceId, { hadLegacyData: false, itemCount: 0 });
    const synced = await waitForCloudSync(7000);

    if (!synced) {
      return {
        migrated: false,
        deferred: true,
        reason: "sync-pending",
        deletedLegacy: false
      };
    }

    await deleteLegacyDatabase();
    return { migrated: false, reason: "empty", deletedLegacy: true };
  }

  await mergeCloudData(legacy);
  await setMigrationMarker(deviceId, {
    hadLegacyData: true,
    eventCount: legacy.events.length,
    memoryCount: legacy.memories.length,
    settingCount: settingsCount,
    sourceVersion: "<=0.6.1"
  });

  // Só removemos o JordanDB antigo depois de o backend confirmar TODAS as
  // escritas pendentes. Se o cliente estiver temporariamente offline, mantemos
  // o banco antigo e tentamos novamente quando a rede voltar.
  const synced = await waitForCloudSync(8000);
  if (!synced) {
    return {
      migrated: false,
      deferred: true,
      queued: true,
      reason: "sync-pending",
      eventCount: legacy.events.length,
      memoryCount: legacy.memories.length,
      settingCount: settingsCount,
      deletedLegacy: false
    };
  }

  const deletedLegacy = await deleteLegacyDatabase();

  return {
    migrated: true,
    eventCount: legacy.events.length,
    memoryCount: legacy.memories.length,
    settingCount: settingsCount,
    deletedLegacy
  };
}
