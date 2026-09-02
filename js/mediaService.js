import { SpotifyService } from "./spotifyService.js";

const RANDOM_QUERIES = [
  "anime openings", "rock brasileiro", "lofi hip hop", "rap geek", "trilha sonora anime",
  "indie brasileiro", "rock alternativo", "instrumental cinematic", "japanese city pop"
];

export class MediaService {
  constructor() {
    this.defaultProvider = "spotify";
    this.spotify = new SpotifyService();
  }

  setDefaultProvider(provider = "spotify") {
    this.defaultProvider = ["spotify", "youtubeMusic", "youtube"].includes(provider)
      ? provider
      : "spotify";
  }

  configureSpotify(options = {}) {
    this.spotify.configure(options);
  }

  async handleSpotifyCallback() {
    return this.spotify.handleCallback();
  }

  get spotifyConfigured() {
    return this.spotify.configured;
  }

  get spotifyConnected() {
    return this.spotify.connected;
  }

  async connectSpotify() {
    return this.spotify.beginLogin();
  }

  disconnectSpotify() {
    this.spotify.disconnect();
  }

  randomQuery() {
    return RANDOM_QUERIES[Math.floor(Math.random() * RANDOM_QUERIES.length)];
  }

  buildMusicSearch(query, provider = this.defaultProvider) {
    const clean = String(query || "").trim();
    if (!clean) return null;

    if (provider === "spotify") {
      return `https://open.spotify.com/search/${encodeURIComponent(clean)}`;
    }

    if (provider === "youtube") {
      return `https://www.youtube.com/results?search_query=${encodeURIComponent(clean)}`;
    }

    return `https://music.youtube.com/search?q=${encodeURIComponent(clean)}`;
  }

  extractMusicQuery(input = "") {
    return String(input)
      .replace(/^\s*jordan\s*[,;:!\-]?\s*/i, "")
      .replace(/\b(toque|toca|tocar|coloque|coloca|reproduza|reproduzir|ponha|poe|põe|bote)\b/gi, " ")
      .replace(/\b(uma|a)?\s*(musica|música|playlist|faixa|track)\b/gi, " ")
      .replace(/\b(no|na)\s+(spotify|youtube music|youtube)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  providerFromText(input = "") {
    const text = String(input).toLowerCase();
    if (text.includes("spotify")) return "spotify";
    if (text.includes("youtube music")) return "youtubeMusic";
    if (text.includes("youtube")) return "youtube";
    return this.defaultProvider;
  }

  async findPlayableTrack(query, { random = false } = {}) {
    const actualQuery = random || !String(query || "").trim() ? this.randomQuery() : String(query).trim();

    if (this.defaultProvider !== "spotify") {
      return {
        status: "external",
        query: actualQuery,
        provider: this.defaultProvider,
        url: this.buildMusicSearch(actualQuery, this.defaultProvider)
      };
    }

    if (!this.spotifyConfigured) {
      return { status: "needs-config", query: actualQuery };
    }

    if (!this.spotifyConnected) {
      return { status: "needs-login", query: actualQuery };
    }

    const tracks = await this.spotify.searchTrack(actualQuery, 5);
    if (!tracks.length) return { status: "not-found", query: actualQuery };

    const track = random
      ? tracks[Math.floor(Math.random() * tracks.length)]
      : tracks[0];

    return { status: "ready", query: actualQuery, track, tracks };
  }
}
