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

    this.Recognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition ||
      null;

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
    this.currentSpeakResolve = null;
    this.audioContext = null;

    this.synthesisSupported =
      "speechSynthesis" in window &&
      "SpeechSynthesisUtterance" in window;
  }

  get recognitionSupported() {
    return Boolean(this.Recognition);
  }

  configureRecognition() {
    if (!this.recognitionSupported || this.recognition) return;

    const recognition = new this.Recognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

    recognition.onstart = () => {
      this.listening = true;
      this.dispatching = false;
      this.playListenClick();
      this.onListeningChange(true);
      this.onStatusChange(
        this.alwaysListening
          ? 'Escuta ativa. Diga “Jordan” e fale normalmente.'
          : "Estou ouvindo..."
      );
    };

    recognition.onresult = (event) => {
      let transcript = "";

      for (let i = 0; i < event.results.length; i++) {
        const piece = event.results[i]?.[0]?.transcript?.trim();
        if (piece) transcript += `${piece} `;
      }

      transcript = transcript.trim();
      if (!transcript) return;

      // Alguns reconhecedores entendem "Jordan" num resultado provisório e
      // removem a palavra no resultado final. Guardamos uma janela de 8 s para
      // não perder comandos como "Jordan ajuda" que acabam chegando só como
      // "ajuda" na transcrição final.
      if (/\bjordan\b/.test(this.normalize(transcript))) {
        this.wakeArmedUntil = Date.now() + 8000;
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

      if (event.error !== "no-speech" && event.error !== "aborted") {
        this.onStatusChange(messages[event.error] || `Erro de voz: ${event.error}`);
      }
    };

    recognition.onend = () => {
      this.listening = false;
      this.onListeningChange(false);

      if (this.pendingTranscript || this.dispatching || this.isSpeaking) return;

      if (
        this.alwaysListening &&
        !this.manualStop &&
        document.visibilityState === "visible"
      ) {
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

    const hasWakeWord = /\bjordan\b/.test(this.normalize(transcript));
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

      if (
        this.alwaysListening &&
        !this.manualStop &&
        !this.isSpeaking &&
        document.visibilityState === "visible"
      ) {
        this.scheduleRestart(420);
      }
    }
  }

  normalize(text = "") {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  start({ always = false } = {}) {
    if (!this.recognitionSupported) {
      this.onStatusChange("Este navegador não oferece reconhecimento de voz. Use o campo de texto.");
      return false;
    }

    if (this.isSpeaking) {
      this.cancelSpeech({ resumeListening: false });
    }

    this.configureRecognition();
    this.alwaysListening = always;
    this.manualStop = false;

    if (this.listening) return true;

    clearTimeout(this.restartTimer);

    try {
      this.recognition.start();
      return true;
    } catch {
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

    if (enabled) {
      this.start({ always: true });
    } else {
      this.stop({ manual: true });
      this.onStatusChange("Escuta contínua desativada.");
    }
  }

  restartRecognitionSoon() {
    if (this.recognition && this.listening) {
      try { this.recognition.stop(); } catch {}
    }
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
      gain.gain.exponentialRampToValueAtTime(0.025, now + 0.006);
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

  chooseFemalePortugueseVoice() {
    const portuguese = this.getPortugueseVoices();
    if (!portuguese.length) return null;

    if (this.preferredVoiceName) {
      const preferred = portuguese.find((voice) => voice.name === this.preferredVoiceName);
      if (preferred) return preferred;
    }

    const score = (voice) => {
      const name = this.normalize(voice.name);
      const lang = voice.lang?.toLowerCase() || "";
      let value = lang === "pt-br" ? 120 : 30;

      // Base principal solicitada: Google português do Brasil. Quando o
      // navegador expõe essa voz, ela vence a seleção automática.
      if (name.includes("google") && (name.includes("portugues") || name.includes("portuguese"))) value += 500;
      if (name.includes("google") && name.includes("brasil")) value += 180;
      if (name.includes("brasil")) value += 50;

      const feminineHints = [
        "luciana", "francisca", "maria", "helena", "leticia", "camila",
        "fernanda", "vitoria", "female", "feminina", "mulher", "bruna"
      ];

      feminineHints.forEach((hint, index) => {
        if (name.includes(hint)) value += 110 - index * 3;
      });

      if (/male|mascul|felipe|daniel|ricardo|antonio|joao|thiago/.test(name)) value -= 260;
      return value;
    };

    return [...portuguese].sort((a, b) => score(b) - score(a))[0] ?? null;
  }

  humanizeSpeechText(text = "") {
    return text
      .replace(/\n+/g, ". ")
      .replace(/•/g, "")
      .replace(/\s+/g, " ")
      .replace(/\.\s*\./g, ".")
      .trim();
  }

  buildProsodySegments(text, { rate, pitch } = {}) {
    const clean = this.humanizeSpeechText(text);
    const sentences = clean.match(/[^.!?…]+[.!?…]?/g) ?? [clean];
    const segments = [];

    for (const rawSentence of sentences) {
      const sentence = rawSentence.trim();
      if (!sentence) continue;
      const punctuation = sentence.slice(-1);
      const body = /[.!?…]/.test(punctuation) ? sentence.slice(0, -1).trim() : sentence;

      if (punctuation === "?") {
        const words = body.split(/\s+/);
        const tailSize = Math.min(3, Math.max(1, words.length));
        const main = words.slice(0, -tailSize).join(" ");
        const tail = words.slice(-tailSize).join(" ");

        if (main) segments.push({ text: main, rate, pitch });
        segments.push({
          text: `${tail}?`,
          rate: Math.max(0.85, rate - 0.06),
          pitch: Math.min(2, pitch + 0.13)
        });
        continue;
      }

      if (punctuation === "!") {
        segments.push({
          text: `${body}!`,
          rate: Math.min(2, rate + 0.05),
          pitch: Math.min(2, pitch + 0.16)
        });
        continue;
      }

      if (punctuation === "…") {
        segments.push({
          text: `${body}...`,
          rate: Math.max(0.8, rate - 0.10),
          pitch: Math.max(0.8, pitch - 0.04)
        });
        continue;
      }

      segments.push({ text: punctuation === "." ? `${body}.` : body, rate, pitch });
    }

    return segments;
  }

  async speak(text, {
    rate = 1.16,
    pitch = 1.34,
    volume = 1,
    mood = "neutral",
    allowBargeIn = true
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
    if (mood === "excited") {
      moodRate += 0.04;
      moodPitch += 0.08;
    } else if (mood === "serious") {
      moodRate -= 0.04;
      moodPitch -= 0.05;
    } else if (mood === "gentle") {
      moodRate -= 0.03;
      moodPitch += 0.02;
    }

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
      await this.speakSegment(segment, { volume, token });
    }

    if (token !== this.speechToken) return;

    this.stopBargeInRecognition();
    this.setSpeakingState(false);
    this.onStatusChange("Sistema pronto.");
    this.currentSpeechText = "";

    if (shouldResume && this.alwaysListening && document.visibilityState === "visible") {
      this.scheduleRestart(380);
    }
  }

  speakSegment(segment, { volume, token }) {
    return new Promise((resolve) => {
      if (token !== this.speechToken) return resolve();

      const utterance = new SpeechSynthesisUtterance(segment.text);
      utterance.lang = "pt-BR";
      utterance.rate = segment.rate;
      utterance.pitch = segment.pitch;
      utterance.volume = volume;

      const selected = this.chooseFemalePortugueseVoice();
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
    this.onStatusChange(active ? "Falando... toque no microfone para me interromper." : "Sistema pronto.");
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
      recognition.lang = "pt-BR";
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.continuous = true;

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          const piece = event.results[i]?.[0]?.transcript?.trim();
          if (piece) transcript += `${piece} `;
        }

        transcript = transcript.trim();
        if (!transcript) return;

        const normalized = this.normalize(transcript);
        if (/\bjordan\b/.test(normalized)) this.bargeWakeArmedUntil = Date.now() + 6500;

        const heardWake = /\bjordan\b/.test(normalized) || Date.now() < this.bargeWakeArmedUntil;
        if (!heardWake) return;

        const spoken = this.normalize(this.currentSpeechText);
        const withoutWake = normalized.replace(/\bjordan\b/g, "").trim();

        // Evita tratar a própria fala da JORDAN como interrupção quando o alto-
        // falante vaza para o microfone.
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
