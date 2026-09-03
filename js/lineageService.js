import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  getDocs,
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
const SERVER_TIMEOUT_MS = 7000;
const WRITE_TIMEOUT_MS = 9000;

async function sha256(text) {
  const data = new TextEncoder().encode(String(text || ""));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeName(value = "") {
  return normalizeText(value).replace(/[^a-z0-9]/g, "");
}

function timeoutError(message) {
  const error = new Error(message);
  error.code = "jordan/timeout";
  return error;
}


function friendlyCloudError(error, fallback = "Não consegui concluir o vínculo agora.") {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "");
  if (code.includes("permission-denied")) {
    return new Error("O Firestore recusou o vínculo. Confira se o arquivo firestore.rules da V0.8 está publicado no banco (default).");
  }
  if (code.includes("not-found") || /database.*does not exist/i.test(message)) {
    return new Error("O banco Cloud Firestore (default) ainda não está disponível neste projeto.");
  }
  if (code.includes("unavailable") || code.includes("network") || /offline|failed to fetch/i.test(message)) {
    return new Error("Perdi a conexão com o Firestore durante a confirmação. Nada foi apagado; tente novamente quando a conexão estabilizar.");
  }
  return new Error(message || fallback);
}

function withTimeout(promise, ms, message) {
  let timer = null;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(timeoutError(message)), ms);
    })
  ]);
}

async function readServer(ref, label = "Firestore") {
  if (!navigator.onLine) {
    throw new Error(`${label} precisa de internet para confirmar este vínculo.`);
  }
  return withTimeout(
    getDocFromServer(ref),
    SERVER_TIMEOUT_MS,
    `${label} demorou para responder. Verifique sua internet e tente novamente.`
  );
}

async function writeServer(ref, data, options, { label, verify } = {}) {
  const pending = setDoc(ref, data, options);
  try {
    await withTimeout(
      pending,
      WRITE_TIMEOUT_MS,
      `${label || "O Firestore"} ainda não confirmou a gravação.`
    );
    return true;
  } catch (error) {
    // A escrita pode ter sido aceita exatamente quando o timeout aconteceu.
    // Antes de informar falha, verificamos o servidor uma vez.
    if (error?.code === "jordan/timeout" && navigator.onLine && typeof verify === "function") {
      try {
        const snap = await readServer(ref, label || "Firestore");
        if (verify(snap)) return true;
      } catch {}
    }
    throw error;
  }
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

  async findOwnedBinding(user = auth.currentUser, { server = false } = {}) {
    if (!user) return null;

    for (const member of listLineageMembers()) {
      const ref = doc(firestore, "lineageBindings", member.id);
      let snap = null;
      try {
        snap = server ? await readServer(ref, "Identidade JORDAN") : await getDocFromCache(ref);
      } catch {
        if (!server && navigator.onLine) {
          try { snap = await readServer(ref, "Identidade JORDAN"); } catch {}
        }
      }

      if (snap?.exists?.() && snap.data()?.ownerUid === user.uid) {
        return { member, binding: { id: member.id, ...snap.data() } };
      }
    }

    return null;
  }

  async repairProfileFromBinding(user, member) {
    if (!user || !member) return;
    const profileRef = doc(firestore, "users", user.uid, "profile", "main");
    const payload = {
      lineageId: member.id,
      lineageRole: member.role,
      firstName: member.firstName,
      displayName: user.displayName || member.firstName,
      updatedAt: serverTimestamp()
    };

    // Reparação é complementar. Nunca deve bloquear a entrada da JORDAN.
    Promise.resolve(setDoc(profileRef, payload, { merge: true })).catch((error) => {
      console.warn("JORDAN Lineage: perfil aguardando reparação/sincronização.", error);
    });
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
        try { profileSnap = await readServer(profileRef, "Perfil JORDAN"); } catch {}
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

    // Recuperação importante: se o binding foi salvo e a aba fechou antes do
    // perfil terminar, a identidade continua sendo encontrada sem travar o usuário.
    const recovered = await this.findOwnedBinding(user).catch(() => null);
    if (recovered?.member) {
      this.identity = recovered.member;
      this.binding = recovered.binding;
      this.repairProfileFromBinding(user, recovered.member);
      return recovered.member;
    }

    return null;
  }

  async claimIdentity(identityId, confirmationName, { onProgress } = {}) {
    const user = auth.currentUser;
    if (!user) throw new Error("Entre na sua conta antes de escolher sua identidade.");
    if (!navigator.onLine) throw new Error("O primeiro vínculo de identidade precisa de internet. Depois disso a JORDAN continua funcionando offline.");

    const member = getLineageMember(identityId);
    if (!member) throw new Error("Identidade não reconhecida.");
    if (!this.validateConfirmation(identityId, confirmationName)) {
      throw new Error("O segundo nome de confirmação não corresponde a essa identidade.");
    }

    const bindingRef = doc(firestore, "lineageBindings", member.id);
    const profileRef = doc(firestore, "users", user.uid, "profile", "main");

    onProgress?.("Verificando conexão com o Cloud Core…", 18);

    // Server read primeiro: evita o comportamento antigo em que runTransaction
    // podia ficar aguardando a rede indefinidamente.
    let bindingSnap;
    try {
      bindingSnap = await readServer(bindingRef, "Cloud de identidade");
    } catch (error) {
      throw friendlyCloudError(error, "Não consegui confirmar o Firestore agora.");
    }

    if (bindingSnap.exists() && bindingSnap.data()?.ownerUid !== user.uid) {
      throw new Error(`${member.firstName} já está vinculado a outra conta.`);
    }

    onProgress?.("Validando exclusividade da identidade…", 35);

    // Um mesmo Firebase UID não pode assumir duas identidades.
    const owned = await this.findOwnedBinding(user, { server: true }).catch((error) => {
      console.warn("JORDAN Lineage / owned binding:", error);
      return null;
    });
    if (owned?.member && owned.member.id !== member.id) {
      throw new Error(`Esta conta já está vinculada à identidade ${owned.member.firstName}.`);
    }

    if (member.id !== "jhuan") {
      const creatorRef = doc(firestore, "lineageBindings", "jhuan");
      const creatorSnap = await readServer(creatorRef, "Identidade do creator");
      if (!creatorSnap.exists()) {
        throw new Error("A identidade do creator Jhuan precisa ser vinculada primeiro. Depois os demais membros podem fazer o cadastro.");
      }
    }

    // Também respeitamos um perfil já existente, se houver.
    try {
      const profileSnap = await readServer(profileRef, "Perfil JORDAN");
      const existingLineageId = profileSnap.exists() ? profileSnap.data()?.lineageId : null;
      if (existingLineageId && existingLineageId !== member.id) {
        const existingMember = getLineageMember(existingLineageId);
        throw new Error(`Esta conta já está vinculada à identidade ${existingMember?.firstName || existingLineageId}.`);
      }
    } catch (error) {
      if (!String(error?.message || "").includes("já está vinculada")) {
        // Perfil inexistente é normal; erros reais de conexão já foram cobertos pelo preflight.
        console.info("JORDAN Lineage: perfil ainda não existe; criando durante o vínculo.");
      } else {
        throw error;
      }
    }

    onProgress?.("Gravando assinatura da linhagem…", 60);

    const bindingPayload = {
      identityId: member.id,
      ownerUid: user.uid,
      firstName: member.firstName,
      role: member.role,
      claimedAt: bindingSnap.exists() ? bindingSnap.data()?.claimedAt || serverTimestamp() : serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await writeServer(bindingRef, bindingPayload, { merge: true }, {
        label: "Vínculo da identidade",
        verify: (snap) => snap?.exists?.() && snap.data()?.ownerUid === user.uid
      });
    } catch (error) {
      throw friendlyCloudError(error, "O Firestore não confirmou o vínculo da identidade.");
    }

    onProgress?.("Sincronizando seu perfil…", 82);

    const profilePayload = {
      lineageId: member.id,
      lineageRole: member.role,
      firstName: member.firstName,
      displayName: user.displayName || member.firstName,
      updatedAt: serverTimestamp()
    };

    try {
      await writeServer(profileRef, profilePayload, { merge: true }, {
        label: "Perfil JORDAN",
        verify: (snap) => snap?.exists?.() && snap.data()?.lineageId === member.id
      });
    } catch (error) {
      // O binding é a fonte de verdade. Se apenas o perfil atrasar, a recuperação
      // automática em loadCurrentIdentity repara na próxima abertura.
      console.warn("JORDAN Lineage: binding confirmado, perfil pendente.", error);
    }

    onProgress?.("Identidade confirmada.", 100);

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
