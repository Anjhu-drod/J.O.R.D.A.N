import {
  formatDate,
  formatLongDate,
  formatTime,
  humanCountdown,
  humanDuration,
  normalizeText
} from "./utils.js";

export class JordanUI {
  constructor(calendar, memory) {
    this.calendar = calendar;
    this.memory = memory;
    this.currentView = "core";
    this.currentNextEvent = null;
    this.calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    this.selectedCalendarDate = new Date();
    this.creatorMode = false;

    this.elements = {
      clock: document.querySelector("#clock"),
      todayLabel: document.querySelector("#todayLabel"),
      topStatus: document.querySelector("#topStatus"),
      assistantStatus: document.querySelector("#assistantStatus"),
      liveTranscript: document.querySelector("#liveTranscript"),
      orbButton: document.querySelector("#orbButton"),
      conversation: document.querySelector("#conversation"),
      commandForm: document.querySelector("#commandForm"),
      commandInput: document.querySelector("#commandInput"),
      micButton: document.querySelector("#micButton"),
      alwaysListeningToggle: document.querySelector("#alwaysListeningToggle"),
      calendarShortcut: document.querySelector("#calendarShortcut"),
      clearChatButton: document.querySelector("#clearChatButton"),

      nextEventCard: document.querySelector("#nextEventCard"),
      nextEventCountdown: document.querySelector("#nextEventCountdown"),
      todayEvents: document.querySelector("#todayEvents"),
      todayCount: document.querySelector("#todayCount"),
      todayCountCore: document.querySelector("#todayCountCore"),
      agendaEvents: document.querySelector("#agendaEvents"),
      searchInput: document.querySelector("#searchInput"),
      periodFilter: document.querySelector("#periodFilter"),
      newEventButton: document.querySelector("#newEventButton"),
      calendarMonthLabel: document.querySelector("#calendarMonthLabel"),
      calendarYearLabel: document.querySelector("#calendarYearLabel"),
      calendarPrevButton: document.querySelector("#calendarPrevButton"),
      calendarNextButton: document.querySelector("#calendarNextButton"),
      calendarTodayButton: document.querySelector("#calendarTodayButton"),
      monthGrid: document.querySelector("#monthGrid"),
      selectedDateLabel: document.querySelector("#selectedDateLabel"),
      selectedDateEvents: document.querySelector("#selectedDateEvents"),

      memoryList: document.querySelector("#memoryList"),
      memoryCount: document.querySelector("#memoryCount"),
      memoryCounter: document.querySelector("#memoryCounter"),
      memoryRailButton: document.querySelector("#memoryRailButton"),
      lineageMemoryOverview: document.querySelector("#lineageMemoryOverview"),
      refreshLineageMemoryButton: document.querySelector("#refreshLineageMemoryButton"),

      exportButton: document.querySelector("#exportButton"),
      importInput: document.querySelector("#importInput"),
      installButton: document.querySelector("#installButton"),
      notificationButton: document.querySelector("#notificationButton"),
      notificationStatus: document.querySelector("#notificationStatus"),

      dbStatus: document.querySelector("#dbStatus"),
      speechRecognitionStatus: document.querySelector("#speechRecognitionStatus"),
      speechSynthesisStatus: document.querySelector("#speechSynthesisStatus"),
      neuralVoiceStatus: document.querySelector("#neuralVoiceStatus"),
      neuralVoiceToggle: document.querySelector("#neuralVoiceToggle"),
      neuralVoiceEndpoint: document.querySelector("#neuralVoiceEndpoint"),
      saveVoiceEndpointButton: document.querySelector("#saveVoiceEndpointButton"),
      checkVoiceCoreButton: document.querySelector("#checkVoiceCoreButton"),
      testVoiceButton: document.querySelector("#testVoiceButton"),
      personalitySelect: document.querySelector("#personalitySelect"),
      personalityDescription: document.querySelector("#personalityDescription"),
      pwaStatus: document.querySelector("#pwaStatus"),
      offlineSpeechStatus: document.querySelector("#offlineSpeechStatus"),
      offlineSpeechButton: document.querySelector("#offlineSpeechButton"),
      coreLanguageStatus: document.querySelector("#coreLanguageStatus"),
      languageStatus: document.querySelector("#languageStatus"),
      languageModeSelect: document.querySelector("#languageModeSelect"),
      internetStatus: document.querySelector("#internetStatus"),
      internetToggleButton: document.querySelector("#internetToggleButton"),
      locationStatus: document.querySelector("#locationStatus"),
      lexiconStatus: document.querySelector("#lexiconStatus"),
      musicLibraryStatus: document.querySelector("#musicLibraryStatus"),
      musicImportInput: document.querySelector("#musicImportInput"),
      musicClearButton: document.querySelector("#musicClearButton"),
      themeSelect: document.querySelector("#themeSelect"),
      systemCommandList: document.querySelector("#systemCommandList"),

      authGate: document.querySelector("#authGate"),
      authConnectionBadge: document.querySelector("#authConnectionBadge"),
      authStageTitle: document.querySelector("#authStageTitle"),
      familyGateStage: document.querySelector("#familyGateStage"),
      familyGateForm: document.querySelector("#familyGateForm"),
      familyGatePassword: document.querySelector("#familyGatePassword"),
      accountAuthStage: document.querySelector("#accountAuthStage"),
      identitySelectStage: document.querySelector("#identitySelectStage"),
      identityChoiceGrid: document.querySelector("#identityChoiceGrid"),
      identityConfirmation: document.querySelector("#identityConfirmation"),
      identityConfirmButton: document.querySelector("#identityConfirmButton"),
      identityBindProgress: document.querySelector("#identityBindProgress"),
      identityBindProgressBar: document.querySelector("#identityBindProgressBar"),
      identityBindProgressLabel: document.querySelector("#identityBindProgressLabel"),
      authLoginTab: document.querySelector("#authLoginTab"),
      authRegisterTab: document.querySelector("#authRegisterTab"),
      authLoginForm: document.querySelector("#authLoginForm"),
      authRegisterForm: document.querySelector("#authRegisterForm"),
      authLoginEmail: document.querySelector("#authLoginEmail"),
      authLoginPassword: document.querySelector("#authLoginPassword"),
      authRememberLogin: document.querySelector("#authRememberLogin"),
      authForgotPassword: document.querySelector("#authForgotPassword"),
      authRegisterEmail: document.querySelector("#authRegisterEmail"),
      authRegisterPassword: document.querySelector("#authRegisterPassword"),
      authRegisterConfirm: document.querySelector("#authRegisterConfirm"),
      authGoogleButton: document.querySelector("#authGoogleButton"),
      authMessage: document.querySelector("#authMessage"),
      logoutButton: document.querySelector("#logoutButton"),
      syncNowButton: document.querySelector("#syncNowButton"),
      accountAvatar: document.querySelector("#accountAvatar"),
      accountName: document.querySelector("#accountName"),
      accountEmail: document.querySelector("#accountEmail"),
      accountUid: document.querySelector("#accountUid"),
      accountSyncBadge: document.querySelector("#accountSyncBadge"),
      accountProviders: document.querySelector("#accountProviders"),
      linkGoogleAccountButton: document.querySelector("#linkGoogleAccountButton"),
      linkPasswordInput: document.querySelector("#linkPasswordInput"),
      linkPasswordAccountButton: document.querySelector("#linkPasswordAccountButton"),
      cloudSyncStatus: document.querySelector("#cloudSyncStatus"),
      cloudTopChip: document.querySelector("#cloudTopChip"),
      lineageIdentityStatus: document.querySelector("#lineageIdentityStatus"),
      lineageRelationSummary: document.querySelector("#lineageRelationSummary"),
      voiceIdentityStatus: document.querySelector("#voiceIdentityStatus"),
      voiceIdentityToggle: document.querySelector("#voiceIdentityToggle"),
      thirdPartyConversationToggle: document.querySelector("#thirdPartyConversationToggle"),
      enrollVoiceButton: document.querySelector("#enrollVoiceButton"),
      clearVoiceProfileButton: document.querySelector("#clearVoiceProfileButton"),
      internetTelemetryLabel: document.querySelector("#internetTelemetryLabel"),
      memoryTelemetryLabel: document.querySelector("#memoryTelemetryLabel"),
      executionTelemetryLabel: document.querySelector("#executionTelemetryLabel"),
      cinematicLayer: document.querySelector("#jordanCinematicLayer"),
      cinematicKicker: document.querySelector("#cinematicKicker"),
      cinematicTitle: document.querySelector("#cinematicTitle"),
      cinematicSubtitle: document.querySelector("#cinematicSubtitle"),

      toastContainer: document.querySelector("#toastContainer"),

      companionDock: document.querySelector("#companionDock"),
      companionTitle: document.querySelector("#companionTitle"),
      closeCompanionButton: document.querySelector("#closeCompanionButton"),
      mediaArtwork: document.querySelector("#mediaArtwork"),
      mediaTrackTitle: document.querySelector("#mediaTrackTitle"),
      mediaTrackArtist: document.querySelector("#mediaTrackArtist"),
      musicProgress: document.querySelector("#musicProgress"),
      musicCurrentTime: document.querySelector("#musicCurrentTime"),
      musicDuration: document.querySelector("#musicDuration"),
      musicShuffleButton: document.querySelector("#musicShuffleButton"),
      musicPreviousButton: document.querySelector("#musicPreviousButton"),
      musicPlayPauseButton: document.querySelector("#musicPlayPauseButton"),
      musicNextButton: document.querySelector("#musicNextButton"),
      musicRepeatButton: document.querySelector("#musicRepeatButton"),
      musicFavoriteButton: document.querySelector("#musicFavoriteButton"),
      musicVolume: document.querySelector("#musicVolume"),
      musicImportInputCompanion: document.querySelector("#musicImportInputCompanion"),
      musicSearchInput: document.querySelector("#musicSearchInput"),
      musicLibraryList: document.querySelector("#musicLibraryList"),
      researchTitle: document.querySelector("#researchTitle"),
      researchSummary: document.querySelector("#researchSummary"),
      researchSources: document.querySelector("#researchSources"),
      routeTitle: document.querySelector("#routeTitle"),
      routeDistance: document.querySelector("#routeDistance"),
      routeLink: document.querySelector("#routeLink"),
      scienceTitle: document.querySelector("#scienceTitle"),
      scienceAnswer: document.querySelector("#scienceAnswer"),
      scienceFormula: document.querySelector("#scienceFormula"),
      scienceDetails: document.querySelector("#scienceDetails"),

      eventDialog: document.querySelector("#eventDialog"),
      eventDialogTitle: document.querySelector("#eventDialogTitle"),
      eventForm: document.querySelector("#eventForm"),
      eventId: document.querySelector("#eventId"),
      eventTitle: document.querySelector("#eventTitle"),
      eventDate: document.querySelector("#eventDate"),
      eventTime: document.querySelector("#eventTime"),
      eventDuration: document.querySelector("#eventDuration"),
      eventAllDay: document.querySelector("#eventAllDay"),
      eventYearly: document.querySelector("#eventYearly"),
      eventDescription: document.querySelector("#eventDescription"),
      deleteEventButton: document.querySelector("#deleteEventButton"),
      closeDialogButton: document.querySelector("#closeDialogButton"),
      cancelEventButton: document.querySelector("#cancelEventButton"),

      emergencyDialog: document.querySelector("#emergencyDialog"),
      emergencyNumber: document.querySelector("#emergencyNumber"),
      emergencyCallLink: document.querySelector("#emergencyCallLink"),
      closeEmergencyButton: document.querySelector("#closeEmergencyButton"),

      tutorialDialog: document.querySelector("#tutorialDialog"),
      closeTutorialButton: document.querySelector("#closeTutorialButton")
    };
  }


  setAccountProviders(summary = "FIREBASE AUTH", providerIds = []) {
    if (this.elements.accountProviders) this.elements.accountProviders.textContent = summary || "FIREBASE AUTH";
    const ids = new Set(providerIds || []);
    if (this.elements.linkGoogleAccountButton) {
      const linked = ids.has("google.com");
      this.elements.linkGoogleAccountButton.disabled = linked;
      this.elements.linkGoogleAccountButton.textContent = linked ? "GOOGLE VINCULADO ✓" : "VINCULAR GOOGLE";
    }
    if (this.elements.linkPasswordAccountButton) {
      const linked = ids.has("password");
      this.elements.linkPasswordAccountButton.disabled = linked;
      this.elements.linkPasswordAccountButton.textContent = linked ? "SENHA VINCULADA ✓" : "VINCULAR SENHA";
    }
    if (this.elements.linkPasswordInput) {
      this.elements.linkPasswordInput.disabled = ids.has("password");
      if (ids.has("password")) this.elements.linkPasswordInput.value = "";
    }
  }

  setNeuralVoiceStatus(status = {}) {
    const ok = Boolean(status.ok);
    const enabled = status.enabled !== false;
    if (this.elements.neuralVoiceStatus) {
      this.elements.neuralVoiceStatus.classList.toggle("online", ok);
      this.elements.neuralVoiceStatus.classList.toggle("offline", !ok);
      const label = this.elements.neuralVoiceStatus.querySelector("b");
      if (label) {
        if (!enabled) label.textContent = "VOICE CORE DESATIVADO";
        else if (ok) label.textContent = `ONLINE · ${status.voice || "JORDAN SPARK V1"}`;
        else if (status.reason === "timeout") label.textContent = "SEM RESPOSTA · FALLBACK LOCAL";
        else label.textContent = "OFFLINE · FALLBACK DO DISPOSITIVO";
      }
    }
    if (this.elements.speechSynthesisStatus) {
      this.elements.speechSynthesisStatus.textContent = ok ? "JORDAN Spark Neural V1" : "JORDAN Spark · fallback";
    }
  }

  playCinematic(kind = "core", title = "JORDAN", subtitle = "Executando", duration = 760) {
    const layer = this.elements.cinematicLayer;
    if (!layer) return Promise.resolve();
    layer.dataset.kind = kind;
    if (this.elements.cinematicKicker) this.elements.cinematicKicker.textContent = `JORDAN / ${String(kind).toUpperCase()} PROTOCOL`;
    if (this.elements.cinematicTitle) this.elements.cinematicTitle.textContent = title;
    if (this.elements.cinematicSubtitle) this.elements.cinematicSubtitle.textContent = subtitle;
    layer.classList.remove("complete");
    layer.classList.add("active");
    clearTimeout(this._cinematicTimer);
    return new Promise((resolve) => {
      this._cinematicTimer = setTimeout(() => {
        layer.classList.add("complete");
        setTimeout(() => layer.classList.remove("active", "complete"), 260);
        resolve();
      }, duration);
    });
  }

  inferCommandVisual(text = "") {
    const value = normalizeText(text);
    if (/calend|agenda|marqu|evento|anivers|amanha|semana/.test(value)) return "calendar";
    if (/toque|musica|player|faixa|pause|next|track/.test(value)) return "music";
    if (/pesquis|procure|busque|internet|quem e|o que e/.test(value)) return "research";
    if (/rota|caminho|chegar|perto|proximo|direcao|localiza/.test(value)) return "navigation";
    if (/fisica|volts|ohm|resistor|corrente|energia|forca|velocidade|circuit/.test(value)) return "science";
    if (/open |turn |shut |volume|system|audio/.test(value)) return "system";
    return "conversation";
  }

  pulseCommand(text = "", phase = "start") {
    const kind = this.inferCommandVisual(text);
    document.body.dataset.commandFx = kind;
    document.body.classList.remove("command-fx-start", "command-fx-done");
    void document.body.offsetWidth;
    document.body.classList.add(phase === "done" ? "command-fx-done" : "command-fx-start");
    clearTimeout(this._commandFxTimer);
    this._commandFxTimer = setTimeout(() => {
      document.body.classList.remove("command-fx-start", "command-fx-done");
    }, phase === "done" ? 520 : 900);
    return kind;
  }


  showAuthGate(message = "Entre para carregar sua memória JORDAN.") {
    document.body.classList.add("auth-locked");
    this.elements.authGate?.classList.remove("hidden");
    this.setAuthMessage(message);
  }

  hideAuthGate() {
    document.body.classList.remove("auth-locked");
    this.elements.authGate?.classList.add("hidden");
  }

  setAuthStage(stage = "family") {
    document.body.dataset.authStage = stage;
    const map = {
      family: [this.elements.familyGateStage, "FAMILY KEY"],
      account: [this.elements.accountAuthStage, "INDIVIDUAL ACCESS"],
      identity: [this.elements.identitySelectStage, "LINEAGE IDENTITY"]
    };
    for (const [name, [element]] of Object.entries(map)) {
      element?.classList.toggle("hidden", name !== stage);
    }
    if (this.elements.authStageTitle) this.elements.authStageTitle.textContent = map[stage]?.[1] || "JORDAN ID";
  }

  renderIdentityChoices(members = [], selectedId = null) {
    const container = this.elements.identityChoiceGrid;
    if (!container) return;
    container.innerHTML = "";
    for (const member of members) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `identity-choice${member.creator ? " creator" : ""}${selectedId === member.id ? " active" : ""}`;
      button.dataset.identityId = member.id;
      button.innerHTML = `<strong>${member.firstName}</strong><small>Identidade ${member.id.toUpperCase()}</small>`;
      container.appendChild(button);
    }
  }

  setLineageIdentity(identity = null) {
    if (this.elements.lineageIdentityStatus) {
      this.elements.lineageIdentityStatus.textContent = identity
        ? `${identity.firstName} · ${identity.role === "creator" ? "CREATOR" : "MEMBER"}`
        : "Não vinculada";
    }
  }

  setCreatorMode(enabled = false) {
    this.creatorMode = Boolean(enabled);
    document.querySelectorAll("[data-creator-only]").forEach((element) => {
      element.classList.toggle("hidden-by-role", !this.creatorMode);
    });
    if (!this.creatorMode && this.currentView === "memory") this.openView("core");
  }

  setAuthMode(mode = "login") {
    const register = mode === "register";
    this.elements.authLoginTab?.classList.toggle("active", !register);
    this.elements.authRegisterTab?.classList.toggle("active", register);
    this.elements.authLoginForm?.classList.toggle("hidden", register);
    this.elements.authRegisterForm?.classList.toggle("hidden", !register);
    this.setAuthMessage(register ? "Crie sua JORDAN ID para sincronizar todos os dispositivos." : "Entre com e-mail ou Google.");
  }

  setAuthMessage(message = "", type = "") {
    if (!this.elements.authMessage) return;
    this.elements.authMessage.textContent = message;
    this.elements.authMessage.classList.toggle("error", type === "error");
    this.elements.authMessage.classList.toggle("success", type === "success");
  }

  setIdentityBindProgress(message = "", percent = 0, active = false) {
    if (this.elements.identityBindProgress) {
      this.elements.identityBindProgress.classList.toggle("active", Boolean(active));
    }
    if (this.elements.identityBindProgressLabel) {
      this.elements.identityBindProgressLabel.textContent = message || "Preparando vínculo…";
    }
    if (this.elements.identityBindProgressBar) {
      const safe = Math.max(0, Math.min(100, Number(percent) || 0));
      this.elements.identityBindProgressBar.style.width = `${safe}%`;
      this.elements.identityBindProgressBar.parentElement?.setAttribute("aria-valuenow", String(safe));
    }
  }

  setAuthBusy(active = false) {
    this.elements.authGate?.classList.toggle("busy", Boolean(active));
    this.elements.familyGateForm?.querySelectorAll("button,input").forEach((element) => { element.disabled = Boolean(active); });
    if (this.elements.identityConfirmButton) this.elements.identityConfirmButton.disabled = Boolean(active) || !document.querySelector(".identity-choice.active");
    this.elements.authLoginForm?.querySelectorAll("button,input").forEach((element) => {
      if (element.id === "authRememberLogin") return;
      element.disabled = Boolean(active);
    });
    this.elements.authRegisterForm?.querySelectorAll("button,input").forEach((element) => {
      element.disabled = Boolean(active);
    });
    if (this.elements.authGoogleButton) this.elements.authGoogleButton.disabled = Boolean(active);
  }

  setAccountUser(user) {
    if (!user) return;
    const name = user.displayName || user.email?.split("@")[0] || "Usuário JORDAN";
    if (this.elements.accountName) this.elements.accountName.textContent = name;
    if (this.elements.accountEmail) this.elements.accountEmail.textContent = user.email || "Conta Firebase";
    if (this.elements.accountUid) this.elements.accountUid.textContent = `${user.uid.slice(0, 6)}…${user.uid.slice(-4)}`;

    if (this.elements.accountAvatar) {
      this.elements.accountAvatar.textContent = "";
      if (user.photoURL) {
        const image = document.createElement("img");
        image.src = user.photoURL;
        image.alt = `Foto de ${name}`;
        image.referrerPolicy = "no-referrer";
        this.elements.accountAvatar.appendChild(image);
      } else {
        this.elements.accountAvatar.textContent = name.charAt(0).toUpperCase();
      }
    }
  }

  setCloudStatus({ online = navigator.onLine, pending = false, fromCache = false, error = null } = {}) {
    let label = "CLOUD ONLINE";
    let detail = "Firestore sincronizado.";
    let className = "";

    if (error) {
      label = "CLOUD ERROR";
      detail = error.message || "Erro de sincronização.";
      className = "error";
    } else if (!online) {
      label = pending ? "OFFLINE · PENDING" : "OFFLINE MODE";
      detail = pending
        ? "Alterações salvas no cache. Serão enviadas quando a internet voltar."
        : "Usando o cache offline do Firestore.";
      className = "offline";
    } else if (pending) {
      label = "SYNC PENDING";
      detail = "Enviando alterações para o Firebase...";
      className = "pending";
    } else if (fromCache) {
      label = "CACHE READY";
      detail = "Dados carregados do cache; aguardando confirmação da nuvem.";
      className = "pending";
    }

    if (this.elements.accountSyncBadge) this.elements.accountSyncBadge.textContent = label;
    if (this.elements.authConnectionBadge) {
      this.elements.authConnectionBadge.textContent = online ? "FIREBASE ONLINE" : "FIREBASE OFFLINE";
    }
    if (this.elements.cloudSyncStatus) this.elements.cloudSyncStatus.textContent = detail;
    if (this.elements.dbStatus) this.elements.dbStatus.textContent = label;
    if (this.elements.cloudTopChip) {
      this.elements.cloudTopChip.classList.remove("pending", "offline", "error");
      if (className) this.elements.cloudTopChip.classList.add(className);
      const text = this.elements.cloudTopChip.querySelector("b");
      if (text) text.textContent = label.replace("CLOUD ", "");
    }
  }

  startClock() {
    const tick = () => {
      const now = new Date();

      this.elements.clock.textContent = new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      }).format(now);

      this.elements.todayLabel.textContent = formatLongDate(now);
      this.updateNextCountdown();
    };

    tick();
    setInterval(tick, 1000);
  }

  openView(viewName) {
    if (viewName === "memory" && !this.creatorMode) {
      this.toast("A memória continua ativa em segundo plano. A visualização administrativa é exclusiva do criador.", "JORDAN MEMORY");
      viewName = "core";
    }
    const view = document.querySelector(`[data-view="${viewName}"]`);
    if (!view) return;

    const previousView = this.currentView;
    this.currentView = viewName;
    document.body.dataset.previousView = previousView || "core";
    document.body.dataset.currentView = viewName;
    document.body.classList.remove("view-transitioning");
    void document.body.offsetWidth;
    document.body.classList.add("view-transitioning");

    document.querySelectorAll(".view").forEach((item) => {
      const active = item.dataset.view === viewName;
      item.classList.toggle("active", active);
      if (active) {
        item.classList.remove("view-enter");
        void item.offsetWidth;
        item.classList.add("view-enter");
      }
    });
    setTimeout(() => document.body.classList.remove("view-transitioning"), 560);

    document.querySelectorAll("[data-view-target]").forEach((button) => {
      button.classList.toggle(
        "active",
        button.classList.contains("rail-button") &&
        button.dataset.viewTarget === viewName
      );
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  setStatus(text) {
    this.elements.assistantStatus.textContent = text;
    this.elements.topStatus.textContent = text.toUpperCase().slice(0, 34);
  }

  setInterimTranscript(text = "") {
    if (text) {
      this.elements.liveTranscript.textContent = `“${text}”`;
      this.elements.liveTranscript.classList.add("active");
    } else {
      this.elements.liveTranscript.textContent = "Áudio contínuo: fale normalmente. Comandos do sistema são em inglês.";
      this.elements.liveTranscript.classList.remove("active");
    }
  }

  setListening(active) {
    this.elements.orbButton.classList.toggle("listening", active);
    this.elements.micButton.textContent = active ? "■ PARAR" : "🎙 FALAR";
  }

  setSpeaking(active) {
    this.elements.orbButton.classList.toggle("speaking", active);
  }

  addMessage(author, text) {
    const message = document.createElement("div");
    message.className = `message ${author === "JORDAN" ? "jordan" : "user"}`;

    const label = document.createElement("span");
    label.className = "message-author";
    label.textContent = author;

    const body = document.createElement("p");
    body.textContent = text;

    message.append(label, body);
    this.elements.conversation.appendChild(message);
    this.elements.conversation.scrollTop = this.elements.conversation.scrollHeight;
  }

  setLanguageStatus(mode = "pt") {
    const labels = {
      pt: "PT-BR",
      en: "EN-US",
      es: "ES",
      ja: "JA"
    };
    const selected = labels[mode] ?? "PT-BR";
    const text = `${selected} · MANUAL`;

    if (this.elements.languageStatus) this.elements.languageStatus.textContent = text;
    if (this.elements.coreLanguageStatus) this.elements.coreLanguageStatus.textContent = `${selected} · FIXED`;
    if (this.elements.languageModeSelect) this.elements.languageModeSelect.value = mode;
  }

  setInternetStatus({ enabled = true, online = navigator.onLine, tested = null } = {}) {
    if (!this.elements.internetStatus || !this.elements.internetToggleButton) return;

    if (!enabled) {
      this.elements.internetStatus.textContent = "Desativada pelo usuário";
      this.elements.internetToggleButton.textContent = "ATIVAR INTERNET";
      return;
    }

    if (!online) {
      this.elements.internetStatus.textContent = "Sem conexão";
      this.elements.internetToggleButton.textContent = "INTERNET ATIVA";
      return;
    }

    this.elements.internetStatus.textContent = tested === false ? "Online · fonte não respondeu" : "Online · fontes públicas";
    this.elements.internetToggleButton.textContent = "DESATIVAR INTERNET";
  }

  setLexiconStatus(stats) {
    if (!this.elements.lexiconStatus || !stats) return;
    this.elements.lexiconStatus.textContent = `${stats.entries.toLocaleString("pt-BR")} entradas semânticas`;
  }

  addExternalLink(label, url, heading = "AÇÃO") {
    if (!url) return;
    const card = document.createElement("div");
    card.className = "chat-action-card";

    const title = document.createElement("strong");
    title.textContent = heading;

    const link = document.createElement("a");
    link.className = "chat-action-link";
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label || "ABRIR";

    card.append(title, link);
    this.elements.conversation.appendChild(card);
    this.elements.conversation.scrollTop = this.elements.conversation.scrollHeight;
  }

  addSourceLink(title, url, source = "WEB") {
    if (!url) return;
    this.addExternalLink(`ABRIR ${source}`, url, `FONTE · ${title || source}`);
  }

  addLocationLinks(places = []) {
    if (!Array.isArray(places) || !places.length) return;

    const card = document.createElement("div");
    card.className = "chat-action-card";
    const title = document.createElement("strong");
    title.textContent = "LOCAIS · ABRIR NO MAPA";
    card.appendChild(title);

    for (const place of places.slice(0, 4)) {
      const link = document.createElement("a");
      link.className = "chat-action-link";
      link.href = place.mapsUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `${place.name} · ${place.distanceLabel}`;
      card.appendChild(link);
    }

    this.elements.conversation.appendChild(card);
    this.elements.conversation.scrollTop = this.elements.conversation.scrollHeight;
  }

  setTheme(theme = "crimson") {
    const allowed = ["crimson", "eclipse", "sakura", "cursed", "shinobi"];
    const selected = allowed.includes(theme) ? theme : "crimson";
    document.body.dataset.theme = selected;
    if (this.elements.themeSelect) this.elements.themeSelect.value = selected;
  }

  setMusicLibraryStatus(count = 0) {
    if (!this.elements.musicLibraryStatus) return;
    const total = Number(count || 0);
    this.elements.musicLibraryStatus.textContent = `Biblioteca local · ${total} ${total === 1 ? "faixa" : "faixas"}`;
  }

  openCompanion(panel = "media") {
    if (!this.elements.companionDock) return;
    const labels = { media: "MEDIA", research: "RESEARCH", route: "NAVIGATION", science: "PHYSICS LAB" };
    this.elements.companionDock.classList.add("open");
    if (this.elements.companionTitle) this.elements.companionTitle.textContent = labels[panel] || "TOOLS";
    document.querySelectorAll("[data-companion-panel]").forEach((item) => {
      item.classList.toggle("active", item.dataset.companionPanel === panel);
    });
    document.querySelectorAll("[data-companion-target]").forEach((button) => {
      button.classList.toggle("active", button.dataset.companionTarget === panel);
    });
  }

  closeCompanion() {
    this.elements.companionDock?.classList.remove("open");
  }

  renderMediaTrack(track) {
    this.openCompanion("media");

    if (!track) {
      if (this.elements.mediaTrackTitle) this.elements.mediaTrackTitle.textContent = "Nenhuma faixa";
      if (this.elements.mediaTrackArtist) this.elements.mediaTrackArtist.textContent = "Adicione músicas à biblioteca local.";
      if (this.elements.mediaArtwork) this.elements.mediaArtwork.innerHTML = "<span>♫</span>";
      if (this.elements.musicFavoriteButton) this.elements.musicFavoriteButton.textContent = "☆ FAVORITA";
      return;
    }

    if (this.elements.mediaTrackTitle) this.elements.mediaTrackTitle.textContent = track.title || "Faixa";
    if (this.elements.mediaTrackArtist) this.elements.mediaTrackArtist.textContent = [track.artist, track.album].filter(Boolean).join(" · ") || "Biblioteca local";
    if (this.elements.mediaArtwork) {
      this.elements.mediaArtwork.innerHTML = `<span>${track.favorite ? "♥" : "♫"}</span>`;
    }
    if (this.elements.musicFavoriteButton) {
      this.elements.musicFavoriteButton.textContent = track.favorite ? "★ FAVORITA" : "☆ FAVORITA";
      this.elements.musicFavoriteButton.classList.toggle("active", Boolean(track.favorite));
    }
  }

  updateMusicPlaybackState(state = {}) {
    if (this.elements.musicPlayPauseButton) {
      this.elements.musicPlayPauseButton.textContent = state.playing ? "❚❚" : "▶";
      this.elements.musicPlayPauseButton.classList.toggle("playing", Boolean(state.playing));
    }
    if (this.elements.musicShuffleButton) {
      this.elements.musicShuffleButton.classList.toggle("active", Boolean(state.shuffle));
      this.elements.musicShuffleButton.title = state.shuffle ? "Shuffle ligado" : "Shuffle desligado";
    }
    if (this.elements.musicRepeatButton) {
      const labels = { off: "↻", all: "↻ ALL", one: "↻ 1" };
      this.elements.musicRepeatButton.textContent = labels[state.repeatMode] || "↻";
      this.elements.musicRepeatButton.classList.toggle("active", state.repeatMode !== "off");
    }
    if (this.elements.musicVolume && Number.isFinite(state.volume)) {
      this.elements.musicVolume.value = String(state.volume);
    }
  }

  updateMusicTime(time = {}) {
    if (this.elements.musicProgress) this.elements.musicProgress.value = String(Number(time.percent || 0));
    if (this.elements.musicCurrentTime) this.elements.musicCurrentTime.textContent = time.currentLabel || "0:00";
    if (this.elements.musicDuration) this.elements.musicDuration.textContent = time.durationLabel || "0:00";
  }

  renderMusicLibrary(tracks = [], currentTrackId = null) {
    this.setMusicLibraryStatus(tracks.length);
    if (!this.elements.musicLibraryList) return;

    const query = normalizeText(this.elements.musicSearchInput?.value || "");
    const filtered = tracks.filter((track) => {
      if (!query) return true;
      return normalizeText(`${track.title} ${track.artist}`).includes(query);
    });

    if (!filtered.length) {
      this.elements.musicLibraryList.innerHTML = `<div class="music-empty-state">${tracks.length ? "Nenhuma faixa combina com a busca." : "Nenhuma música importada."}</div>`;
      return;
    }

    this.elements.musicLibraryList.innerHTML = "";
    for (const track of filtered) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "music-library-item";
      item.dataset.trackId = track.id;
      item.classList.toggle("active", track.id === currentTrackId);

      const icon = document.createElement("span");
      icon.className = "music-library-icon";
      icon.textContent = track.id === currentTrackId ? "▶" : (track.favorite ? "★" : "♫");

      const body = document.createElement("span");
      body.className = "music-library-copy";
      const title = document.createElement("strong");
      title.textContent = track.title || "Faixa";
      const artist = document.createElement("small");
      artist.textContent = track.artist || "Biblioteca local";
      body.append(title, artist);

      item.append(icon, body);
      this.elements.musicLibraryList.appendChild(item);
    }
  }

  renderResearch(research) {
    if (!research) return;
    this.openCompanion("research");
    if (this.elements.researchTitle) this.elements.researchTitle.textContent = research.query || "Pesquisa";
    if (this.elements.researchSummary) this.elements.researchSummary.textContent = research.summary || "Sem resumo direto.";
    if (this.elements.researchSources) {
      this.elements.researchSources.innerHTML = "";
      for (const source of research.sources || []) {
        const link = document.createElement("a");
        link.className = "chat-action-link";
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `${source.source || "WEB"} · ${source.title}`;
        this.elements.researchSources.appendChild(link);
      }
      if (research.searchUrl) {
        const link = document.createElement("a");
        link.className = "chat-action-link secondary-link";
        link.href = research.searchUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "PESQUISAR NA WEB";
        this.elements.researchSources.appendChild(link);
      }
    }
  }

  renderRoute(route) {
    if (!route) return;
    this.openCompanion("route");
    if (this.elements.routeTitle) this.elements.routeTitle.textContent = route.destinationName || route.destinationQuery || "Destino";
    if (this.elements.routeDistance) {
      this.elements.routeDistance.textContent = route.straightDistanceMeters
        ? `Distância em linha reta: ${route.straightDistanceLabel}. Toque abaixo para abrir navegação curva-a-curva.`
        : "Rota preparada. O mapa calculará distância e trânsito.";
    }
    if (this.elements.routeLink) {
      this.elements.routeLink.href = route.mapsUrl || "#";
      this.elements.routeLink.classList.toggle("hidden", !route.mapsUrl);
    }
  }

  renderScience(science) {
    if (!science) return;
    this.openCompanion("science");
    if (this.elements.scienceTitle) this.elements.scienceTitle.textContent = science.title || "Physics Lab";
    if (this.elements.scienceAnswer) this.elements.scienceAnswer.textContent = science.answer || "";
    if (this.elements.scienceFormula) this.elements.scienceFormula.textContent = science.formula || "";
    if (this.elements.scienceDetails) {
      this.elements.scienceDetails.innerHTML = "";
      for (const detail of science.details || []) {
        const item = document.createElement("div");
        item.textContent = detail;
        this.elements.scienceDetails.appendChild(item);
      }
    }
  }

  clearChat() {
    this.elements.conversation.innerHTML = "";
    this.addMessage("JORDAN", "Tela de conversa limpa. Minha memória e agenda continuam intactas.");
  }

  toast(message, title = "JORDAN", duration = 6500) {
    const toast = document.createElement("div");
    toast.className = "toast";

    const heading = document.createElement("strong");
    heading.textContent = title;

    const body = document.createElement("p");
    body.textContent = message;

    toast.append(heading, body);
    this.elements.toastContainer.appendChild(toast);

    setTimeout(() => toast.remove(), duration);
  }

  async refreshAll() {
    await Promise.all([
      this.renderToday(),
      this.renderNext(),
      this.renderAgenda(),
      this.renderMonthGrid(),
      this.renderSelectedDay(),
      this.renderMemory()
    ]);
  }

  async renderToday() {
    const events = await this.calendar.today();
    this.elements.todayCount.textContent = String(events.length);
    this.elements.todayCountCore.textContent = `${events.length} TODAY`;

    if (!events.length) {
      this.elements.todayEvents.innerHTML =
        '<div class="empty-state">Sem compromissos hoje.</div>';
      return;
    }

    this.elements.todayEvents.innerHTML = "";
    for (const event of events) {
      this.elements.todayEvents.appendChild(this.createEventItem(event, true));
    }
  }

  async renderNext() {
    const event = await this.calendar.next();
    this.currentNextEvent = event;

    if (!event) {
      this.elements.nextEventCard.className = "next-event-card empty-state";
      this.elements.nextEventCard.textContent = "Nenhum compromisso futuro.";
      this.elements.nextEventCountdown.textContent = "—";
      return;
    }

    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    const duration = Math.round((end - start) / 60000);

    this.elements.nextEventCard.className = "next-event-card";
    this.elements.nextEventCard.innerHTML = `
      <div class="event-title"></div>
      <div class="event-meta"></div>
    `;

    this.elements.nextEventCard.querySelector(".event-title").textContent = event.title;
    this.elements.nextEventCard.querySelector(".event-meta").textContent = event.allDay
      ? `${formatLongDate(start)} · DIA INTEIRO${event.recurrence?.frequency === "yearly" ? " · ANUAL" : ""}`
      : `${formatLongDate(start)} · ${formatTime(start)} · ${humanDuration(duration)}`;

    this.updateNextCountdown();
  }

  updateNextCountdown() {
    if (!this.currentNextEvent) return;

    const start = new Date(this.currentNextEvent.startAt);
    this.elements.nextEventCountdown.textContent = humanCountdown(start).toUpperCase();
  }

  moveCalendarMonth(offset = 0) {
    this.calendarCursor = new Date(this.calendarCursor.getFullYear(), this.calendarCursor.getMonth() + offset, 1);
    return this.renderMonthGrid();
  }

  goCalendarToday() {
    const today = new Date();
    this.calendarCursor = new Date(today.getFullYear(), today.getMonth(), 1);
    this.selectedCalendarDate = today;
    return Promise.all([this.renderMonthGrid(), this.renderSelectedDay()]);
  }

  async renderMonthGrid() {
    const container = this.elements.monthGrid;
    if (!container) return;

    const year = this.calendarCursor.getFullYear();
    const month = this.calendarCursor.getMonth();
    const monthStart = new Date(year, month, 1);
    const nextMonth = new Date(year, month + 1, 1);
    const mondayOffset = (monthStart.getDay() + 6) % 7;
    const gridStart = new Date(year, month, 1 - mondayOffset);
    const gridEnd = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + 42);
    const events = await this.calendar.between(gridStart, gridEnd);
    const grouped = new Map();

    for (const event of events) {
      const d = new Date(event.startAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(event);
    }

    if (this.elements.calendarMonthLabel) {
      this.elements.calendarMonthLabel.textContent = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(monthStart);
    }
    if (this.elements.calendarYearLabel) this.elements.calendarYearLabel.textContent = String(year);

    const today = new Date();
    container.innerHTML = "";
    const weekdayMini = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

    for (let index = 0; index < 42; index++) {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const dayEvents = grouped.get(key) || [];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "month-day";
      if (date.getMonth() !== month) button.classList.add("other-month");
      if (date.toDateString() === today.toDateString()) button.classList.add("today");
      if (date.toDateString() === this.selectedCalendarDate.toDateString()) button.classList.add("selected");
      button.innerHTML = `<span class="day-number">${date.getDate()}</span><span class="day-week-mini">${weekdayMini[date.getDay()]}</span>`;

      if (dayEvents.length) {
        const dots = document.createElement("div");
        dots.className = "month-event-dots";
        dayEvents.slice(0, 5).forEach((event) => {
          const dot = document.createElement("i");
          if (event.category === "birthday" || event.system) dot.classList.add("birthday");
          dots.appendChild(dot);
        });
        button.appendChild(dots);
        const title = document.createElement("span");
        title.className = "day-event-title";
        title.textContent = dayEvents[0].title + (dayEvents.length > 1 ? ` +${dayEvents.length - 1}` : "");
        button.appendChild(title);
      }

      button.addEventListener("click", async () => {
        this.selectedCalendarDate = date;
        if (date.getMonth() !== this.calendarCursor.getMonth()) {
          this.calendarCursor = new Date(date.getFullYear(), date.getMonth(), 1);
        }
        await Promise.all([this.renderMonthGrid(), this.renderSelectedDay()]);
      });
      container.appendChild(button);
    }
  }

  async renderSelectedDay() {
    const container = this.elements.selectedDateEvents;
    if (!container) return;
    const date = this.selectedCalendarDate || new Date();
    if (this.elements.selectedDateLabel) {
      this.elements.selectedDateLabel.textContent = new Intl.DateTimeFormat("pt-BR", {
        weekday: "long", day: "numeric", month: "long", year: "numeric"
      }).format(date);
    }
    const events = await this.calendar.forDay(date);
    container.innerHTML = "";
    if (!events.length) {
      container.innerHTML = '<div class="empty-state">Sem eventos neste dia.</div>';
      return;
    }
    events.forEach((event) => container.appendChild(this.createEventItem(event, true)));
  }

  async renderAgenda() {
    const filter = this.elements.periodFilter?.value ?? "upcoming";
    const query = normalizeText(this.elements.searchInput?.value ?? "");
    let events;

    if (filter === "today") {
      events = await this.calendar.today();
    } else if (filter === "week") {
      events = await this.calendar.nextDays(7);
    } else if (filter === "all") {
      events = await this.calendar.all();
    } else {
      events = await this.calendar.upcoming(100);
    }

    if (query) {
      events = events.filter((event) =>
        normalizeText(event.title).includes(query) ||
        normalizeText(event.description || "").includes(query)
      );
    }

    if (!events.length) {
      this.elements.agendaEvents.innerHTML =
        '<div class="empty-state">Nenhum compromisso encontrado.</div>';
      return;
    }

    this.elements.agendaEvents.innerHTML = "";
    for (const event of events) {
      this.elements.agendaEvents.appendChild(this.createEventItem(event));
    }
  }

  createEventItem(event, compact = false) {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);

    const item = document.createElement("article");
    item.className = `event-item${event.allDay ? " all-day" : ""}${event.system ? " system-event" : ""}`;
    item.dataset.eventId = event.id;

    const time = document.createElement("div");
    time.className = "event-time";
    time.textContent = event.allDay ? "DIA TODO" : formatTime(start);

    const body = document.createElement("div");

    const title = document.createElement("div");
    title.className = "event-title";
    title.textContent = event.title;
    if (event.recurrence?.frequency === "yearly" || event.system) {
      const badge = document.createElement("span");
      badge.className = "event-badge";
      badge.textContent = event.system ? "LINHAGEM · ANUAL" : "ANUAL";
      title.appendChild(badge);
    }

    const meta = document.createElement("div");
    meta.className = "event-meta";
    meta.textContent = event.allDay
      ? (compact ? "Evento de dia inteiro" : `${formatDate(start)} · DIA INTEIRO · ${event.category || "default"}`)
      : (compact ? `até ${formatTime(end)}` : `${formatDate(start)} · ${formatTime(start)}–${formatTime(end)} · ${event.category || "default"}`);

    body.append(title, meta);

    const edit = document.createElement("button");
    edit.className = "event-edit";
    edit.type = "button";
    edit.textContent = event.locked ? "FIXO" : "EDITAR";
    if (event.locked) {
      edit.disabled = true;
      edit.classList.add("locked");
    } else {
      edit.addEventListener("click", () => this.openEventDialog(event));
    }

    item.append(time, body, edit);
    return item;
  }

  async renderMemory() {
    const memories = await this.memory.all();
    const count = memories.length;

    if (this.elements.memoryCount) this.elements.memoryCount.textContent = String(count);
    if (this.elements.memoryCounter) {
      this.elements.memoryCounter.textContent = this.creatorMode
        ? `${count} ${count === 1 ? "ENTRY" : "ENTRIES"}`
        : "MEMORY · ACTIVE";
    }

    if (!this.creatorMode) return;

    if (!count) {
      this.elements.memoryList.innerHTML =
        '<div class="empty-state">A memória ainda está vazia. Ensine algo para JORDAN.</div>';
      return;
    }

    this.elements.memoryList.innerHTML = "";

    for (const memory of memories) {
      const item = document.createElement("article");
      item.className = `memory-item${memory.protected ? " protected" : ""}`;

      const body = document.createElement("div");

      const label = document.createElement("span");
      label.className = "memory-item-label";
      label.textContent = memory.label;

      const value = document.createElement("div");
      value.className = "memory-item-value";
      value.textContent = memory.value;

      const type = document.createElement("div");
      type.className = "memory-item-type";
      type.textContent = memory.protected
        ? "CORE · PROTEGIDA"
        : memory.type === "preference"
          ? "PREFERÊNCIA"
          : memory.type === "story"
            ? "HISTÓRIA"
            : "FATO";

      body.append(label, value, type);

      if (memory.protected) {
        const lock = document.createElement("span");
        lock.className = "memory-lock";
        lock.textContent = "🔒";
        lock.title = "Memória central protegida";
        item.append(body, lock);
      } else {
        const remove = document.createElement("button");
        remove.className = "memory-delete";
        remove.type = "button";
        remove.textContent = "×";
        remove.title = "Esquecer";
        remove.addEventListener("click", async () => {
          const confirmed = window.confirm(`Fazer JORDAN esquecer “${memory.label}”?`);
          if (!confirmed) return;

          const removed = await this.memory.forget(memory.id);
          await this.renderMemory();
          this.toast(removed ? `Esqueci “${memory.label}”.` : "Essa memória é protegida pelo núcleo.");
        });

        item.append(body, remove);
      }

      this.elements.memoryList.appendChild(item);
    }
  }

  renderLineageMemoryOverview(groups = []) {
    const container = this.elements.lineageMemoryOverview;
    if (!container) return;
    container.innerHTML = "";
    if (!groups.length) {
      container.innerHTML = '<div class="empty-state">Nenhuma identidade vinculada ou sem conexão para carregar.</div>';
      return;
    }
    for (const group of groups) {
      const card = document.createElement("article");
      card.className = "lineage-memory-person";
      const memories = group.memories || [];
      card.innerHTML = `<strong>${group.identity.firstName}</strong><small>${memories.length} memória${memories.length === 1 ? "" : "s"}</small>`;
      const preview = document.createElement("div");
      preview.className = "memory-preview";
      memories.forEach((memory) => {
        const line = document.createElement("span");
        line.textContent = `${memory.label || memory.key}: ${String(memory.value ?? "")}`;
        preview.appendChild(line);
      });
      if (!memories.length) preview.innerHTML = '<span>Sem memórias visíveis.</span>';
      card.appendChild(preview);
      container.appendChild(card);
    }
  }

  updateTelemetry(data = {}) {
    const root = document.documentElement;
    const online = Boolean(data.online);
    document.body.classList.toggle("telemetry-offline", !online);
    document.body.classList.toggle("telemetry-user-speaking", data.execution === "user-speaking");
    document.body.classList.toggle("telemetry-jordan-speaking", data.execution === "jordan-speaking");

    const downlink = Math.max(0, Number(data.downlinkMbps || 0));
    const netSpeed = online ? Math.max(1.2, 11 - Math.min(9.5, downlink)) : 28;
    const free = Math.max(0.02, Math.min(1, Number(data.storageFreeRatio ?? 1)));
    const memSpeed = Math.max(2, 18 - free * 15);
    const execSpeed = data.execution === "jordan-speaking" ? 1.1 : data.execution === "user-speaking" ? 1.8 : 15;
    root.style.setProperty("--jordan-net-speed", `${netSpeed.toFixed(2)}s`);
    root.style.setProperty("--jordan-memory-speed", `${memSpeed.toFixed(2)}s`);
    root.style.setProperty("--jordan-exec-speed", `${execSpeed.toFixed(2)}s`);
    root.style.setProperty("--jordan-net-glow", online ? String(Math.max(.45, Math.min(1, .45 + downlink / 20))) : ".32");
    root.style.setProperty("--jordan-memory-glow", String(Math.max(.25, free)));

    if (this.elements.internetTelemetryLabel) {
      this.elements.internetTelemetryLabel.textContent = online
        ? `NET · ${downlink.toFixed(1)} Mbps${data.latencyMs ? ` · ${data.latencyMs}ms` : ""}`
        : "NET · OFFLINE";
    }
    if (this.elements.memoryTelemetryLabel) {
      this.elements.memoryTelemetryLabel.textContent = `CACHE · ${Math.round(free * 100)}% LIVRE`;
    }
    if (this.elements.executionTelemetryLabel) {
      const labels = { idle: "IDLE", "user-speaking": "USER VOICE", "jordan-speaking": "JORDAN VOICE", processing: "PROCESSING" };
      this.elements.executionTelemetryLabel.textContent = `EXEC · ${labels[data.execution] || String(data.execution || "IDLE").toUpperCase()}`;
    }
  }

  setNotificationStatus(permission) {
    const map = {
      granted: "Ativos neste navegador",
      denied: "Bloqueados pelo navegador",
      default: "Aguardando permissão",
      unsupported: "Não suportado"
    };

    this.elements.notificationStatus.textContent = map[permission] ?? permission;
    this.elements.notificationButton.textContent =
      permission === "granted" ? "ALERTAS ATIVOS" : "ATIVAR ALERTAS";
  }

  openEmergencyPanel(number = "190") {
    const safeNumber = String(number || "190").replace(/[^\d+]/g, "") || "190";
    this.elements.emergencyNumber.textContent = safeNumber;
    this.elements.emergencyCallLink.href = `tel:${safeNumber}`;
    this.elements.emergencyCallLink.textContent = `LIGAR PARA ${safeNumber}`;

    if (!this.elements.emergencyDialog.open) {
      this.elements.emergencyDialog.showModal();
    }
  }

  closeEmergencyPanel() {
    if (this.elements.emergencyDialog.open) this.elements.emergencyDialog.close();
  }

  openTutorialPanel() {
    if (!this.elements.tutorialDialog.open) {
      this.elements.tutorialDialog.showModal();
    }
  }

  closeTutorialPanel() {
    if (this.elements.tutorialDialog.open) this.elements.tutorialDialog.close();
  }

  setPersonality(profile) {
    if (!profile) return;
    if (this.elements.personalitySelect) this.elements.personalitySelect.value = profile.id;
    if (this.elements.personalityDescription) this.elements.personalityDescription.textContent = profile.description;
  }

  openEventDialog(event = null) {
    if (event) {
      const start = new Date(event.startAt);
      const end = new Date(event.endAt);
      const duration = Math.max(15, Math.round((end - start) / 60000));

      this.elements.eventDialogTitle.textContent = "Editar compromisso";
      this.elements.eventId.value = event.id;
      this.elements.eventTitle.value = event.title;
      this.elements.eventDate.value = this.localDateValue(start);
      this.elements.eventTime.value = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
      this.elements.eventDescription.value = event.description || "";
      if (this.elements.eventAllDay) this.elements.eventAllDay.checked = Boolean(event.allDay);
      if (this.elements.eventYearly) this.elements.eventYearly.checked = event.recurrence?.frequency === "yearly";
      this.syncEventModeFields();

      const options = [...this.elements.eventDuration.options];
      const closest = options.reduce((best, option) => {
        return Math.abs(Number(option.value) - duration) <
          Math.abs(Number(best.value) - duration)
          ? option
          : best;
      });

      this.elements.eventDuration.value = closest.value;
      this.elements.deleteEventButton.classList.remove("hidden");
    } else {
      const start = new Date(Date.now() + 3600000);
      start.setMinutes(0, 0, 0);

      this.elements.eventDialogTitle.textContent = "Novo compromisso";
      this.elements.eventId.value = "";
      this.elements.eventTitle.value = "";
      this.elements.eventDate.value = this.localDateValue(start);
      this.elements.eventTime.value = `${String(start.getHours()).padStart(2, "0")}:00`;
      this.elements.eventDuration.value = "60";
      this.elements.eventDescription.value = "";
      if (this.elements.eventAllDay) this.elements.eventAllDay.checked = false;
      if (this.elements.eventYearly) this.elements.eventYearly.checked = false;
      this.syncEventModeFields();
      this.elements.deleteEventButton.classList.add("hidden");
    }

    this.elements.eventDialog.showModal();
    setTimeout(() => this.elements.eventTitle.focus(), 30);
  }

  syncEventModeFields() {
    const allDay = Boolean(this.elements.eventAllDay?.checked);
    if (this.elements.eventTime) {
      this.elements.eventTime.disabled = allDay;
      this.elements.eventTime.required = !allDay;
    }
    if (this.elements.eventDuration) this.elements.eventDuration.disabled = allDay;
  }

  closeEventDialog() {
    this.elements.eventDialog.close();
  }

  localDateValue(date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
}
