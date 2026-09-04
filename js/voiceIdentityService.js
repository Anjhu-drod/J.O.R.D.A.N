const PROFILE_PREFIX = "jordan.voiceprint.v1.";

function averageVectors(vectors = []) {
  if (!vectors.length) return null;
  const size = vectors[0].length;
  const result = new Array(size).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < size; i++) result[i] += Number(vector[i] || 0);
  }
  return result.map((value) => value / vectors.length);
}

function normalizeVector(vector = []) {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / norm);
}

function cosine(a = [], b = []) {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  return dot / ((Math.sqrt(aa) * Math.sqrt(bb)) || 1);
}

export class VoiceIdentityService {
  constructor() {
    this.identityId = null;
    this.enabled = false;
    this.allowThirdPartyConversation = true;
    this.audioContext = null;
    this.stream = null;
    this.analyser = null;
    this.frequencyData = null;
    this.frames = [];
    this.timer = null;
  }

  setIdentity(identityId) {
    this.identityId = identityId || null;
  }

  profileKey() {
    return `${PROFILE_PREFIX}${this.identityId || "unknown"}`;
  }

  hasProfile() {
    return Boolean(this.identityId && localStorage.getItem(this.profileKey()));
  }

  getProfile() {
    if (!this.identityId) return null;
    try {
      return JSON.parse(localStorage.getItem(this.profileKey()) || "null");
    } catch {
      return null;
    }
  }

  exportProfile() {
    const profile = this.getProfile();
    if (!profile?.vector) return null;
    return { identityId: profile.identityId, vector: profile.vector.map(Number), createdAt: profile.createdAt, samples: profile.samples, version: profile.version || 1 };
  }

  importProfile(profile) {
    if (!this.identityId || !profile?.vector || !Array.isArray(profile.vector)) return false;
    const clean = { identityId: this.identityId, vector: profile.vector.map(Number), createdAt: profile.createdAt || new Date().toISOString(), samples: Number(profile.samples || 0), version: Number(profile.version || 1) };
    localStorage.setItem(this.profileKey(), JSON.stringify(clean));
    return true;
  }

  clearProfile() {
    if (this.identityId) localStorage.removeItem(this.profileKey());
  }

  setPolicy({ enabled = this.enabled, allowThirdPartyConversation = this.allowThirdPartyConversation } = {}) {
    this.enabled = Boolean(enabled);
    this.allowThirdPartyConversation = Boolean(allowThirdPartyConversation);
    if (this.enabled) this.startMonitoring().catch(() => {});
    else this.stopMonitoring();
  }

  async startMonitoring() {
    if (this.stream) return true;
    if (!navigator.mediaDevices?.getUserMedia) return false;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.55;
    source.connect(this.analyser);
    this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);

    this.timer = setInterval(() => {
      const frame = this.captureFeatureVector();
      if (!frame) return;
      this.frames.push({ at: Date.now(), vector: frame });
      const cutoff = Date.now() - 7000;
      while (this.frames.length && this.frames[0].at < cutoff) this.frames.shift();
    }, 110);

    return true;
  }

  stopMonitoring() {
    clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks?.().forEach((track) => track.stop());
    this.stream = null;
    this.analyser = null;
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
    this.frames = [];
  }

  captureFeatureVector() {
    if (!this.analyser || !this.frequencyData) return null;
    this.analyser.getFloatFrequencyData(this.frequencyData);

    const bins = this.frequencyData;
    const bands = 18;
    const values = [];
    let totalLinear = 0;
    let weighted = 0;

    for (let band = 0; band < bands; band++) {
      const start = Math.floor((band / bands) * bins.length * 0.72);
      const end = Math.max(start + 1, Math.floor(((band + 1) / bands) * bins.length * 0.72));
      let sum = 0;
      let count = 0;
      for (let i = start; i < end; i++) {
        const db = Number.isFinite(bins[i]) ? bins[i] : -120;
        const linear = Math.pow(10, db / 20);
        sum += linear;
        totalLinear += linear;
        weighted += linear * i;
        count++;
      }
      values.push(count ? sum / count : 0);
    }

    if (totalLinear < 0.01) return null;
    const centroid = weighted / totalLinear / bins.length;
    values.push(centroid);
    values.push(Math.log10(totalLinear + 1e-6));
    return normalizeVector(values);
  }

  recentVector(windowMs = 2400) {
    const cutoff = Date.now() - windowMs;
    const vectors = this.frames.filter((item) => item.at >= cutoff).map((item) => item.vector);
    return vectors.length >= 4 ? normalizeVector(averageVectors(vectors)) : null;
  }

  async enroll({ durationMs = 8000, onProgress = null } = {}) {
    if (!this.identityId) throw new Error("Identidade JORDAN não definida.");
    await this.startMonitoring();
    this.frames = [];
    const started = Date.now();

    while (Date.now() - started < durationMs) {
      const elapsed = Date.now() - started;
      onProgress?.(Math.min(1, elapsed / durationMs));
      await new Promise((resolve) => setTimeout(resolve, 160));
    }

    const vectors = this.frames.map((item) => item.vector);
    if (vectors.length < 15) throw new Error("Não consegui captar fala suficiente. Fale durante o cadastro.");

    const profile = {
      identityId: this.identityId,
      vector: normalizeVector(averageVectors(vectors)),
      createdAt: new Date().toISOString(),
      samples: vectors.length,
      version: 1
    };
    localStorage.setItem(this.profileKey(), JSON.stringify(profile));
    onProgress?.(1);
    return profile;
  }

  verifyRecent() {
    if (!this.enabled) return { required: false, authorized: true, score: 1, reason: "disabled" };
    const profile = this.getProfile();
    if (!profile?.vector) return { required: true, authorized: false, score: 0, reason: "no-profile" };
    const current = this.recentVector();
    if (!current) return { required: true, authorized: false, score: 0, reason: "no-audio" };

    const score = cosine(profile.vector, current);
    // Experimental spectral fingerprint. It is a convenience gate, not strong biometric authentication.
    const authorized = score >= 0.90;
    return { required: true, authorized, score, reason: authorized ? "match" : "mismatch" };
  }
}

export const voiceIdentityService = new VoiceIdentityService();
