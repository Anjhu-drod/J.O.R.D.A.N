const PROFILE_PREFIX = "jordan.voiceprint.v2.";
const FEATURE_VERSION = 2;

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
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i];
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
    this.mismatchStreak = 0;
    this.lastMismatchAt = 0;
  }

  setIdentity(identityId) { this.identityId = identityId || null; }
  profileKey() { return `${PROFILE_PREFIX}${this.identityId || "unknown"}`; }
  hasProfile() { return Boolean(this.getProfile()); }

  getProfile() {
    if (!this.identityId) return null;
    try {
      const profile = JSON.parse(localStorage.getItem(this.profileKey()) || "null");
      if (!profile?.vector || Number(profile.version || 0) !== FEATURE_VERSION) return null;
      return profile;
    } catch { return null; }
  }

  exportProfile() {
    const profile = this.getProfile();
    if (!profile?.vector) return null;
    return { identityId: profile.identityId, vector: profile.vector.map(Number), createdAt: profile.createdAt, samples: profile.samples, version: FEATURE_VERSION };
  }

  importProfile(profile) {
    if (!this.identityId || !profile?.vector || !Array.isArray(profile.vector)) return false;
    if (Number(profile.version || 0) !== FEATURE_VERSION) return false;
    const clean = { identityId: this.identityId, vector: profile.vector.map(Number), createdAt: profile.createdAt || new Date().toISOString(), samples: Number(profile.samples || 0), version: FEATURE_VERSION };
    localStorage.setItem(this.profileKey(), JSON.stringify(clean));
    return true;
  }

  clearProfile() { if (this.identityId) localStorage.removeItem(this.profileKey()); }

  setPolicy({ enabled = this.enabled, allowThirdPartyConversation = this.allowThirdPartyConversation } = {}) {
    this.enabled = Boolean(enabled);
    this.allowThirdPartyConversation = Boolean(allowThirdPartyConversation);
    if (this.enabled) this.startMonitoring().catch(() => {}); else this.stopMonitoring();
  }

  async startMonitoring() {
    if (this.stream) return true;
    if (!navigator.mediaDevices?.getUserMedia) return false;

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: {
      echoCancellation: true,
      noiseSuppression: true,
      // AGC muda o timbre relativo entre aparelhos; desativar quando possível melhora o fingerprint.
      autoGainControl: false,
      channelCount: 1
    }});

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.42;
    source.connect(this.analyser);
    this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);

    this.timer = setInterval(() => {
      const frame = this.captureFeatureVector();
      if (!frame) return;
      this.frames.push({ at: Date.now(), vector: frame });
      const cutoff = Date.now() - 7500;
      while (this.frames.length && this.frames[0].at < cutoff) this.frames.shift();
    }, 95);
    return true;
  }

  stopMonitoring() {
    clearInterval(this.timer); this.timer = null;
    this.stream?.getTracks?.().forEach((track) => track.stop());
    this.stream = null; this.analyser = null;
    if (this.audioContext && this.audioContext.state !== "closed") this.audioContext.close().catch(() => {});
    this.audioContext = null; this.frames = [];
  }

  captureFeatureVector() {
    if (!this.analyser || !this.frequencyData || !this.audioContext) return null;
    this.analyser.getFloatFrequencyData(this.frequencyData);
    const bins = this.frequencyData;
    const nyquist = this.audioContext.sampleRate / 2;
    const hzPerBin = nyquist / bins.length;
    const edges = [80,120,180,250,350,500,700,1000,1400,2000,2800,3800,5000,6500];
    const bands = [];
    let weighted = 0, total = 0;

    for (let e = 0; e < edges.length - 1; e++) {
      const start = Math.max(1, Math.floor(edges[e] / hzPerBin));
      const end = Math.min(bins.length, Math.max(start + 1, Math.ceil(edges[e + 1] / hzPerBin)));
      let sumDb = 0, count = 0;
      for (let i = start; i < end; i++) {
        const db = Number.isFinite(bins[i]) ? Math.max(-120, bins[i]) : -120;
        sumDb += db; count++;
        const linear = Math.pow(10, db / 20);
        total += linear; weighted += linear * (i * hzPerBin);
      }
      bands.push(count ? sumDb / count : -120);
    }

    if (total < 0.004) return null;
    // A forma relativa do espectro transfere melhor entre microfones do que volume absoluto.
    const mean = bands.reduce((a,b) => a+b, 0) / bands.length;
    const shape = bands.map((db) => (db - mean) / 24);
    const centroid = Math.min(1, (weighted / total) / 5000);
    const highVsLow = ((bands.slice(7).reduce((a,b)=>a+b,0) / (bands.length-7)) - (bands.slice(0,5).reduce((a,b)=>a+b,0) / 5)) / 40;
    return normalizeVector([...shape, centroid, highVsLow]);
  }

  recentVector(windowMs = 2600) {
    const cutoff = Date.now() - windowMs;
    const vectors = this.frames.filter((item) => item.at >= cutoff).map((item) => item.vector);
    return vectors.length >= 5 ? normalizeVector(averageVectors(vectors)) : null;
  }

  async enroll({ durationMs = 8000, onProgress = null } = {}) {
    if (!this.identityId) throw new Error("Identidade JORDAN não definida.");
    await this.startMonitoring();
    this.frames = [];
    const started = Date.now();
    while (Date.now() - started < durationMs) {
      onProgress?.(Math.min(1, (Date.now() - started) / durationMs));
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    const vectors = this.frames.map((item) => item.vector);
    if (vectors.length < 18) throw new Error("Não consegui captar fala suficiente. Fale durante todo o cadastro.");
    const profile = { identityId: this.identityId, vector: normalizeVector(averageVectors(vectors)), createdAt: new Date().toISOString(), samples: vectors.length, version: FEATURE_VERSION };
    localStorage.setItem(this.profileKey(), JSON.stringify(profile));
    onProgress?.(1);
    return profile;
  }

  verifyRecent() {
    if (!this.enabled) return { required:false, authorized:true, score:1, reason:"disabled", state:"session" };
    const profile = this.getProfile();
    // A autenticação real é Firebase/JORDAN ID. A voz é um sinal auxiliar, não motivo
    // para expulsar o próprio dono quando o microfone mudou ou não captou áudio suficiente.
    if (!profile?.vector) return { required:true, authorized:true, score:0, reason:"no-profile", state:"uncertain" };
    const current = this.recentVector();
    if (!current) return { required:true, authorized:true, score:0, reason:"no-audio", state:"uncertain" };

    const score = cosine(profile.vector, current);
    if (score >= 0.72) {
      this.mismatchStreak = 0;
      return { required:true, authorized:true, score, reason:"match", state:"owner" };
    }

    // Microfone, sala, celular e processamento acústico mudam muito o espectro.
    // Uma leitura isolada nunca deve transformar o dono logado em “terceiro”.
    // Só classificamos como convidado quando há uma incompatibilidade MUITO forte
    // repetida em várias verificações próximas.
    if (score <= 0.28) {
      const now = Date.now();
      if (now - this.lastMismatchAt > 9000) this.mismatchStreak = 0;
      this.lastMismatchAt = now;
      this.mismatchStreak += 1;
      if (this.mismatchStreak >= 3) {
        return { required:true, authorized:false, score, reason:"stable-confident-mismatch", state:"guest" };
      }
      return { required:true, authorized:true, score, reason:"mismatch-not-confirmed", state:"uncertain" };
    }

    this.mismatchStreak = 0;
    return { required:true, authorized:true, score, reason:"uncertain", state:"uncertain" };
  }
}

export const voiceIdentityService = new VoiceIdentityService();
