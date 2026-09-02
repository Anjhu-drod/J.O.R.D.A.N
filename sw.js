const CACHE_NAME = "jordan-v0.5.0";

const APP_SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
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
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

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
