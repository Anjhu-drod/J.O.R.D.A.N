function base64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function randomVerifier(length = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (x) => chars[x % chars.length]).join("");
}

async function sha256(value) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

export class SpotifyService {
  constructor() {
    this.clientId = "";
    this.redirectUri = "";
    this.accessToken = localStorage.getItem("jordan.spotify.accessToken") || "";
    this.refreshToken = localStorage.getItem("jordan.spotify.refreshToken") || "";
    this.expiresAt = Number(localStorage.getItem("jordan.spotify.expiresAt") || 0);
  }

  configure({ clientId = "", redirectUri = "" } = {}) {
    this.clientId = String(clientId || "").trim();
    this.redirectUri = redirectUri || `${location.origin}${location.pathname}`;
  }

  get configured() {
    return Boolean(this.clientId);
  }

  get connected() {
    return Boolean(this.accessToken || this.refreshToken);
  }

  async beginLogin() {
    if (!this.clientId) throw new Error("spotify-client-id-missing");
    const verifier = randomVerifier();
    const challenge = base64Url(await sha256(verifier));
    localStorage.setItem("jordan.spotify.verifier", verifier);
    localStorage.setItem("jordan.spotify.returnUrl", location.href.split("?")[0].split("#")[0]);

    const auth = new URL("https://accounts.spotify.com/authorize");
    auth.search = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      code_challenge_method: "S256",
      code_challenge: challenge,
      scope: "user-read-private"
    }).toString();
    location.href = auth.toString();
  }

  async handleCallback() {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (!code || !this.clientId) return false;

    const verifier = localStorage.getItem("jordan.spotify.verifier");
    if (!verifier) return false;

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        grant_type: "authorization_code",
        code,
        redirect_uri: this.redirectUri,
        code_verifier: verifier
      })
    });
    if (!response.ok) throw new Error(`spotify-token-${response.status}`);
    const data = await response.json();
    this.storeToken(data);
    history.replaceState({}, document.title, location.pathname + location.hash);
    return true;
  }

  storeToken(data) {
    if (data.access_token) {
      this.accessToken = data.access_token;
      localStorage.setItem("jordan.spotify.accessToken", data.access_token);
    }
    if (data.refresh_token) {
      this.refreshToken = data.refresh_token;
      localStorage.setItem("jordan.spotify.refreshToken", data.refresh_token);
    }
    if (data.expires_in) {
      this.expiresAt = Date.now() + Number(data.expires_in) * 1000 - 30000;
      localStorage.setItem("jordan.spotify.expiresAt", String(this.expiresAt));
    }
  }

  async refresh() {
    if (!this.refreshToken || !this.clientId) throw new Error("spotify-not-connected");
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
        client_id: this.clientId
      })
    });
    if (!response.ok) throw new Error(`spotify-refresh-${response.status}`);
    const data = await response.json();
    this.storeToken(data);
  }

  async token() {
    if (this.accessToken && Date.now() < this.expiresAt) return this.accessToken;
    if (this.refreshToken) {
      await this.refresh();
      return this.accessToken;
    }
    return "";
  }

  async searchTrack(query, limit = 5) {
    const token = await this.token();
    if (!token) throw new Error("spotify-not-connected");
    const url = new URL("https://api.spotify.com/v1/search");
    url.search = new URLSearchParams({ q: query, type: "track", limit: String(limit), market: "BR" }).toString();
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (response.status === 401) {
      this.accessToken = "";
      if (this.refreshToken) return this.searchTrack(query, limit);
    }
    if (!response.ok) throw new Error(`spotify-search-${response.status}`);
    const data = await response.json();
    return (data?.tracks?.items ?? []).map((track) => ({
      id: track.id,
      name: track.name,
      artist: (track.artists ?? []).map((a) => a.name).join(", "),
      album: track.album?.name ?? "",
      image: track.album?.images?.[0]?.url ?? "",
      url: track.external_urls?.spotify ?? `https://open.spotify.com/track/${track.id}`,
      embedUrl: `https://open.spotify.com/embed/track/${track.id}?utm_source=generator&theme=0`
    }));
  }

  disconnect() {
    this.accessToken = "";
    this.refreshToken = "";
    this.expiresAt = 0;
    ["accessToken", "refreshToken", "expiresAt", "verifier"].forEach((key) => localStorage.removeItem(`jordan.spotify.${key}`));
  }
}
