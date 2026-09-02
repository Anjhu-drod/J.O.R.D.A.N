export class VoiceService {
  constructor({
    onTranscript,
    onInterimTranscript,
    onStatusChange,
    onListeningChange,
    onSpeakingChange,
    silenceMs = 3000
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
    this.listening = false;
    this.alwaysListening = false;
    this.manualStop = false;
    this.isSpeaking = false;
    this.restartTimer = null;
    this.silenceTimer = null;
    this.pendingTranscript = "";
    this.lastDisplayedTranscript = "";
    this.dispatching = false;

    this.preferredVoiceName = null;

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
      this.onListeningChange(true);
      this.onStatusChange(
        this.alwaysListening
          ? 'Escuta ativa. Diga “Jordan” e fale normalmente.'
          : "Estou ouvindo..."
      );
    };

    recognition.onresult = (event) => {
      let transcript = "";

      // Cada sessão representa um comando. Reconstituímos a frase completa
      // a partir dos resultados atuais para evitar palavras duplicadas quando
      // um trecho provisório vira resultado final.
      for (let i = 0; i < event.results.length; i++) {
        const piece = event.results[i]?.[0]?.transcript?.trim();
        if (piece) transcript += `${piece} `;
      }

      transcript = transcript.trim();
      if (!transcript) return;

      this.pendingTranscript = transcript;
      this.lastDisplayedTranscript = transcript;
      this.onInterimTranscript(transcript);
      this.onStatusChange(`Ouvindo: “${transcript}”`);
      this.resetSilenceTimer();
    };

    recognition.onspeechend = () => {
      // Não enviamos imediatamente. A frase só é despachada após 3 s sem
      // novos resultados, deixando uma pequena margem para pausas naturais.
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

      // no-speech é normal em modo contínuo; não tratamos como falha grave.
      if (event.error !== "no-speech") {
        this.onStatusChange(
          messages[event.error] || `Erro de voz: ${event.error}`
        );
      }
    };

    recognition.onend = () => {
      this.listening = false;
      this.onListeningChange(false);

      if (this.pendingTranscript || this.dispatching || this.isSpeaking) {
        return;
      }

      if (
        this.alwaysListening &&
        !this.manualStop &&
        document.visibilityState === "visible"
      ) {
        this.scheduleRestart(500);
      } else if (!this.isSpeaking) {
        this.onStatusChange("Sistema pronto.");
      }
    };

    this.recognition = recognition;
  }

  resetSilenceTimer() {
    clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => {
      this.commitPendingTranscript();
    }, this.silenceMs);
  }

  async commitPendingTranscript() {
    if (!this.pendingTranscript || this.dispatching) return;

    const transcript = this.pendingTranscript.trim();
    this.pendingTranscript = "";
    this.lastDisplayedTranscript = "";
    clearTimeout(this.silenceTimer);
    this.silenceTimer = null;

    if (this.alwaysListening && !/\bjordan\b/.test(this.normalize(transcript))) {
      this.onInterimTranscript("");
      this.onStatusChange('Não detectei “Jordan”. Continuo ouvindo.');
      this.restartRecognitionSoon();
      return;
    }

    this.dispatching = true;
    this.onInterimTranscript("");
    this.onStatusChange("Processando...");

    if (this.recognition && this.listening) {
      try {
        this.recognition.stop();
      } catch {}
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
        this.scheduleRestart(600);
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
      this.onStatusChange(
        "Este navegador não oferece reconhecimento de voz. Use o campo de texto."
      );
      return false;
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
      this.scheduleRestart(600);
      return false;
    }
  }

  stop({ manual = true, clearPending = true } = {}) {
    this.manualStop = manual;

    if (manual) {
      this.alwaysListening = false;
    }

    clearTimeout(this.restartTimer);
    clearTimeout(this.silenceTimer);

    if (clearPending) {
      this.pendingTranscript = "";
      this.onInterimTranscript("");
    }

    if (this.recognition && this.listening) {
      try {
        this.recognition.stop();
      } catch {}
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
      try {
        this.recognition.stop();
      } catch {}
    }

    this.scheduleRestart(450);
  }

  scheduleRestart(delay = 500) {
    clearTimeout(this.restartTimer);

    if (!this.alwaysListening || this.manualStop || this.isSpeaking) return;

    this.restartTimer = setTimeout(() => {
      if (!this.listening && document.visibilityState === "visible") {
        this.start({ always: true });
      }
    }, delay);
  }

  setPreferredVoiceName(name) {
    this.preferredVoiceName = name || null;
  }

  getVoices() {
    if (!this.synthesisSupported) return [];
    return window.speechSynthesis.getVoices();
  }

  getPortugueseVoices() {
    return this.getVoices().filter((voice) =>
      voice.lang?.toLowerCase().startsWith("pt")
    );
  }

  chooseFemalePortugueseVoice() {
    const portuguese = this.getPortugueseVoices();

    if (!portuguese.length) return null;

    if (this.preferredVoiceName) {
      const preferred = portuguese.find((voice) => voice.name === this.preferredVoiceName);
      if (preferred) return preferred;
    }

    const preferredNames = [
      "luciana",
      "francisca",
      "maria",
      "helena",
      "leticia",
      "camila",
      "fernanda",
      "female",
      "mulher",
      "brasil"
    ];

    const score = (voice) => {
      const name = voice.name.toLowerCase();
      const lang = voice.lang.toLowerCase();
      let value = lang === "pt-br" ? 30 : 10;

      preferredNames.forEach((preferred, index) => {
        if (name.includes(preferred)) value += 100 - index * 5;
      });

      if (/male|mascul|felipe|daniel|ricardo|antonio|joao/.test(name)) {
        value -= 100;
      }

      if (voice.localService) value += 5;
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

  speak(text, {
    rate = 1.02,
    pitch = 1.12,
    volume = 1
  } = {}) {
    if (!this.synthesisSupported || !text) return Promise.resolve();

    return new Promise((resolve) => {
      const shouldResume = this.alwaysListening;
      this.manualStop = false;

      clearTimeout(this.silenceTimer);
      this.pendingTranscript = "";
      this.onInterimTranscript("");

      if (this.listening && this.recognition) {
        try {
          this.recognition.stop();
        } catch {}
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(
        this.humanizeSpeechText(text)
      );

      utterance.lang = "pt-BR";
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      const voice = this.chooseFemalePortugueseVoice();
      if (voice) utterance.voice = voice;

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.onSpeakingChange(true);
        this.onStatusChange("Falando...");
      };

      const finish = () => {
        this.isSpeaking = false;
        this.onSpeakingChange(false);
        this.onStatusChange("Sistema pronto.");
        resolve();

        if (
          shouldResume &&
          this.alwaysListening &&
          document.visibilityState === "visible"
        ) {
          this.scheduleRestart(650);
        }
      };

      utterance.onend = finish;
      utterance.onerror = finish;

      // Algumas plataformas carregam as vozes de forma assíncrona; usar a
      // voz escolhida agora é o melhor fallback local sem depender de API.
      window.speechSynthesis.speak(utterance);
    });
  }
}
