import { detectLanguage } from "./languageService.js";

const WIKI_LANG = { pt: "pt", en: "en", es: "es", ja: "ja" };

function compactExtract(text = "", maxLength = 950) {
  const clean = String(text).replace(/\s+/g, " ").replace(/\[[^\]]+\]/g, "").trim();
  if (clean.length <= maxLength) return clean;
  const clipped = clean.slice(0, maxLength);
  const lastSentence = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("。"));
  return `${(lastSentence > 250 ? clipped.slice(0, lastSentence + 1) : clipped).trim()}…`;
}

async function fetchJson(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`http-${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export class InternetService {
  constructor() {
    this.enabled = true;
    this.lastSource = null;
  }

  setEnabled(value) {
    this.enabled = Boolean(value);
  }

  get online() {
    return typeof navigator !== "undefined" ? navigator.onLine : false;
  }

  async testConnection() {
    if (!this.enabled) return { ok: false, reason: "disabled" };
    if (!this.online) return { ok: false, reason: "offline" };
    try {
      const url = new URL("https://pt.wikipedia.org/w/api.php");
      url.search = new URLSearchParams({ action: "query", meta: "siteinfo", format: "json", origin: "*" }).toString();
      await fetchJson(url, 6000);
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error.message };
    }
  }

  async searchWikipedia(query, language = "pt") {
    if (!this.enabled) throw new Error("internet-disabled");
    if (!this.online) throw new Error("offline");

    const wikiLang = WIKI_LANG[language] ?? "pt";
    const base = `https://${wikiLang}.wikipedia.org/w/api.php`;
    const searchUrl = new URL(base);
    searchUrl.search = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: query,
      srlimit: "4",
      format: "json",
      utf8: "1",
      origin: "*"
    }).toString();

    const searchData = await fetchJson(searchUrl);
    const hit = searchData?.query?.search?.[0];
    if (!hit?.title) return null;
    return this.fetchWikipediaPage(hit.title, wikiLang);
  }

  async fetchWikipediaPage(title, language = "pt") {
    const wikiLang = WIKI_LANG[language] ?? "pt";
    const base = `https://${wikiLang}.wikipedia.org/w/api.php`;
    const extractUrl = new URL(base);
    extractUrl.search = new URLSearchParams({
      action: "query",
      prop: "extracts|info",
      inprop: "url",
      exintro: "1",
      explaintext: "1",
      redirects: "1",
      titles: title,
      format: "json",
      origin: "*"
    }).toString();

    const extractData = await fetchJson(extractUrl);
    const pages = Object.values(extractData?.query?.pages ?? {});
    const page = pages.find((item) => item?.extract) ?? pages[0];
    if (!page?.extract) return null;

    const result = {
      source: "Wikipedia",
      title: page.title ?? title,
      text: compactExtract(page.extract),
      url: page.fullurl ?? `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      language: wikiLang
    };
    this.lastSource = result;
    return result;
  }

  async research(query, language = "pt", limit = 3) {
    if (!this.enabled) throw new Error("internet-disabled");
    if (!this.online) throw new Error("offline");

    const wikiLang = WIKI_LANG[language] ?? "pt";
    const base = `https://${wikiLang}.wikipedia.org/w/api.php`;
    const searchUrl = new URL(base);
    searchUrl.search = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: query,
      srlimit: String(Math.max(1, Math.min(5, limit))),
      format: "json",
      utf8: "1",
      origin: "*"
    }).toString();

    const searchData = await fetchJson(searchUrl);
    const hits = searchData?.query?.search ?? [];
    const pages = (await Promise.all(hits.slice(0, limit).map((hit) => this.fetchWikipediaPage(hit.title, wikiLang).catch(() => null))))
      .filter(Boolean);

    const searchUrlExternal = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    return {
      query,
      language: wikiLang,
      sources: pages,
      searchUrl: searchUrlExternal,
      summary: pages[0]?.text ?? ""
    };
  }

  async answer(query, preferredLanguage = null) {
    const detected = preferredLanguage ?? detectLanguage(query);
    const attempts = [...new Set([detected, "pt", "en"])]
      .filter((lang) => WIKI_LANG[lang]);

    for (const language of attempts) {
      try {
        const result = await this.searchWikipedia(query, language);
        if (result) return result;
      } catch (error) {
        if (error.message === "internet-disabled" || error.message === "offline") throw error;
      }
    }

    return null;
  }
}
