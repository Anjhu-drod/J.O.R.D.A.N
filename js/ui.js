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

      memoryList: document.querySelector("#memoryList"),
      memoryCount: document.querySelector("#memoryCount"),
      memoryCounter: document.querySelector("#memoryCounter"),

      exportButton: document.querySelector("#exportButton"),
      importInput: document.querySelector("#importInput"),
      installButton: document.querySelector("#installButton"),
      notificationButton: document.querySelector("#notificationButton"),
      notificationStatus: document.querySelector("#notificationStatus"),

      dbStatus: document.querySelector("#dbStatus"),
      speechRecognitionStatus: document.querySelector("#speechRecognitionStatus"),
      speechSynthesisStatus: document.querySelector("#speechSynthesisStatus"),
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
      mediaProviderSelect: document.querySelector("#mediaProviderSelect"),
      spotifyStatus: document.querySelector("#spotifyStatus"),
      spotifyClientIdInput: document.querySelector("#spotifyClientIdInput"),
      spotifySaveButton: document.querySelector("#spotifySaveButton"),
      spotifyConnectButton: document.querySelector("#spotifyConnectButton"),
      themeSelect: document.querySelector("#themeSelect"),
      systemCommandList: document.querySelector("#systemCommandList"),
      toastContainer: document.querySelector("#toastContainer"),

      companionDock: document.querySelector("#companionDock"),
      companionTitle: document.querySelector("#companionTitle"),
      closeCompanionButton: document.querySelector("#closeCompanionButton"),
      mediaArtwork: document.querySelector("#mediaArtwork"),
      mediaTrackTitle: document.querySelector("#mediaTrackTitle"),
      mediaTrackArtist: document.querySelector("#mediaTrackArtist"),
      spotifyEmbedContainer: document.querySelector("#spotifyEmbedContainer"),
      mediaExternalLink: document.querySelector("#mediaExternalLink"),
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
    const view = document.querySelector(`[data-view="${viewName}"]`);
    if (!view) return;

    this.currentView = viewName;

    document.querySelectorAll(".view").forEach((item) => {
      item.classList.toggle("active", item.dataset.view === viewName);
    });

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

  setSpotifyStatus({ configured = false, connected = false } = {}) {
    if (!this.elements.spotifyStatus) return;
    if (!configured) {
      this.elements.spotifyStatus.textContent = "Spotify não configurado";
      if (this.elements.spotifyConnectButton) this.elements.spotifyConnectButton.textContent = "CONECTAR SPOTIFY";
      return;
    }
    this.elements.spotifyStatus.textContent = connected ? "Spotify conectado" : "Client ID salvo · login pendente";
    if (this.elements.spotifyConnectButton) this.elements.spotifyConnectButton.textContent = connected ? "RECONECTAR SPOTIFY" : "CONECTAR SPOTIFY";
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
    if (!track) return;
    this.openCompanion("media");
    if (this.elements.mediaTrackTitle) this.elements.mediaTrackTitle.textContent = track.name || "Faixa";
    if (this.elements.mediaTrackArtist) this.elements.mediaTrackArtist.textContent = [track.artist, track.album].filter(Boolean).join(" · ");
    if (this.elements.mediaArtwork) {
      this.elements.mediaArtwork.innerHTML = track.image
        ? `<img src="${track.image}" alt="Capa de ${track.name || "faixa"}" referrerpolicy="no-referrer" />`
        : "<span>♫</span>";
    }
    if (this.elements.spotifyEmbedContainer) {
      this.elements.spotifyEmbedContainer.innerHTML = "";
      if (track.embedUrl) {
        const frame = document.createElement("iframe");
        frame.src = track.embedUrl;
        frame.width = "100%";
        frame.height = "152";
        frame.frameBorder = "0";
        frame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
        frame.loading = "lazy";
        frame.title = `Spotify · ${track.name || "faixa"}`;
        this.elements.spotifyEmbedContainer.appendChild(frame);
      }
    }
    if (this.elements.mediaExternalLink) {
      this.elements.mediaExternalLink.href = track.url || "#";
      this.elements.mediaExternalLink.classList.toggle("hidden", !track.url);
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
    this.elements.nextEventCard.querySelector(".event-meta").textContent =
      `${formatLongDate(start)} · ${formatTime(start)} · ${humanDuration(duration)}`;

    this.updateNextCountdown();
  }

  updateNextCountdown() {
    if (!this.currentNextEvent) return;

    const start = new Date(this.currentNextEvent.startAt);
    this.elements.nextEventCountdown.textContent = humanCountdown(start).toUpperCase();
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
    item.className = "event-item";
    item.dataset.eventId = event.id;

    const time = document.createElement("div");
    time.className = "event-time";
    time.textContent = formatTime(start);

    const body = document.createElement("div");

    const title = document.createElement("div");
    title.className = "event-title";
    title.textContent = event.title;

    const meta = document.createElement("div");
    meta.className = "event-meta";
    meta.textContent = compact
      ? `até ${formatTime(end)}`
      : `${formatDate(start)} · ${formatTime(start)}–${formatTime(end)} · ${event.category || "default"}`;

    body.append(title, meta);

    const edit = document.createElement("button");
    edit.className = "event-edit";
    edit.type = "button";
    edit.textContent = "EDITAR";
    edit.addEventListener("click", () => this.openEventDialog(event));

    item.append(time, body, edit);
    return item;
  }

  async renderMemory() {
    const memories = await this.memory.all();
    const count = memories.length;

    this.elements.memoryCount.textContent = String(count);
    this.elements.memoryCounter.textContent = `${count} ${count === 1 ? "ENTRY" : "ENTRIES"}`;

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
      this.elements.deleteEventButton.classList.add("hidden");
    }

    this.elements.eventDialog.showModal();
    setTimeout(() => this.elements.eventTitle.focus(), 30);
  }

  closeEventDialog() {
    this.elements.eventDialog.close();
  }

  localDateValue(date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
}
