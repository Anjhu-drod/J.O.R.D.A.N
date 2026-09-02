export class MediaService {
  buildMusicSearch(query, provider = "youtubeMusic") {
    const clean = String(query || "").trim();
    if (!clean) return null;

    if (provider === "spotify") {
      return `https://open.spotify.com/search/${encodeURIComponent(clean)}`;
    }

    return `https://music.youtube.com/search?q=${encodeURIComponent(clean)}`;
  }

  extractMusicQuery(input = "") {
    return String(input)
      .replace(/^\s*jordan\s*[,;:-]?\s*/i, "")
      .replace(/\b(toque|toca|tocar|coloque|coloca|play|reproduza|reproduzir|ponha|põe|poe)\b/gi, " ")
      .replace(/\b(musica|música|song|cancion|canción|playlist)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}
