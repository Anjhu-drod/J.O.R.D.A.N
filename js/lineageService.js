import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { auth, firestore } from "./firebaseService.js";
import {
  FAMILY_GATE,
  LINEAGE_MEMBERS,
  LINEAGE_RELATIONSHIPS,
  getLineageMember,
  listLineageMembers
} from "./lineageConfig.js";
import { normalizeText } from "./utils.js";

const FAMILY_GATE_STORAGE = "jordan.family-gate-v1";

async function sha256(text) {
  const data = new TextEncoder().encode(String(text || ""));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeName(value = "") {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

export class LineageService {
  constructor() {
    this.identity = null;
    this.binding = null;
  }

  get currentIdentity() {
    return this.identity;
  }

  get isCreator() {
    return this.identity?.id === "jhuan";
  }

  familyGatePassed() {
    return localStorage.getItem(FAMILY_GATE_STORAGE) === "ok";
  }

  clearFamilyGate() {
    localStorage.removeItem(FAMILY_GATE_STORAGE);
  }

  async verifyFamilyPin(pin) {
    const hash = await sha256(String(pin || "").trim());
    const ok = hash === FAMILY_GATE.pinHashSha256;
    if (ok) localStorage.setItem(FAMILY_GATE_STORAGE, "ok");
    return ok;
  }

  validateConfirmation(identityId, confirmationName) {
    const member = getLineageMember(identityId);
    if (!member) return false;
    return normalizeName(confirmationName) === normalizeName(member.confirmationName);
  }

  async loadCurrentIdentity() {
    const user = auth.currentUser;
    if (!user) {
      this.identity = null;
      this.binding = null;
      return null;
    }

    try {
      const profileRef = doc(firestore, "users", user.uid, "profile", "main");
      let profileSnap = null;
      try { profileSnap = await getDocFromCache(profileRef); } catch {}
      if (!profileSnap?.exists?.() && navigator.onLine) {
        try { profileSnap = await getDoc(profileRef); } catch {}
      }
      const lineageId = profileSnap?.exists?.() ? profileSnap.data()?.lineageId : null;
      if (lineageId && LINEAGE_MEMBERS[lineageId]) {
        this.identity = getLineageMember(lineageId);
        this.binding = { identityId: lineageId, ownerUid: user.uid };
        return this.identity;
      }
    } catch (error) {
      console.warn("JORDAN Lineage: perfil ainda indisponível.", error);
    }


    return null;
  }

  async claimIdentity(identityId, confirmationName) {
    const user = auth.currentUser;
    if (!user) throw new Error("Entre na sua conta antes de escolher sua identidade.");

    const member = getLineageMember(identityId);
    if (!member) throw new Error("Identidade não reconhecida.");
    if (!this.validateConfirmation(identityId, confirmationName)) {
      throw new Error("O segundo nome de confirmação não corresponde a essa identidade.");
    }

    const bindingRef = doc(firestore, "lineageBindings", member.id);
    const profileRef = doc(firestore, "users", user.uid, "profile", "main");

    // A identidade Jhuan ancora a linhagem. Isso evita que outras identidades
    // sejam reivindicadas antes da conta administrativa do creator existir.
    if (member.id !== "jhuan") {
      const creatorRef = doc(firestore, "lineageBindings", "jhuan");
      let creatorSnap = null;
      try { creatorSnap = await getDocFromCache(creatorRef); } catch {}
      if (!creatorSnap?.exists?.() && navigator.onLine) {
        try { creatorSnap = await getDoc(creatorRef); } catch {}
      }
      if (!creatorSnap?.exists?.()) {
        throw new Error("A identidade do creator Jhuan precisa ser vinculada primeiro. Depois os demais membros podem fazer o cadastro.");
      }
    }

    // Um mesmo Firebase UID não deve reivindicar duas identidades diferentes.
    let currentProfile = null;
    try { currentProfile = await getDocFromCache(profileRef); } catch {}
    if (!currentProfile?.exists?.() && navigator.onLine) {
      try { currentProfile = await getDoc(profileRef); } catch {}
    }
    const existingLineageId = currentProfile?.exists?.() ? currentProfile.data()?.lineageId : null;
    if (existingLineageId && existingLineageId !== member.id) {
      const existingMember = getLineageMember(existingLineageId);
      throw new Error(`Esta conta já está vinculada à identidade ${existingMember?.firstName || existingLineageId}.`);
    }

    await runTransaction(firestore, async (transaction) => {
      const existing = await transaction.get(bindingRef);
      if (existing.exists() && existing.data()?.ownerUid !== user.uid) {
        throw new Error(`${member.firstName} já está vinculado a outra conta.`);
      }

      transaction.set(bindingRef, {
        identityId: member.id,
        ownerUid: user.uid,
        firstName: member.firstName,
        role: member.role,
        claimedAt: existing.exists() ? existing.data()?.claimedAt || serverTimestamp() : serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      transaction.set(profileRef, {
        lineageId: member.id,
        lineageRole: member.role,
        firstName: member.firstName,
        displayName: user.displayName || member.firstName,
        updatedAt: serverTimestamp()
      }, { merge: true });
    });

    this.identity = member;
    this.binding = { identityId: member.id, ownerUid: user.uid, role: member.role };
    return member;
  }

  async listBindings() {
    if (!this.isCreator) return [];
    const snap = await getDocs(collection(firestore, "lineageBindings"));
    return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
  }

  relationIds(kind, identityId = this.identity?.id) {
    return LINEAGE_RELATIONSHIPS[identityId]?.[kind] || [];
  }

  relationMembers(kind, identityId = this.identity?.id) {
    return this.relationIds(kind, identityId).map(getLineageMember).filter(Boolean);
  }

  resolveUniqueRelation(kind, identityId = this.identity?.id) {
    const list = this.relationMembers(kind, identityId);
    return list.length === 1 ? list[0] : null;
  }

  relationAnswer(kind, identityId = this.identity?.id) {
    const members = this.relationMembers(kind, identityId);
    if (!members.length) return null;
    if (members.length === 1) return members[0].firstName;
    return members.map((item) => item.firstName).join(" e ");
  }

  expandRelationReferences(input = "") {
    let value = String(input || "");
    const substitutions = [
      { regex: /\b(minha mae|minha mãe)\b/gi, kind: "mother" },
      { regex: /\b(meu pai)\b/gi, kind: "father" }
    ];

    for (const item of substitutions) {
      const member = this.resolveUniqueRelation(item.kind);
      if (member) value = value.replace(item.regex, member.firstName);
    }
    return value;
  }

  getMemberBySpokenName(name = "") {
    const normalized = normalizeName(name);
    return listLineageMembers().find((member) =>
      normalizeName(member.firstName) === normalized ||
      normalizeName(member.confirmationName) === normalized
    ) || null;
  }
}

export const lineageService = new LineageService();
