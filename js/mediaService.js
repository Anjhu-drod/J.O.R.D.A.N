export class MediaService {
  constructor() {
    this.defaultProvider = "youtubeMusic";
  }

  setDefaultProvider(provider = "youtubeMusic") {
    this.defaultProvider = ["youtubeMusic", "spotify", "youtube"].includes(provider)
      ? provider
      : "youtubeMusic";
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
      .replace(/^\s*(?:hi|hello|hey|hola|oi|ola)?\s*jordan\s*[,;:!\-]?\s*/i, "")
      .replace(/\b(toque|toca|tocar|coloque|coloca|reproduza|reproduzir|ponha|poe|põe|play|start|reproduce|reproduce|pon)\b/gi, " ")
      .replace(/\b(musica|música|song|music|cancion|canción|playlist|track|faixa)\b/gi, " ")
      .replace(/\b(no|na|in|on|en)\s+(spotify|youtube music|youtube)\b/gi, " ")
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
}
