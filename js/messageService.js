import {
  addDoc,
  collection,
  getDocs,
  limit,
  query,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { auth, firestore } from "./firebaseService.js";
import { getLineageMember, listLineageMembers } from "./lineageConfig.js";
import { getSetting, setSetting } from "./db.js";
import { normalizeText } from "./utils.js";

const MESSAGES_COLLECTION = "lineageMessages";
const MAX_TEXT_LENGTH = 2000;
const FETCH_LIMIT = 120;

function createdMs(message = {}) {
  if (Number.isFinite(Number(message.createdAtMs))) return Number(message.createdAtMs);
  const ts = message.createdAt;
  if (ts?.toMillis) return ts.toMillis();
  if (ts?.seconds) return Number(ts.seconds) * 1000;
  const parsed = Date.parse(ts || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanText(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH);
}

export class MessageService {
  constructor(lineageService) {
    this.lineage = lineageService;
  }

  get identity() {
    return this.lineage?.currentIdentity || null;
  }

  resolveRecipient(raw = "") {
    const text = normalizeText(raw)
      .replace(/\b(?:para|pro|pra|ao|a|o|a pessoa|meu|minha)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (/\b(?:todos|todo mundo|familia|família|linhagem|geral)\b/.test(text)) {
      return { id: "all", firstName: "Todos" };
    }

    for (const member of listLineageMembers()) {
      const aliases = [member.id, member.firstName, member.confirmationName]
        .filter(Boolean)
        .map(normalizeText);
      if (aliases.some((alias) => text === alias || text.includes(alias))) return member;
    }
    return null;
  }

  async send(recipient, text) {
    const user = auth.currentUser;
    const sender = this.identity;
    if (!user || !sender) throw new Error("Sua JORDAN ID ainda não está pronta para enviar mensagens.");

    const target = typeof recipient === "string" ? this.resolveRecipient(recipient) : recipient;
    if (!target?.id) throw new Error("Não reconheci para quem devo mandar a mensagem.");
    if (target.id === sender.id) throw new Error("Essa mensagem seria para você mesmo.");

    const body = cleanText(text);
    if (!body) throw new Error("A mensagem ficou vazia.");

    const now = Date.now();
    const docRef = await addDoc(collection(firestore, MESSAGES_COLLECTION), {
      senderUid: user.uid,
      senderIdentityId: sender.id,
      senderName: sender.firstName,
      recipientId: target.id,
      recipientName: target.id === "all" ? "Todos" : (target.firstName || target.id),
      text: body,
      createdAt: serverTimestamp(),
      createdAtMs: now,
      schemaVersion: 1
    });

    return {
      id: docRef.id,
      senderUid: user.uid,
      senderIdentityId: sender.id,
      senderName: sender.firstName,
      recipientId: target.id,
      recipientName: target.id === "all" ? "Todos" : (target.firstName || target.id),
      text: body,
      createdAtMs: now
    };
  }

  async _query(field, value) {
    const snap = await getDocs(query(
      collection(firestore, MESSAGES_COLLECTION),
      where(field, "==", value),
      limit(FETCH_LIMIT)
    ));
    return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
  }

  async inbox({ includeSent = false } = {}) {
    const user = auth.currentUser;
    const identity = this.identity;
    if (!user || !identity) return [];

    const jobs = [this._query("recipientId", identity.id), this._query("recipientId", "all")];
    if (includeSent) jobs.push(this._query("senderUid", user.uid));

    const result = await Promise.allSettled(jobs);
    const map = new Map();
    for (const item of result) {
      if (item.status !== "fulfilled") continue;
      for (const message of item.value) map.set(message.id, message);
    }

    return [...map.values()]
      .sort((a, b) => createdMs(b) - createdMs(a))
      .slice(0, FETCH_LIMIT);
  }

  async unread() {
    const lastSeen = Number(await getSetting("messages.lastSeenAt", 0)) || 0;
    const identity = this.identity;
    const messages = await this.inbox({ includeSent: false });
    return messages.filter((message) =>
      message.senderIdentityId !== identity?.id && createdMs(message) > lastSeen
    );
  }

  async unreadCount() {
    return (await this.unread()).length;
  }

  async markSeen() {
    await setSetting("messages.lastSeenAt", Date.now());
  }

  async summary({ max = 3, markSeen = false } = {}) {
    const unread = await this.unread();
    if (markSeen && unread.length) await this.markSeen();
    if (!unread.length) return { count: 0, text: "Você não tem mensagens novas.", messages: [] };

    const shown = unread.slice(0, max);
    const parts = shown.map((message) => `${message.senderName || "Alguém"}: ${message.text}`);
    const rest = unread.length - shown.length;
    return {
      count: unread.length,
      messages: unread,
      text: `${unread.length === 1 ? "Você tem 1 mensagem nova" : `Você tem ${unread.length} mensagens novas`}: ${parts.join("; ")}${rest > 0 ? `; e mais ${rest}` : ""}.`
    };
  }

  recipientOptions() {
    const current = this.identity?.id;
    return [
      { id: "all", firstName: "Todos" },
      ...listLineageMembers().filter((member) => member.id !== current)
    ];
  }

  displayName(id = "") {
    if (id === "all") return "Todos";
    return getLineageMember(id)?.firstName || id;
  }
}

export const messageCreatedMs = createdMs;
