import { normalizeText } from "./utils.js";

const DB_NAME = "JordanMusicDB";
const DB_VERSION = 1;
const TRACK_STORE = "tracks";

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openMusicDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB não está disponível neste navegador."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(TRACK_STORE)) {
        const store = db.createObjectStore(TRACK_STORE, { keyPath: "id" });
        store.createIndex("titleNormalized", "titleNormalized", { unique: false });
        store.createIndex("artistNormalized", "artistNormalized", { unique: false });
        store.createIndex("addedAt", "addedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function fingerprintFile(file) {
  const raw = `${file.name}|${file.size}|${file.lastModified || 0}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `music_${(hash >>> 0).toString(16)}`;
}

function isAudioFile(file) {
  if (!file) return false;
  if (String(file.type || "").startsWith("audio/")) return true;
  return /\.(mp3|m4a|aac|wav|ogg|opus|flac|webm)$/i.test(file.name || "");
}

function parseFileName(name = "") {
  const clean = String(name).replace(/\.[a-z0-9]{2,5}$/i, "").trim();
  const parts = clean.split(/\s+(?:-|–|—)\s+/);

  if (parts.length >= 2) {
    return {
      artist: parts.shift().trim() || "Biblioteca local",
      title: parts.join(" - ").trim() || clean
    };
  }

  return { artist: "Biblioteca local", title: clean || "Faixa sem nome" };
}

function formatSeconds(seconds = 0) {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export class JordanMusicService {
  constructor() {
    this.db = null;
    this.audio = new Audio();
    this.audio.preload = "metadata";
    this.userVolume = Number(localStorage.getItem("jordan.music.volume") || 0.82);
    this.ducked = false;
    this.audio.volume = this.userVolume;

    this.currentTrack = null;
    this.currentObjectUrl = "";
    this.libraryCache = [];
    this.queue = [];
    this.queueIndex = -1;
    this.shuffle = localStorage.getItem("jordan.music.shuffle") === "true";
    this.repeatMode = localStorage.getItem("jordan.music.repeat") || "off";

    this.callbacks = {
      onTrackChange: () => {},
      onStateChange: () => {},
      onTimeUpdate: () => {},
      onLibraryChange: () => {}
    };

    this.bindAudioEvents();
  }

  setCallbacks(callbacks = {}) {
    this.callbacks = { ...this.callbacks, ...callbacks };
    this.emitState();
  }

  bindAudioEvents() {
    this.audio.addEventListener("play", () => this.emitState());
    this.audio.addEventListener("pause", () => this.emitState());
    this.audio.addEventListener("loadedmetadata", () => this.emitTime());
    this.audio.addEventListener("durationchange", () => this.emitTime());
    this.audio.addEventListener("timeupdate", () => this.emitTime());
    this.audio.addEventListener("volumechange", () => this.emitState());
    this.audio.addEventListener("ended", () => this.handleEnded());
    this.audio.addEventListener("error", () => {
      this.emitState({ error: "Não consegui reproduzir este arquivo de áudio." });
    });
  }

  async initialize() {
    this.db = await openMusicDatabase();
    await this.refreshLibrary();
    return this.getState();
  }

  async store(mode = "readonly") {
    if (!this.db) this.db = await openMusicDatabase();
    return this.db.transaction(TRACK_STORE, mode).objectStore(TRACK_STORE);
  }

  async refreshLibrary() {
    const store = await this.store();
    const tracks = await requestToPromise(store.getAll());
    this.libraryCache = tracks.sort((a, b) => {
      const artist = String(a.artist).localeCompare(String(b.artist), "pt-BR");
      return artist || String(a.title).localeCompare(String(b.title), "pt-BR");
    });

    this.rebuildQueue();
    this.callbacks.onLibraryChange(this.libraryCache.map((track) => this.publicTrack(track)));
    return this.libraryCache;
  }

  rebuildQueue() {
    const ids = this.libraryCache.map((track) => track.id);

    if (this.shuffle) {
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
    }

    if (this.currentTrack?.id && ids.includes(this.currentTrack.id)) {
      const index = ids.indexOf(this.currentTrack.id);
      ids.splice(index, 1);
      const desired = Math.max(0, Math.min(this.queueIndex, ids.length));
      ids.splice(desired, 0, this.currentTrack.id);
    }

    this.queue = ids;
    if (this.currentTrack?.id) this.queueIndex = this.queue.indexOf(this.currentTrack.id);
    if (this.queueIndex < 0 && this.queue.length) this.queueIndex = 0;
  }

  publicTrack(track) {
    if (!track) return null;
    const { blob, ...safe } = track;
    return safe;
  }

  async importFiles(fileList) {
    const files = Array.from(fileList || []).filter(isAudioFile);
    if (!files.length) return { imported: 0, skipped: 0, tracks: [] };

    let imported = 0;
    let skipped = 0;
    const added = [];
    const knownIds = new Set(this.libraryCache.map((track) => track.id));

    for (const file of files) {
      const id = fingerprintFile(file);
      if (knownIds.has(id)) {
        skipped++;
        continue;
      }

      const parsed = parseFileName(file.name);
      const now = new Date().toISOString();
      const track = {
        id,
        title: parsed.title,
        titleNormalized: normalizeText(parsed.title),
        artist: parsed.artist,
        artistNormalized: normalizeText(parsed.artist),
        album: "",
        fileName: file.name,
        mime: file.type || "audio/mpeg",
        size: file.size,
        duration: 0,
        favorite: false,
        playCount: 0,
        addedAt: now,
        updatedAt: now,
        lastPlayedAt: null,
        blob: file
      };

      const store = await this.store("readwrite");
      await requestToPromise(store.put(track));
      knownIds.add(id);
      imported++;
      added.push(this.publicTrack(track));
    }

    await this.refreshLibrary();
    return { imported, skipped, tracks: added };
  }

  async allTracks() {
    if (!this.libraryCache.length && this.db) await this.refreshLibrary();
    return this.libraryCache.map((track) => this.publicTrack(track));
  }

  async getTrack(id) {
    const store = await this.store();
    return requestToPromise(store.get(id));
  }

  async removeTrack(id) {
    const store = await this.store("readwrite");
    await requestToPromise(store.delete(id));

    if (this.currentTrack?.id === id) {
      this.stop();
      this.currentTrack = null;
      this.callbacks.onTrackChange(null);
    }

    await this.refreshLibrary();
  }

  async clearLibrary() {
    this.stop();
    const store = await this.store("readwrite");
    await requestToPromise(store.clear());
    this.currentTrack = null;
    this.libraryCache = [];
    this.queue = [];
    this.queueIndex = -1;
    this.callbacks.onTrackChange(null);
    this.callbacks.onLibraryChange([]);
    this.emitState();
  }

  async search(query = "") {
    const text = normalizeText(query);
    if (!text) return this.allTracks();

    const tokens = text.split(/\s+/).filter(Boolean);
    const scored = this.libraryCache
      .map((track) => {
        const title = track.titleNormalized;
        const artist = track.artistNormalized;
        const haystack = `${title} ${artist}`;
        let score = 0;

        if (title === text) score += 140;
        if (artist === text) score += 110;
        if (title.includes(text)) score += 90;
        if (artist.includes(text)) score += 70;
        if (tokens.every((token) => haystack.includes(token))) score += 55;
        score += tokens.filter((token) => title.includes(token)).length * 12;
        score += tokens.filter((token) => artist.includes(token)).length * 8;

        return { track, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.map((entry) => this.publicTrack(entry.track));
  }

  randomTrack() {
    if (!this.libraryCache.length) return null;
    return this.publicTrack(this.libraryCache[Math.floor(Math.random() * this.libraryCache.length)]);
  }

  async playById(id) {
    const track = await this.getTrack(id);
    if (!track) return { ok: false, reason: "not-found" };
    return this.playTrack(track);
  }

  async playTrack(track) {
    if (!track?.blob) {
      const full = track?.id ? await this.getTrack(track.id) : null;
      if (!full) return { ok: false, reason: "not-found" };
      track = full;
    }

    this.releaseObjectUrl();
    this.currentTrack = track;
    this.queueIndex = this.queue.indexOf(track.id);
    if (this.queueIndex < 0) {
      this.queue.push(track.id);
      this.queueIndex = this.queue.length - 1;
    }

    this.currentObjectUrl = URL.createObjectURL(track.blob);
    this.audio.src = this.currentObjectUrl;
    this.audio.currentTime = 0;

    await this.markPlayed(track);
    this.callbacks.onTrackChange(this.publicTrack(track));
    this.emitState();

    try {
      await this.audio.play();
      return { ok: true, track: this.publicTrack(track), blocked: false };
    } catch (error) {
      const blocked = error?.name === "NotAllowedError";
      this.emitState({ blocked, error: blocked ? "Toque no botão Play para iniciar o áudio." : error?.message });
      return { ok: false, track: this.publicTrack(track), blocked, error };
    }
  }

  async markPlayed(track) {
    try {
      const updated = {
        ...track,
        playCount: Number(track.playCount || 0) + 1,
        lastPlayedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const store = await this.store("readwrite");
      await requestToPromise(store.put(updated));
      this.currentTrack = updated;
      const index = this.libraryCache.findIndex((item) => item.id === updated.id);
      if (index >= 0) this.libraryCache[index] = updated;
    } catch {
      // Reprodução não deve falhar só porque o histórico não pôde ser salvo.
    }
  }

  async toggleFavorite() {
    if (!this.currentTrack) return false;
    const updated = {
      ...this.currentTrack,
      favorite: !this.currentTrack.favorite,
      updatedAt: new Date().toISOString()
    };
    const store = await this.store("readwrite");
    await requestToPromise(store.put(updated));
    this.currentTrack = updated;
    const index = this.libraryCache.findIndex((item) => item.id === updated.id);
    if (index >= 0) this.libraryCache[index] = updated;
    this.callbacks.onTrackChange(this.publicTrack(updated));
    this.callbacks.onLibraryChange(this.libraryCache.map((track) => this.publicTrack(track)));
    return updated.favorite;
  }

  pause() {
    this.audio.pause();
  }

  async resume() {
    if (!this.audio.src && this.currentTrack) return this.playTrack(this.currentTrack);
    if (!this.audio.src) return { ok: false, reason: "nothing-loaded" };
    try {
      await this.audio.play();
      return { ok: true };
    } catch (error) {
      this.emitState({ blocked: error?.name === "NotAllowedError" });
      return { ok: false, blocked: error?.name === "NotAllowedError", error };
    }
  }

  async togglePlayPause() {
    if (!this.currentTrack && this.libraryCache.length) {
      return this.playById(this.queue[0] || this.libraryCache[0].id);
    }
    if (this.audio.paused) return this.resume();
    this.pause();
    return { ok: true, paused: true };
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.releaseObjectUrl();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.emitState();
  }

  async next() {
    if (!this.queue.length) return { ok: false, reason: "empty" };
    let nextIndex = this.queueIndex + 1;
    if (nextIndex >= this.queue.length) {
      if (this.repeatMode === "all") nextIndex = 0;
      else return { ok: false, reason: "end" };
    }

    return this.playById(this.queue[nextIndex]);
  }

  async previous() {
    if (this.audio.currentTime > 4) {
      this.audio.currentTime = 0;
      return { ok: true, restarted: true };
    }

    if (!this.queue.length) return { ok: false, reason: "empty" };
    let previousIndex = this.queueIndex - 1;
    if (previousIndex < 0) previousIndex = this.repeatMode === "all" ? this.queue.length - 1 : 0;
    return this.playById(this.queue[previousIndex]);
  }

  async handleEnded() {
    if (this.repeatMode === "one") {
      this.audio.currentTime = 0;
      await this.resume();
      return;
    }

    const result = await this.next();
    if (!result?.ok) {
      this.audio.currentTime = 0;
      this.emitState();
    }
  }

  toggleShuffle() {
    this.shuffle = !this.shuffle;
    localStorage.setItem("jordan.music.shuffle", String(this.shuffle));
    this.rebuildQueue();
    this.emitState();
    return this.shuffle;
  }

  cycleRepeat() {
    this.repeatMode = this.repeatMode === "off" ? "all" : this.repeatMode === "all" ? "one" : "off";
    localStorage.setItem("jordan.music.repeat", this.repeatMode);
    this.emitState();
    return this.repeatMode;
  }

  setVolume(value) {
    const normalized = Math.max(0, Math.min(1, Number(value)));
    this.userVolume = normalized;
    this.audio.volume = this.ducked ? normalized * 0.28 : normalized;
    localStorage.setItem("jordan.music.volume", String(normalized));
    this.emitState();
  }

  setDucked(active) {
    this.ducked = Boolean(active);
    this.audio.volume = this.ducked ? this.userVolume * 0.28 : this.userVolume;
    this.emitState();
  }

  seekPercent(percent) {
    if (!Number.isFinite(this.audio.duration) || this.audio.duration <= 0) return;
    const normalized = Math.max(0, Math.min(100, Number(percent)));
    this.audio.currentTime = this.audio.duration * (normalized / 100);
    this.emitTime();
  }

  releaseObjectUrl() {
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = "";
    }
  }

  emitTime() {
    const duration = Number.isFinite(this.audio.duration) ? this.audio.duration : 0;
    const current = Number.isFinite(this.audio.currentTime) ? this.audio.currentTime : 0;
    this.callbacks.onTimeUpdate({
      current,
      duration,
      currentLabel: formatSeconds(current),
      durationLabel: formatSeconds(duration),
      percent: duration > 0 ? (current / duration) * 100 : 0
    });
  }

  emitState(extra = {}) {
    this.callbacks.onStateChange({ ...this.getState(), ...extra });
  }

  getState() {
    return {
      playing: Boolean(this.currentTrack && !this.audio.paused),
      paused: this.audio.paused,
      volume: this.userVolume,
      ducked: this.ducked,
      shuffle: this.shuffle,
      repeatMode: this.repeatMode,
      currentTrack: this.publicTrack(this.currentTrack),
      queueLength: this.queue.length,
      queueIndex: this.queueIndex
    };
  }
}
