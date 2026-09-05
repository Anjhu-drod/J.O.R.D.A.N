const TARGETS = {
  youtube: {
    label: "YouTube",
    url: "https://www.youtube.com/",
    deepLinks: { android: "vnd.youtube://www.youtube.com/", ios: "youtube://" }
  },
  x: { label: "X", url: "https://x.com/", deepLinks: { android: "twitter://", ios: "twitter://" } },
  instagram: { label: "Instagram", url: "https://www.instagram.com/", deepLinks: { android: "instagram://app", ios: "instagram://app" } },
  spotify: { label: "Spotify", url: "https://open.spotify.com/", deepLinks: { android: "spotify:", ios: "spotify:" } },
  whatsapp: { label: "WhatsApp", url: "https://wa.me/", deepLinks: { android: "whatsapp://send", ios: "whatsapp://send" } },
  tiktok: { label: "TikTok", url: "https://www.tiktok.com/", deepLinks: { android: "snssdk1233://", ios: "snssdk1233://" } },
  discord: { label: "Discord", url: "https://discord.com/app", deepLinks: { android: "discord://", ios: "discord://" } },
  reddit: { label: "Reddit", url: "https://www.reddit.com/", deepLinks: { android: "reddit://", ios: "reddit://" } },
  github: { label: "GitHub", url: "https://github.com/", deepLinks: { android: "github://", ios: "github://" } },
  maps: { label: "Google Maps", url: "https://www.google.com/maps", deepLinks: { android: "geo:0,0?q=", ios: "comgooglemaps://" } },
  gmail: { label: "Gmail", url: "https://mail.google.com/", deepLinks: { android: "googlegmail://", ios: "googlegmail://" } },
  google: { label: "Google", url: "https://www.google.com/" }
};

export class AppLauncherService {
  getTarget(id) {
    return TARGETS[id] ? { id, ...TARGETS[id] } : null;
  }

  listTargets() {
    return Object.entries(TARGETS).map(([id, value]) => ({ id, ...value }));
  }
}
