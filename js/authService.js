import {
  EmailAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getRedirectResult,
  linkWithCredential,
  linkWithPopup,
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
    "auth/invalid-credential": "E-mail ou senha incorretos. Se esta JORDAN ID foi criada com Google, use CONTINUAR COM GOOGLE neste dispositivo.",
    "auth/user-disabled": "Essa conta foi desativada.",
    "auth/email-already-in-use": "Já existe uma conta usando esse e-mail. Entre nela em vez de criar outra.",
    "auth/weak-password": "Use uma senha mais forte, com pelo menos 6 caracteres.",
    "auth/missing-password": "Digite sua senha.",
    "auth/popup-closed-by-user": "A janela do Google foi fechada antes do login terminar.",
    "auth/popup-blocked": "O navegador bloqueou a janela do Google. Vou tentar o modo de redirecionamento.",
    "auth/unauthorized-domain": "Este domínio ainda não foi autorizado no Firebase Authentication.",
    "auth/network-request-failed": "Sem conexão com o Firebase. Se este aparelho já estava logado, reabra a JORDAN offline.",
    "auth/too-many-requests": "Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.",
    "auth/account-exists-with-different-credential": "Esse e-mail já pertence a uma JORDAN ID, mas por outro método de login. Entre pelo método original e depois vincule Google + senha em SYS.",
    "auth/credential-already-in-use": "Essa credencial já pertence a outra conta Firebase.",
    "auth/provider-already-linked": "Esse método de login já está vinculado à sua JORDAN ID.",
    "auth/requires-recent-login": "Por segurança, entre novamente na conta e repita essa alteração.",
    "auth/email-already-exists": "Esse e-mail já pertence a outra conta."
  };
  return messages[code] || error?.message || "Não foi possível concluir a autenticação.";
}

async function configurePersistence() {
  // JORDAN é pessoal e deve continuar autenticada até o usuário escolher SAIR.
  // LOCAL também permite várias sessões simultâneas do mesmo UID em dispositivos diferentes.
  await setPersistence(auth, browserLocalPersistence);
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
  Promise.resolve(setDoc(profileRef, {
    uid: user.uid,
    email: user.email || null,
    emailVerified: Boolean(user.emailVerified),
    displayName: user.displayName || extra.displayName || "Usuário JORDAN",
    photoURL: user.photoURL || null,
    providerIds: user.providerData?.map((item) => item.providerId).filter(Boolean) || [],
    lastLoginAt: serverTimestamp(),
    createdAt: extra.createdAt || user.metadata?.creationTime || new Date().toISOString(),
    schemaVersion: 2
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

  async waitUntilReady() {
    await configurePersistence().catch(() => {});
    if (typeof auth.authStateReady === "function") {
      await auth.authStateReady();
    }
    return auth.currentUser;
  }

  watch(callback) {
    return onAuthStateChanged(auth, callback);
  }

  providerIds(user = auth.currentUser) {
    return user?.providerData?.map((item) => item.providerId).filter(Boolean) || [];
  }

  providerSummary(user = auth.currentUser) {
    const providers = this.providerIds(user);
    const labels = [];
    if (providers.includes("password")) labels.push("E-MAIL + SENHA");
    if (providers.includes("google.com")) labels.push("GOOGLE");
    return labels.length ? labels.join(" · ") : "FIREBASE AUTH";
  }

  async consumeRedirectResult() {
    await configurePersistence();
    try {
      const result = await getRedirectResult(auth);
      if (result?.user) await saveProfile(result.user);
      return result;
    } catch (error) {
      console.warn("JORDAN Auth redirect:", error);
      throw error;
    }
  }

  async loginEmail(email, password) {
    await configurePersistence();
    const result = await signInWithEmailAndPassword(auth, clean(email), password);
    await saveProfile(result.user);
    return result.user;
  }

  async createAccount({ name, email, password }) {
    await configurePersistence();
    const result = await createUserWithEmailAndPassword(auth, clean(email), password);
    const displayName = clean(name) || "Usuário JORDAN";
    await updateProfile(result.user, { displayName });
    await saveProfile(result.user, { displayName });
    return result.user;
  }

  async loginGoogle() {
    await configurePersistence();

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

  async linkGoogleToCurrentUser() {
    await configurePersistence();
    const user = auth.currentUser;
    if (!user) throw new Error("Entre na JORDAN ID antes de vincular o Google.");
    if (this.providerIds(user).includes("google.com")) return user;

    const result = await linkWithPopup(user, googleProvider);
    await saveProfile(result.user);
    return result.user;
  }

  async linkPasswordToCurrentUser(password) {
    await configurePersistence();
    const user = auth.currentUser;
    if (!user?.email) throw new Error("Esta conta não possui e-mail para vincular uma senha.");
    if (this.providerIds(user).includes("password")) {
      const error = new Error("Acesso por e-mail e senha já está vinculado.");
      error.code = "auth/provider-already-linked";
      throw error;
    }
    const normalizedPassword = String(password || "");
    if (normalizedPassword.length < 6) {
      const error = new Error("A senha precisa ter pelo menos 6 caracteres.");
      error.code = "auth/weak-password";
      throw error;
    }

    const credential = EmailAuthProvider.credential(user.email, normalizedPassword);
    const result = await linkWithCredential(user, credential);
    await saveProfile(result.user);
    return result.user;
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
