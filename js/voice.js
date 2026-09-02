import {
  SUPPORTED_LANGUAGES,
  containsWakeWord,
  correctSpeechTranscript,
  detectLanguage,
  localeForLanguage,
  pickBestRecognitionAlternative
} from "./languageService.js";

export class VoiceService {
  constructor({
    onTranscript,
    onInterimTranscript,
    onStatusChange,
    onListeningChange,
    onSpeakingChange,
    onLanguageDetected,
    silenceMs = 2000
  } = {}) {
    this.onTranscript = onTranscript ?? (() => {});
    this.onInterimTranscript = onInterimTranscript ?? (() => {});
    this.onStatusChange = onStatusChange ?? (() => {});
    this.onListeningChange = onListeningChange ?? (() => {});
    this.onSpeakingChange = onSpeakingChange ?? (() => {});
    this.onLanguageDetected = onLanguageDetected ?? (() => {});
    this.silenceMs = silenceMs;

    this.Recognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    this.recognition = null;
    this.bargeRecognition = null;
    this.listening = false;
    this.alwaysListening = false;
    this.manualStop = false;
    this.isSpeaking = false;
    this.restartTimer = null;
    this.silenceTimer = null;
    this.pendingTranscript = "";
    this.lastDisplayedTranscript = "";
    this.dispatching = false;
    this.wakeArmedUntil = 0;
    this.bargeWakeArmedUntil = 0;
    this.preferredVoiceName = null;
    this.currentSpeechText = "";
    this.speechToken = 0;
    this.audioContext = null;

    this.languageMode = "auto";
    this.currentLanguage = "pt";
    this.autoLocaleIndex = 0;
    this.autoLanguages = ["pt", "en", "es", "ja"];

    this.synthesisSupported =
      "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  }

  get recognitionSupported() {
    return Boolean(this.Recognition);
  }

  setLanguageMode(mode = "auto") {
    this.languageMode = SUPPORTED_LANGUAGES[mode] ? mode : "auto";
    if (this.languageMode !== "auto") this.currentLanguage = this.languageMode;
    this.rebuildRecognition();
  }

  getRecognitionLanguage() {
    return this.languageMode === "auto" ? this.currentLanguage : this.languageMode;
  }

  getRecognitionLocale() {
    return localeForLanguage(this.getRecognitionLanguage());
  }

  rebuildRecognition() {
    const wasListening = this.listening;
    if (this.recognition && this.listening) {
      try { this.recognition.stop(); } catch {}
    }
    this.recognition = null;
    if (wasListening && !this.manualStop) this.scheduleRestart(220);
  }

  rotateAutoLocale() {
    if (this.languageMode !== "auto") return;
    this.autoLocaleIndex = (this.autoLocaleIndex + 1) % this.autoLanguages.length;
    this.currentLanguage = this.autoLanguages[this.autoLocaleIndex];
    this.recognition = null;
  }

  configureRecognition() {
    if (!this.recognitionSupported || this.recognition) return;

    const recognition = new this.Recognition();
    recognition.lang = this.getRecognitionLocale();
    recognition.interimResults = true;
    recognition.maxAlternatives = 5;
    recognition.continuous = true;

    recognition.onstart = () => {
      this.listening = true;
      this.dispatching = false;
      this.playListenClick();
      this.onListeningChange(true);
      const langLabel = this.languageMode === "auto" ? `AUTO/${this.currentLanguage.toUpperCase()}` : this.currentLanguage.toUpperCase();
      this.onStatusChange(
        this.alwaysListening
          ? `Escuta ativa · ${langLabel}. Diga “Jordan” e fale normalmente.`
          : `Estou ouvindo · ${langLabel}...`
      );
    };

    recognition.onresult = (event) => {
      let transcript = "";
      let animeContext = false;

      for (let i = 0; i < event.results.length; i++) {
        const chosen = pickBestRecognitionAlternative(event.results[i], { animeContext });
        if (chosen.text) {
          transcript += `${chosen.text} `;
          animeContext = animeContext || /\b(anime|luffy|lucy|zoro|naruto|sasuke|itachi|jiraiya|gon|killua|fruta|haki|nen)\b/i.test(chosen.text);
        }
      }

      transcript = correctSpeechTranscript(transcript.trim(), { animeContext });
      if (!transcript) return;

      if (containsWakeWord(transcript)) this.wakeArmedUntil = Date.now() + 8000;

      const detected = detectLanguage(transcript, this.currentLanguage || "pt");
      if (this.languageMode === "auto" && detected !== this.currentLanguage) {
        this.currentLanguage = detected;
        this.autoLocaleIndex = Math.max(0, this.autoLanguages.indexOf(detected));
        this.onLanguageDetected(detected);
      }

      this.pendingTranscript = transcript;
      this.lastDisplayedTranscript = transcript;
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

      if (event.error === "no-speech" && this.languageMode === "auto") {
        this.rotateAutoLocale();
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
        // Ao recriar, aplicamos o idioma detectado à próxima rodada.
        this.recognition = null;
        this.scheduleRestart(420);
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
    this.lastDisplayedTranscript = "";
    clearTimeout(this.silenceTimer);
    this.silenceTimer = null;

    const hasWakeWord = containsWakeWord(transcript);
    const recentlyHeardWakeWord = Date.now() < this.wakeArmedUntil;

    if (this.alwaysListening && !hasWakeWord && !recentlyHeardWakeWord) {
      this.onInterimTranscript("");
      this.onStatusChange('Não detectei “Jordan”. Continuo ouvindo.');
      this.restartRecognitionSoon();
      return;
    }

    this.wakeArmedUntil = 0;
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
        this.scheduleRestart(420);
      }
    }
  }

  normalize(text = "") {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  start({ always = false } = {}) {
    if (!this.recognitionSupported) {
      this.onStatusChange("Este navegador não oferece reconhecimento de voz. Use o campo de texto.");
      return false;
    }

    if (this.isSpeaking) this.cancelSpeech({ resumeListening: false });

    this.configureRecognition();
    this.alwaysListening = always;
    this.manualStop = false;
    if (this.listening) return true;

    clearTimeout(this.restartTimer);
    try {
      this.recognition.start();
      return true;
    } catch {
      this.recognition = null;
      this.scheduleRestart(450);
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
    this.alwaysListening = enabled;
    if (enabled) this.start({ always: true });
    else {
      this.stop({ manual: true });
      this.onStatusChange("Escuta contínua desativada.");
    }
  }

  restartRecognitionSoon() {
    if (this.recognition && this.listening) {
      try { this.recognition.stop(); } catch {}
    }
    this.recognition = null;
    this.scheduleRestart(350);
  }

  scheduleRestart(delay = 400) {
    clearTimeout(this.restartTimer);
    if (!this.alwaysListening || this.manualStop || this.isSpeaking) return;

    this.restartTimer = setTimeout(() => {
      if (!this.listening && document.visibilityState === "visible") {
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
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(920, now);
      oscillator.frequency.exponentialRampToValueAtTime(680, now + 0.045);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.018, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.06);
    } catch {}
  }

  setPreferredVoiceName(name) {
    this.preferredVoiceName = name || null;
  }

  getVoices() {
    if (!this.synthesisSupported) return [];
    return window.speechSynthesis.getVoices();
  }

  getPortugueseVoices() {
    return this.getVoices().filter((voice) => voice.lang?.toLowerCase().startsWith("pt"));
  }

  chooseVoiceForLanguage(language = "pt") {
    const locale = localeForLanguage(language).toLowerCase();
    const baseLang = locale.split("-")[0];
    const voices = this.getVoices().filter((voice) => voice.lang?.toLowerCase().startsWith(baseLang));
    if (!voices.length) return null;

    if (language === "pt" && this.preferredVoiceName) {
      const preferred = voices.find((voice) => voice.name === this.preferredVoiceName);
      if (preferred) return preferred;
    }

    const feminineHints = [
      "google", "female", "feminina", "luciana", "francisca", "maria", "helena", "leticia", "camila",
      "fernanda", "vitoria", "bruna", "samantha", "victoria", "zira", "susan", "monica", "paulina",
      "helena", "kyoko", "o-ren", "haruka", "nanami"
    ];
    const masculineHints = /male|mascul|felipe|daniel|ricardo|antonio|joao|thiago|jorge|diego|carlos|david/;

    const score = (voice) => {
      const name = this.normalize(voice.name);
      const lang = voice.lang?.toLowerCase() || "";
      let value = lang === locale ? 140 : 40;
      if (name.includes("google")) value += 160;
      if (language === "pt" && name.includes("google") && (name.includes("portugues") || name.includes("portuguese"))) value += 450;
      feminineHints.forEach((hint, index) => {
        if (name.includes(hint)) value += 95 - Math.min(70, index * 2);
      });
      if (masculineHints.test(name)) value -= 220;
      return value;
    };

    return [...voices].sort((a, b) => score(b) - score(a))[0] ?? null;
  }

  chooseFemalePortugueseVoice() {
    return this.chooseVoiceForLanguage("pt");
  }

  humanizeSpeechText(text = "") {
    return text
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\n+/g, ". ")
      .replace(/•/g, "")
      .replace(/\s+/g, " ")
      .replace(/\.\s*\./g, ".")
      .trim();
  }

  buildProsodySegments(text, { rate, pitch } = {}) {
    const clean = this.humanizeSpeechText(text);
    const sentences = clean.match(/[^.!?…。！？]+[.!?…。！？]?/g) ?? [clean];
    const segments = [];

    for (const rawSentence of sentences) {
      const sentence = rawSentence.trim();
      if (!sentence) continue;
      const punctuation = sentence.slice(-1);
      const isPunctuation = /[.!?…。！？]/.test(punctuation);
      const body = isPunctuation ? sentence.slice(0, -1).trim() : sentence;

      if (punctuation === "?" || punctuation === "？") {
        const words = body.split(/\s+/);
        const tailSize = Math.min(3, Math.max(1, words.length));
        const main = words.slice(0, -tailSize).join(" ");
        const tail = words.slice(-tailSize).join(" ");
        if (main) segments.push({ text: main, rate, pitch });
        segments.push({ text: `${tail}?`, rate: Math.max(0.82, rate - 0.06), pitch: Math.min(2, pitch + 0.13) });
        continue;
      }

      if (punctuation === "!" || punctuation === "！") {
        segments.push({ text: `${body}!`, rate: Math.min(2, rate + 0.05), pitch: Math.min(2, pitch + 0.14) });
        continue;
      }

      if (punctuation === "…") {
        segments.push({ text: `${body}...`, rate: Math.max(0.8, rate - 0.09), pitch: Math.max(0.8, pitch - 0.04) });
        continue;
      }

      segments.push({ text: punctuation === "." || punctuation === "。" ? `${body}.` : body, rate, pitch });
    }

    return segments;
  }

  async speak(text, {
    rate = 1.16,
    pitch = 1.34,
    volume = 1,
    mood = "neutral",
    allowBargeIn = true,
    language = "pt"
  } = {}) {
    if (!this.synthesisSupported || !text) return;

    const token = ++this.speechToken;
    const shouldResume = this.alwaysListening;
    this.manualStop = false;
    this.currentSpeechText = this.humanizeSpeechText(text);

    clearTimeout(this.silenceTimer);
    this.pendingTranscript = "";
    this.onInterimTranscript("");

    if (this.listening && this.recognition) {
      try { this.recognition.stop(); } catch {}
    }

    window.speechSynthesis.cancel();
    this.setSpeakingState(true);

    let moodRate = rate;
    let moodPitch = pitch;
    if (mood === "excited") { moodRate += 0.04; moodPitch += 0.08; }
    else if (mood === "serious") { moodRate -= 0.04; moodPitch -= 0.05; }
    else if (mood === "gentle") { moodRate -= 0.03; moodPitch += 0.02; }

    // Japonês costuma soar melhor com menos pitch artificial.
    if (language === "ja") moodPitch = Math.min(moodPitch, 1.18);

    const segments = this.buildProsodySegments(this.currentSpeechText, {
      rate: Math.max(0.7, Math.min(2, moodRate)),
      pitch: Math.max(0.5, Math.min(2, moodPitch))
    });

    if (allowBargeIn && shouldResume) {
      setTimeout(() => {
        if (this.isSpeaking && token === this.speechToken) this.startBargeInRecognition();
      }, 500);
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
      this.scheduleRestart(380);
    }
  }

  speakSegment(segment, { volume, token, language }) {
    return new Promise((resolve) => {
      if (token !== this.speechToken) return resolve();

      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.lang = localeForLanguage(language);
      utterance.rate = segment.rate;
      utterance.pitch = segment.pitch;
      utterance.volume = volume;
      const selected = this.chooseVoiceForLanguage(language);
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

  setSpeakingState(active) {
    if (this.isSpeaking === active) return;
    this.isSpeaking = active;
    this.onSpeakingChange(active);
    this.onStatusChange(active ? "Falando... pode me interromper." : "Sistema pronto.");
  }

  cancelSpeech({ resumeListening = false } = {}) {
    if (!this.synthesisSupported) return;
    ++this.speechToken;
    window.speechSynthesis.cancel();
    this.stopBargeInRecognition();
    this.currentSpeechText = "";
    this.setSpeakingState(false);
    if (resumeListening && this.recognitionSupported) {
      setTimeout(() => this.start({ always: this.alwaysListening }), 120);
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
      recognition.lang = this.getRecognitionLocale();
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;
      recognition.continuous = true;

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          const chosen = pickBestRecognitionAlternative(event.results[i], { animeContext: true });
          if (chosen.text) transcript += `${chosen.text} `;
        }

        transcript = correctSpeechTranscript(transcript.trim(), { animeContext: true });
        if (!transcript) return;

        if (containsWakeWord(transcript)) this.bargeWakeArmedUntil = Date.now() + 6500;
        const heardWake = containsWakeWord(transcript) || Date.now() < this.bargeWakeArmedUntil;
        if (!heardWake) return;

        const spoken = this.normalize(this.currentSpeechText);
        const withoutWake = this.normalize(transcript).replace(/\bjordan\b/g, "").trim();
        if (withoutWake.length > 8 && spoken.includes(withoutWake)) return;

        this.stopBargeInRecognition();
        this.cancelSpeech({ resumeListening: false });
        this.onStatusChange("Interrompida. Processando seu novo comando...");
        Promise.resolve(this.onTranscript(transcript)).catch(() => {});
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
