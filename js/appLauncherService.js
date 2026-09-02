const TARGETS = {
  youtube: { label: "YouTube", url: "https://www.youtube.com/" },
  x: { label: "X", url: "https://x.com/" },
  instagram: { label: "Instagram", url: "https://www.instagram.com/" },
  spotify: { label: "Spotify", url: "https://open.spotify.com/" },
  whatsapp: { label: "WhatsApp", url: "https://wa.me/" },
  tiktok: { label: "TikTok", url: "https://www.tiktok.com/" },
  discord: { label: "Discord", url: "https://discord.com/app" },
  reddit: { label: "Reddit", url: "https://www.reddit.com/" },
  github: { label: "GitHub", url: "https://github.com/" },
  maps: { label: "Google Maps", url: "https://www.google.com/maps" },
  gmail: { label: "Gmail", url: "https://mail.google.com/" }
};

export class AppLauncherService {
  getTarget(id) {
    return TARGETS[id] ? { id, ...TARGETS[id] } : null;
  }

  listTargets() {
    return Object.entries(TARGETS).map(([id, value]) => ({ id, ...value }));
  }
}
