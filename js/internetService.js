import { detectLanguage } from "./languageService.js";

const WIKI_LANG = {
  pt: "pt",
  en: "en",
  es: "es",
  ja: "ja"
};

function compactExtract(text = "", maxLength = 850) {
  const clean = String(text)
    .replace(/\s+/g, " ")
    .replace(/\[[^\]]+\]/g, "")
    .trim();

  if (clean.length <= maxLength) return clean;
  const clipped = clean.slice(0, maxLength);
  const lastSentence = Math.max(clipped.lastIndexOf(". "), clipped.lastIndexOf("。"));
  return `${(lastSentence > 250 ? clipped.slice(0, lastSentence + 1) : clipped).trim()}…`;
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
    return typeof navigator === "undefined" ? false : navigator.onLine;
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
      srlimit: "3",
      format: "json",
      utf8: "1",
      origin: "*"
    }).toString();

    const searchResponse = await fetch(searchUrl, { headers: { Accept: "application/json" } });
    if (!searchResponse.ok) throw new Error(`wiki-search-${searchResponse.status}`);
    const searchData = await searchResponse.json();
    const hit = searchData?.query?.search?.[0];
    if (!hit?.title) return null;

    const extractUrl = new URL(base);
    extractUrl.search = new URLSearchParams({
      action: "query",
      prop: "extracts|info",
      inprop: "url",
      exintro: "1",
      explaintext: "1",
      redirects: "1",
      titles: hit.title,
      format: "json",
      origin: "*"
    }).toString();

    const extractResponse = await fetch(extractUrl, { headers: { Accept: "application/json" } });
    if (!extractResponse.ok) throw new Error(`wiki-extract-${extractResponse.status}`);
    const extractData = await extractResponse.json();
    const pages = Object.values(extractData?.query?.pages ?? {});
    const page = pages.find((item) => item?.extract) ?? pages[0];
    if (!page?.extract) return null;

    const result = {
      source: "Wikipedia",
      title: page.title ?? hit.title,
      text: compactExtract(page.extract),
      url: page.fullurl ?? `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, "_"))}`,
      language: wikiLang
    };

    this.lastSource = result;
    return result;
  }

  async answer(query, preferredLanguage = null) {
    const detected = preferredLanguage ?? detectLanguage(query);
    const attempts = [...new Set([detected, "pt", "en"])];

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
