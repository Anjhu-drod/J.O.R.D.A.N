const CACHE_NAME = "jordan-v0.7.1";
const FIREBASE_CACHE = "jordan-firebase-v12.18.0";

const APP_SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/authService.js",
  "./js/firebaseConfig.js",
  "./js/firebaseService.js",
  "./js/cloudDataService.js",
  "./js/legacyMigrationService.js",
  "./js/assistant.js",
  "./js/calendarService.js",
  "./js/dateParser.js",
  "./js/db.js",
  "./js/eventProfiles.js",
  "./js/memoryService.js",
  "./js/knowledgeBase.js",
  "./js/internetService.js",
  "./js/languageService.js",
  "./js/jordanVoiceProfile.js",
  "./js/systemCommandService.js",
  "./js/locationService.js",
  "./js/mediaService.js",
  "./js/jordanMusicService.js",
  "./js/intentEngine.js",
  "./js/scienceService.js",
  "./js/appLauncherService.js",
  "./js/originalSongService.js",
  "./js/semanticLexicon.js",
  "./js/personalityService.js",
  "./js/storyService.js",
  "./js/reminderService.js",
  "./js/ui.js",
  "./js/utils.js",
  "./js/voice.js",
  "./manifest.webmanifest",
  "./assets/jordan-symbol.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => ![CACHE_NAME, FIREBASE_CACHE].includes(key))
        .map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  // Os módulos do Firebase são necessários até quando a JORDAN reinicia offline.
  // Depois da primeira abertura online, guardamos as respostas versionadas do
  // CDN oficial para que os imports ESM continuem disponíveis sem conexão.
  const isFirebaseModule =
    requestUrl.hostname === "www.gstatic.com" &&
    requestUrl.pathname.startsWith("/firebasejs/12.18.0/");

  if (isFirebaseModule) {
    event.respondWith(
      caches.open(FIREBASE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;

        const response = await fetch(event.request);
        if (response.ok || response.type === "opaque") {
          cache.put(event.request, response.clone());
        }
        return response;
      })
    );
    return;
  }

  // Demais APIs externas continuam network-only.
  if (!isSameOrigin) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
