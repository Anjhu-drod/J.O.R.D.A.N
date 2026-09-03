const CACHE_NAME = "jordan-v0.8.1";
const FIREBASE_CACHE = "jordan-firebase-v12.18.0";

const APP_SHELL = [
  "./",
  "./index.html",
  "./css/styles.css?v=0.8.1",
  "./js/app.js?v=0.8.1",
  "./js/authService.js",
  "./js/lineageConfig.js",
  "./js/lineageService.js",
  "./js/lineageAdminService.js",
  "./js/systemTelemetryService.js",
  "./js/voiceIdentityService.js",
  "./js/visualEffectsService.js",
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
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("jordan-v") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (response?.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;

    if (request.mode === "navigate") {
      return (await cache.match("./index.html")) || Response.error();
    }
    throw error;
  }
}

async function cacheFirstFirebase(request) {
  const cache = await caches.open(FIREBASE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok || response.type === "opaque") {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  const sameOrigin = requestUrl.origin === self.location.origin;
  const firebaseModule =
    requestUrl.hostname === "www.gstatic.com" &&
    requestUrl.pathname.startsWith("/firebasejs/12.18.0/");

  if (firebaseModule) {
    event.respondWith(cacheFirstFirebase(event.request));
    return;
  }

  if (!sameOrigin) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Código e HTML usam network-first. Assim uma nova versão do GitHub nunca
  // fica presa atrás de um app.js antigo salvo pelo Service Worker.
  event.respondWith(networkFirst(event.request));
});
