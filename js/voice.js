import {
  correctSpeechTranscript,
  localeForLanguage,
  pickBestRecognitionAlternative
} from "./languageService.js";
import {
  isImmediateStopCommand,
  systemCommandScore
} from "./systemCommandService.js";
import {
  JORDAN_VOICE_PROFILE,
  buildJordanProsody,
  chooseJordanBaseVoice
} from "./jordanVoiceProfile.js";

export class VoiceService {
  constructor({
    onTranscript,
    onInterimTranscript,
    onStatusChange,
    onListeningChange,
    onSpeakingChange,
    silenceMs = 2000
  } = {}) {
    this.onTranscript = onTranscript ?? (() => {});
    this.onInterimTranscript = onInterimTranscript ?? (() => {});
    this.onStatusChange = onStatusChange ?? (() => {});
    this.onListeningChange = onListeningChange ?? (() => {});
    this.onSpeakingChange = onSpeakingChange ?? (() => {});
    this.silenceMs = silenceMs;

    this.Recognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    this.recognition = null;
    this.bargeRecognition = null;
    this.listening = false;
    this.alwaysListening = false;
    this.manualStop = false;
    this.isSpeaking = false;
    this.dispatching = false;
    this.restartTimer = null;
    this.silenceTimer = null;
    this.pendingTranscript = "";
    this.currentSpeechText = "";
    this.speechToken = 0;
    this.audioContext = null;
    this.preferLocalRecognition = false;

    // O idioma NÃO é mais detectado automaticamente. PT-BR é o padrão e só
    // muda quando o usuário escolhe outro idioma nas configurações.
    this.languageMode = "pt";
    this.currentLanguage = "pt";

    this.synthesisSupported =
      "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  }

  get recognitionSupported() {
    return Boolean(this.Recognition);
  }\n\n  async localRecognitionAvailability() {\n    if (!this.Recognition?.available) return "unsupported";\n    try {\n      return await this.Recognition.available({\n        langs: [this.getRecognitionLocale()],\n        processLocally: true,\n        quality: "dictation"\n      });\n    } catch {\n      return "unsupported";\n    }\n  }\n\n  async prepareLocalRecognition() {\n    if (!this.Recognition?.available || !this.Recognition?.install) return { supported: false, status: "unsupported" };\n    const locale = this.getRecognitionLocale();\n    let status = await this.localRecognitionAvailability();\n    if (status === "downloadable" || status === "downloading") {\n      const installed = await this.Recognition.install({\n        langs: [locale],\n        processLocally: true,\n        quality: "dictation"\n      });\n      if (!installed) return { supported: true, status: "failed" };\n      status = await this.localRecognitionAvailability();\n    }\n    if (status === "available") {\n      this.preferLocalRecognition = true;\n      this.rebuildRecognition();\n      return { supported: true, status: "available" };\n    }\n    return { supported: true, status };\n  }\n\n  setPreferLocalRecognition(value) {\n    this.preferLocalRecognition = Boolean(value);\n    this.rebuildRecognition();\n  }

  setLanguageMode(mode = "pt") {
    const allowed = ["pt", "en", "es", "ja"];
    const next = allowed.includes(mode) ? mode : "pt";
    this.languageMode = next;
    this.currentLanguage = next;
    this.rebuildRecognition();
  }

  getRecognitionLanguage() {
    return this.currentLanguage || "pt";
  }

  getRecognitionLocale() {
    return localeForLanguage(this.getRecognitionLanguage());
  }

  rebuildRecognition() {
    const shouldResume = this.alwaysListening && !this.manualStop;
    if (this.recognition && this.listening) {
      try { this.recognition.stop(); } catch {}
    }
    this.recognition = null;
    if (shouldResume) this.scheduleRestart(250);
  }

  chooseRecognitionAlternative(result) {
    if (!result?.length) return { text: "", score: -Infinity };

    const candidates = [];
    for (let index = 0; index < result.length; index++) {
      const alt = result[index];
      const base = pickBestRecognitionAlternative({ 0: alt, length: 1 }, { animeContext: true, language: this.currentLanguage });
      const commandBonus = systemCommandScore(alt?.transcript || "");
      candidates.push({
        text: base.text || alt?.transcript || "",
        score: (base.score || 0) + commandBonus,
        confidence: alt?.confidence || 0
      });
    }

    return candidates.sort((a, b) => b.score - a.score)[0] || { text: "", score: -Infinity };
  }

  configureRecognition() {
    if (!this.recognitionSupported || this.recognition) return;

    const recognition = new this.Recognition();
    recognition.lang = this.getRecognitionLocale();
    if ("processLocally" in recognition) recognition.processLocally = this.preferLocalRecognition;
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;
    recognition.continuous = true;

    recognition.onstart = () => {
      this.listening = true;
      this.dispatching = false;
      this.playListenClick();
      this.onListeningChange(true);
      this.onStatusChange(
        this.alwaysListening
          ? `Áudio ativo · ${this.getRecognitionLocale()}. Pode falar normalmente.`
          : `Estou ouvindo · ${this.getRecognitionLocale()}...`
      );
    };

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const chosen = this.chooseRecognitionAlternative(result);
      let transcript = correctSpeechTranscript(chosen.text || "", { animeContext: true });
      transcript = transcript.trim();
      if (!transcript) return;

      this.pendingTranscript = transcript;
      this.onInterimTranscript(transcript);
      this.onStatusChange(`Ouvindo: “${transcript}”`);
      this.resetSilenceTimer();
    };

    recognition.onspeechend = () => {
      if (this.pendingTranscript) this.resetSilenceTimer();
    };

    recognition.onerror = (event) => {
      const messages = {
        "not-allowed": "Permissão do microfone negada.",
        "service-not-allowed": "O navegador bloqueou o serviço de voz.",
        "no-speech": "Não ouvi nenhuma fala.",
        "audio-capture": "Não consegui acessar o microfone.",
        "network": "O reconhecimento de voz teve um erro de rede."
      };

      if (event.error === "language-not-supported" && this.preferLocalRecognition) {
        this.preferLocalRecognition = false;
        this.recognition = null;
        this.onStatusChange("O pacote local não está disponível. Voltei para reconhecimento online.");
        if (this.alwaysListening) this.scheduleRestart(500);
        return;
      }

      if (event.error !== "no-speech" && event.error !== "aborted") {
        this.onStatusChange(messages[event.error] || `Erro de voz: ${event.error}`);
      }
    };

    recognition.onend = () => {
      this.listening = false;
      this.onListeningChange(false);

      if (this.pendingTranscript || this.dispatching || this.isSpeaking) return;

      if (this.alwaysListening && !this.manualStop && document.visibilityState === "visible") {
        this.recognition = null;
        this.scheduleRestart(360);
      } else if (!this.isSpeaking) {
        this.onStatusChange("Sistema pronto.");
      }
    };

    this.recognition = recognition;
  }

  resetSilenceTimer() {
    clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => this.commitPendingTranscript(), this.silenceMs);
  }

  async commitPendingTranscript() {
    if (!this.pendingTranscript || this.dispatching) return;

    const transcript = this.pendingTranscript.trim();
    this.pendingTranscript = "";
    clearTimeout(this.silenceTimer);
    this.silenceTimer = null;

    // V0.5: quando o áudio contínuo está ligado, NÃO existe mais wake word.
    // Qualquer frase finalizada por 2 s de silêncio é enviada para a JORDAN.
    this.dispatching = true;
    this.onInterimTranscript("");
    this.onStatusChange("Processando...");

    if (this.recognition && this.listening) {
      try { this.recognition.stop(); } catch {}
    }

    try {
      await this.onTranscript(transcript);
    } finally {
      this.dispatching = false;
      if (this.alwaysListening && !this.manualStop && !this.isSpeaking && document.visibilityState === "visible") {
        this.recognition = null;
        this.scheduleRestart(330);
      }
    }
  }

  start({ always = false } = {}) {
    if (!this.recognitionSupported) {
      this.onStatusChange("Este navegador não oferece reconhecimento de voz. Use o campo de texto.");
      return false;
    }

    if (this.isSpeaking) this.cancelSpeech({ resumeListening: false });

    this.alwaysListening = always;
    this.manualStop = false;
    this.configureRecognition();
    if (this.listening) return true;

    clearTimeout(this.restartTimer);
    try {
      this.recognition.start();
      return true;
    } catch {
      this.recognition = null;
      if (always) this.scheduleRestart(500);
      return false;
    }
  }

  stop({ manual = true, clearPending = true } = {}) {
    this.manualStop = manual;
    if (manual) this.alwaysListening = false;
    clearTimeout(this.restartTimer);
    clearTimeout(this.silenceTimer);

    if (clearPending) {
      this.pendingTranscript = "";
      this.onInterimTranscript("");
    }

    if (this.recognition && this.listening) {
      try { this.recognition.stop(); } catch {}
    }
    this.onListeningChange(false);
  }

  setAlwaysListening(enabled) {
    this.alwaysListening = Boolean(enabled);
    if (enabled) {
      this.manualStop = false;
      return this.start({ always: true });
    }

    this.stop({ manual: true });
    this.onStatusChange("Áudio contínuo desativado.");
    return true;
  }

  scheduleRestart(delay = 350) {
    clearTimeout(this.restartTimer);
    if (!this.alwaysListening || this.manualStop || this.isSpeaking) return;

    this.restartTimer = setTimeout(() => {
      if (!this.listening && document.visibilityState === "visible") {
        this.recognition = null;
        this.start({ always: true });
      }
    }, delay);
  }

  playListenClick() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.audioContext ??= new AudioContext();
      const ctx = this.audioContext;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(900, now);
      oscillator.frequency.exponentialRampToValueAtTime(700, now + 0.04);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.014, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.055);
    } catch {}
  }

  getVoices() {
    if (!this.synthesisSupported) return [];
    return window.speechSynthesis.getVoices();
  }

  chooseJordanVoice() {
    return chooseJordanBaseVoice(this.getVoices(), localeForLanguage(this.currentLanguage));
  }

  getVoiceProfileLabel() {
    return JORDAN_VOICE_PROFILE.label;
  }

  async speak(text, {
    rate = JORDAN_VOICE_PROFILE.baseRate,
    pitch = JORDAN_VOICE_PROFILE.basePitch,
    volume = 1,
    mood = "neutral",
    allowBargeIn = true,
    language = this.currentLanguage
  } = {}) {
    if (!this.synthesisSupported || !text) return;

    const token = ++this.speechToken;
    const shouldResume = this.alwaysListening;
    this.manualStop = false;
    this.currentSpeechText = String(text);

    clearTimeout(this.silenceTimer);
    this.pendingTranscript = "";
    this.onInterimTranscript("");

    if (this.listening && this.recognition) {
      try { this.recognition.stop(); } catch {}
    }

    window.speechSynthesis.cancel();
    this.setSpeakingState(true);

    const segments = buildJordanProsody(this.currentSpeechText, { rate, pitch, mood });

    if (allowBargeIn && shouldResume) {
      setTimeout(() => {
        if (this.isSpeaking && token === this.speechToken) this.startBargeInRecognition();
      }, 380);
    }

    for (const segment of segments) {
      if (token !== this.speechToken) break;
      await this.speakSegment(segment, { volume, token, language });
    }

    if (token !== this.speechToken) return;
    this.stopBargeInRecognition();
    this.setSpeakingState(false);
    this.onStatusChange("Sistema pronto.");
    this.currentSpeechText = "";

    if (shouldResume && this.alwaysListening && document.visibilityState === "visible") {
      this.recognition = null;
      this.scheduleRestart(300);
    }
  }

  speakSegment(segment, { volume, token, language }) {
    return new Promise((resolve) => {
      if (token !== this.speechToken) return resolve();

      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.lang = localeForLanguage(language);
      utterance.rate = Math.max(0.7, Math.min(2, segment.rate));
      utterance.pitch = Math.max(0.5, Math.min(2, segment.pitch));
      utterance.volume = volume;

      const selected = chooseJordanBaseVoice(this.getVoices(), utterance.lang);
      if (selected) utterance.voice = selected;

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve();
      };

      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
    });
  }

  async singOriginal(lines = [], { volume = 1 } = {}) {
    if (!this.synthesisSupported) return;
    const sequence = Array.isArray(lines) ? lines.filter(Boolean) : String(lines || "").split(/\n+/).filter(Boolean);
    if (!sequence.length) return;

    const token = ++this.speechToken;
    const shouldResume = this.alwaysListening;
    if (this.listening && this.recognition) {
      try { this.recognition.stop(); } catch {}
    }
    window.speechSynthesis.cancel();
    this.setSpeakingState(true);

    const melody = [1.2, 1.35, 1.26, 1.42, 1.3, 1.48];
    for (let i = 0; i < sequence.length; i++) {
      if (token !== this.speechToken) break;
      await this.speakSegment({
        text: sequence[i],
        rate: 0.92 + (i % 2) * 0.05,
        pitch: melody[i % melody.length]
      }, { volume, token, language: "pt" });
    }

    if (token !== this.speechToken) return;
    this.setSpeakingState(false);
    if (shouldResume && this.alwaysListening && document.visibilityState === "visible") {
      this.recognition = null;
      this.scheduleRestart(320);
    }
  }

  pronounceEnglish(text) {
    if (!this.synthesisSupported || !text) return;

    const shouldResume = this.alwaysListening;
    if (this.recognition && this.listening) {
      try { this.recognition.stop(); } catch {}
    }

    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = "en-US";
    utterance.rate = 0.82;
    utterance.pitch = 1.02;
    utterance.volume = 1;

    const voices = this.getVoices().filter((voice) => (voice.lang || "").toLowerCase().startsWith("en"));
    const preferred = voices.find((voice) => /google.*us|samantha|zira|female|victoria/i.test(voice.name)) || voices[0];
    if (preferred) utterance.voice = preferred;

    const resume = () => {
      if (shouldResume && this.alwaysListening && document.visibilityState === "visible") {
        this.recognition = null;
        this.scheduleRestart(240);
      }
    };

    utterance.onend = resume;
    utterance.onerror = resume;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  setSpeakingState(active) {
    if (this.isSpeaking === active) return;
    this.isSpeaking = active;
    this.onSpeakingChange(active);
    this.onStatusChange(active ? "Falando... diga “Shut up” para interromper." : "Sistema pronto.");
  }

  cancelSpeech({ resumeListening = false } = {}) {
    if (!this.synthesisSupported) return;
    ++this.speechToken;
    window.speechSynthesis.cancel();
    this.stopBargeInRecognition();
    this.currentSpeechText = "";
    this.setSpeakingState(false);
    if (resumeListening && this.recognitionSupported) {
      setTimeout(() => this.start({ always: this.alwaysListening }), 100);
    }
  }

  interruptAndListen() {
    this.cancelSpeech({ resumeListening: false });
    return this.start({ always: this.alwaysListening });
  }

  startBargeInRecognition() {
    if (!this.recognitionSupported || this.bargeRecognition || !this.isSpeaking) return;

    try {
      const recognition = new this.Recognition();
      // Interrupção é um comando de sistema em inglês.
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;
      recognition.continuous = true;

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          for (let j = 0; j < result.length; j++) {
            const transcript = result[j]?.transcript?.trim() || "";
            if (!isImmediateStopCommand(transcript)) continue;
            this.stopBargeInRecognition();
            this.cancelSpeech({ resumeListening: true });
            this.onStatusChange("Fala interrompida. Áudio continua ativo.");
            return;
          }
        }
      };

      recognition.onerror = () => {};
      recognition.onend = () => {
        if (this.bargeRecognition === recognition) this.bargeRecognition = null;
      };

      this.bargeRecognition = recognition;
      recognition.start();
    } catch {
      this.bargeRecognition = null;
    }
  }

  stopBargeInRecognition() {
    if (!this.bargeRecognition) return;
    const recognition = this.bargeRecognition;
    this.bargeRecognition = null;
    try { recognition.stop(); } catch {}
  }
}
