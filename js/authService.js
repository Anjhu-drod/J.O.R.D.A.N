import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  doc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { auth, firestore } from "./firebaseService.js";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

function clean(value = "") {
  return String(value || "").trim();
}

export function friendlyAuthError(error) {
  const code = error?.code || "";
  const messages = {
    "auth/invalid-email": "Esse e-mail não parece válido.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/user-disabled": "Essa conta foi desativada.",
    "auth/email-already-in-use": "Já existe uma conta usando esse e-mail.",
    "auth/weak-password": "Use uma senha mais forte, com pelo menos 6 caracteres.",
    "auth/missing-password": "Digite sua senha.",
    "auth/popup-closed-by-user": "A janela do Google foi fechada antes do login terminar.",
    "auth/popup-blocked": "O navegador bloqueou a janela do Google. Vou tentar o modo de redirecionamento.",
    "auth/unauthorized-domain": "Este domínio ainda não foi autorizado no Firebase Authentication.",
    "auth/network-request-failed": "Sem conexão com o Firebase. Se este aparelho já estava logado, tente reabrir a JORDAN offline.",
    "auth/too-many-requests": "Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente."
  };
  return messages[code] || error?.message || "Não foi possível concluir a autenticação.";
}

async function configurePersistence(remember = true) {
  await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
}

function isOfflineLikeError(error) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return !navigator.onLine
    || code.includes("unavailable")
    || code.includes("network-request-failed")
    || message.includes("client is offline")
    || message.includes("failed to fetch");
}

async function saveProfile(user, extra = {}) {
  if (!user) return;

  const profileRef = doc(firestore, "users", user.uid, "profile", "main");

  // O perfil em nuvem é complementar ao Firebase Auth. Ele NUNCA deve
  // impedir um login válido de abrir a JORDAN. O Firestore mantém a escrita
  // pendente e confirma quando recuperar a conexão.
  Promise.resolve(setDoc(profileRef, {
    uid: user.uid,
    email: user.email || null,
    displayName: user.displayName || extra.displayName || "Usuário JORDAN",
    photoURL: user.photoURL || null,
    providerIds: user.providerData?.map((item) => item.providerId).filter(Boolean) || [],
    lastLoginAt: serverTimestamp(),
    createdAt: extra.createdAt || user.metadata?.creationTime || new Date().toISOString(),
    schemaVersion: 1
  }, { merge: true })).catch((error) => {
    if (isOfflineLikeError(error)) {
      console.info("JORDAN Auth: perfil aguardando sincronização com o Firestore.");
      return;
    }
    console.warn("JORDAN Auth profile:", error);
  });
}

export class AuthService {
  get currentUser() {
    return auth.currentUser;
  }

  watch(callback) {
    return onAuthStateChanged(auth, callback);
  }

  async consumeRedirectResult() {
    try {
      const result = await getRedirectResult(auth);
      if (result?.user) await saveProfile(result.user);
      return result;
    } catch (error) {
      console.warn("JORDAN Auth redirect:", error);
      throw error;
    }
  }

  async loginEmail(email, password, { remember = true } = {}) {
    await configurePersistence(remember);
    const result = await signInWithEmailAndPassword(auth, clean(email), password);
    await saveProfile(result.user);
    return result.user;
  }

  async createAccount({ name, email, password, remember = true }) {
    await configurePersistence(remember);
    const result = await createUserWithEmailAndPassword(auth, clean(email), password);
    const displayName = clean(name) || "Usuário JORDAN";
    await updateProfile(result.user, { displayName });
    await saveProfile(result.user, { displayName });
    return result.user;
  }

  async loginGoogle({ remember = true } = {}) {
    await configurePersistence(remember);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      await saveProfile(result.user);
      return { user: result.user, redirected: false };
    } catch (error) {
      if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(error?.code)) {
        await signInWithRedirect(auth, googleProvider);
        return { user: null, redirected: true };
      }
      throw error;
    }
  }


  async setDisplayName(name) {
    const user = auth.currentUser;
    if (!user) return null;
    const displayName = clean(name);
    if (!displayName) return user;
    await updateProfile(user, { displayName });
    await saveProfile(user, { displayName });
    return user;
  }

  async resetPassword(email) {
    const normalizedEmail = clean(email);
    if (!normalizedEmail) throw new Error("Digite seu e-mail primeiro.");
    await sendPasswordResetEmail(auth, normalizedEmail);
  }

  async logout() {
    await signOut(auth);
  }
}

export const authService = new AuthService();
