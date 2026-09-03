import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { FIREBASE_CONFIG } from "./firebaseConfig.js";

export const firebaseApp = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(firebaseApp);

let firestoreInstance;
let persistentCacheEnabled = true;

try {
  firestoreInstance = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (error) {
  // Se o navegador não permitir persistência ou o Firestore já tiver sido
  // inicializado, ainda deixamos a JORDAN funcionar usando a instância padrão.
  console.warn("JORDAN Cloud: cache persistente indisponível, usando fallback.", error);
  persistentCacheEnabled = false;
  firestoreInstance = getFirestore(firebaseApp);
}

export const firestore = firestoreInstance;
export const FIREBASE_SDK_VERSION = "12.18.0";

export function hasPersistentFirestoreCache() {
  return persistentCacheEnabled;
}
