import { JordanMusicService } from "./jordanMusicService.js";

export class MediaService {
  constructor() {
    this.music = new JordanMusicService();
  }

  async initialize() {
    return this.music.initialize();
  }

  setCallbacks(callbacks = {}) {
    this.music.setCallbacks(callbacks);
  }

  async importFiles(files) {
    return this.music.importFiles(files);
  }

  async getLibrary() {
    return this.music.allTracks();
  }

  async searchLibrary(query = "") {
    return this.music.search(query);
  }

  async clearLibrary() {
    return this.music.clearLibrary();
  }

  async removeTrack(id) {
    return this.music.removeTrack(id);
  }

  async playTrack(id) {
    return this.music.playById(id);
  }

  async togglePlayPause() {
    return this.music.togglePlayPause();
  }

  pause() {
    this.music.pause();
  }

  resume() {
    return this.music.resume();
  }

  next() {
    return this.music.next();
  }

  previous() {
    return this.music.previous();
  }

  toggleShuffle() {
    return this.music.toggleShuffle();
  }

  cycleRepeat() {
    return this.music.cycleRepeat();
  }

  setVolume(value) {
    this.music.setVolume(value);
  }

  setDucked(active) {
    this.music.setDucked(active);
  }

  seekPercent(percent) {
    this.music.seekPercent(percent);
  }

  toggleFavorite() {
    return this.music.toggleFavorite();
  }

  getState() {
    return this.music.getState();
  }

  extractMusicQuery(input = "") {
    return String(input)
      .replace(/^\s*jordan\s*[,;:!\-]?\s*/i, "")
      .replace(/\b(toque|toca|tocar|coloque|coloca|reproduza|reproduzir|ponha|poe|põe|bote)\b/gi, " ")
      .replace(/\b(uma|a|alguma)?\s*(musica|música|playlist|faixa|track)\b/gi, " ")
      .replace(/^\s*(?:do|da|de)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  async findPlayableTrack(query, { random = false } = {}) {
    const library = await this.getLibrary();
    if (!library.length) return { status: "library-empty", query: String(query || "").trim() };

    if (random || !String(query || "").trim()) {
      const track = this.music.randomTrack();
      return { status: "ready", query: "aleatória", track };
    }

    const matches = await this.searchLibrary(String(query).trim());
    if (!matches.length) {
      return { status: "not-found", query: String(query).trim() };
    }

    return { status: "ready", query: String(query).trim(), track: matches[0], tracks: matches };
  }
}
