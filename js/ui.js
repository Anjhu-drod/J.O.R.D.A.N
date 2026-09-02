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
      voiceSelect: document.querySelector("#voiceSelect"),
      testVoiceButton: document.querySelector("#testVoiceButton"),
      personalitySelect: document.querySelector("#personalitySelect"),
      personalityDescription: document.querySelector("#personalityDescription"),
      pwaStatus: document.querySelector("#pwaStatus"),
      coreLanguageStatus: document.querySelector("#coreLanguageStatus"),
      languageStatus: document.querySelector("#languageStatus"),
      languageModeSelect: document.querySelector("#languageModeSelect"),
      internetStatus: document.querySelector("#internetStatus"),
      internetToggleButton: document.querySelector("#internetToggleButton"),
      locationStatus: document.querySelector("#locationStatus"),
      lexiconStatus: document.querySelector("#lexiconStatus"),
      mediaProviderSelect: document.querySelector("#mediaProviderSelect"),
      toastContainer: document.querySelector("#toastContainer"),

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
      this.elements.liveTranscript.textContent = "Toque no símbolo e fale normalmente.";
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

  setLanguageStatus(mode = "auto", detected = "pt") {
    const labels = { pt: "PT", en: "EN", es: "ES", ja: "JA" };
    const text = mode === "auto"
      ? `AUTO · ${labels[detected] ?? "PT"} detectado`
      : `${labels[mode] ?? mode.toUpperCase()} fixo`;

    if (this.elements.languageStatus) this.elements.languageStatus.textContent = text;
    if (this.elements.coreLanguageStatus) this.elements.coreLanguageStatus.textContent = mode === "auto"
      ? `AUTO · PT / EN / ES / JA · NOW ${labels[detected] ?? "PT"}`
      : `${labels[mode] ?? mode.toUpperCase()} · FIXED`;
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
      item.className = "memory-item";

      const body = document.createElement("div");

      const label = document.createElement("span");
      label.className = "memory-item-label";
      label.textContent = memory.label;

      const value = document.createElement("div");
      value.className = "memory-item-value";
      value.textContent = memory.value;

      const type = document.createElement("div");
      type.className = "memory-item-type";
      type.textContent = memory.type === "preference"
        ? "PREFERÊNCIA"
        : memory.type === "story"
          ? "HISTÓRIA"
          : "FATO";

      body.append(label, value, type);

      const remove = document.createElement("button");
      remove.className = "memory-delete";
      remove.type = "button";
      remove.textContent = "×";
      remove.title = "Esquecer";
      remove.addEventListener("click", async () => {
        const confirmed = window.confirm(`Fazer JORDAN esquecer “${memory.label}”?`);
        if (!confirmed) return;

        await this.memory.forget(memory.id);
        await this.renderMemory();
        this.toast(`Esqueci “${memory.label}”.`);
      });

      item.append(body, remove);
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
