import { CalendarService } from "./calendarService.js";
import { JordanAssistant } from "./assistant.js";
import { VoiceService } from "./voice.js";
import { JordanUI } from "./ui.js";
import { MemoryService } from "./memoryService.js";
import { ReminderService } from "./reminderService.js";
import { StoryService } from "./storyService.js";
import { InternetService } from "./internetService.js";
import { LocationService } from "./locationService.js";
import { MediaService } from "./mediaService.js";
import { getLexiconStats } from "./semanticLexicon.js";
import { getSystemCommands, matchSystemCommand } from "./systemCommandService.js";
import { detectEventProfile } from "./eventProfiles.js";
import { getPersonality, randomIdleDelay, randomIdlePrompt } from "./personalityService.js";
import {
  exportMemory,
  getSetting,
  importMemory,
  openDatabase,
  setSetting
} from "./db.js";
import { downloadJson } from "./utils.js";

const calendar = new CalendarService();
const memory = new MemoryService();
const stories = new StoryService(memory);
const internet = new InternetService();
const locationService = new LocationService();
const media = new MediaService();
const assistant = new JordanAssistant(calendar, memory, stories, {
  internet,
  location: locationService,
  media
});
const ui = new JordanUI(calendar, memory);

let deferredInstallPrompt = null;
let voiceEnabled = true;
let assistantVolume = 1;
let languageMode = "pt";
let internetEnabled = true;
let mediaProvider = "youtubeMusic";
let idleTimer = null;
let lastInteractionAt = Date.now();

const voice = new VoiceService({
  silenceMs: 2000,
  onTranscript: async (transcript) => {
    await handleCommand(transcript, { fromVoice: true });
  },
  onInterimTranscript: (transcript) => ui.setInterimTranscript(transcript),
  onStatusChange: (status) => ui.setStatus(status),
  onListeningChange: (active) => ui.setListening(active),
  onSpeakingChange: (active) => ui.setSpeaking(active),
  onLanguageDetected: (language) => ui.setLanguageStatus(languageMode, language)
});

const reminders = new ReminderService(calendar, {
  onReminder: async ({ message }) => {
    ui.toast(message, "JORDAN / ALERTA", 9000);
    ui.addMessage("JORDAN", message);

    if (voiceEnabled && voice.synthesisSupported) {
      const profile = assistant.getPersonality();
      await voice.speak(message, {
        volume: assistantVolume,
        rate: profile.voice.rate,
        pitch: profile.voice.pitch,
        mood: "serious"
      });
    }
  }
});

async function initialize() {
  ui.startClock();
  bindEvents();

  try {
    await openDatabase();
    ui.elements.dbStatus.textContent = "Online";
  } catch (error) {
    ui.elements.dbStatus.textContent = "Erro";
    ui.addMessage("JORDAN", `Não consegui iniciar minha memória: ${error.message}`);
  }

  await assistant.initialize();

  voiceEnabled = await getSetting("voiceEnabled", true);
  assistantVolume = await getSetting("assistantVolume", 1);
  languageMode = await getSetting("languageMode", "pt");
  if (languageMode === "auto") {
    languageMode = "pt";
    await setSetting("languageMode", "pt");
  }
  internetEnabled = await getSetting("internetEnabled", true);
  mediaProvider = await getSetting("mediaProvider", "youtubeMusic");

  voice.setLanguageMode(languageMode);
  assistant.setResponseLanguage?.(languageMode);
  internet.setEnabled(internetEnabled);
  media.setDefaultProvider(mediaProvider);

  if (ui.elements.languageModeSelect) ui.elements.languageModeSelect.value = languageMode;
  if (ui.elements.mediaProviderSelect) ui.elements.mediaProviderSelect.value = mediaProvider;
  ui.setLanguageStatus(languageMode, voice.currentLanguage);
  ui.setInternetStatus({ enabled: internetEnabled, online: navigator.onLine });
  ui.setLexiconStatus(getLexiconStats());
  renderSystemCommandLearning();

  if (internetEnabled && navigator.onLine) {
    internet.testConnection().then((test) => {
      ui.setInternetStatus({ enabled: internetEnabled, online: navigator.onLine, tested: test.ok });
    });
  }

  ui.elements.speechRecognitionStatus.textContent =
    voice.recognitionSupported ? "Disponível · silêncio: 2 s" : "Indisponível neste navegador";

  updateVoiceStatus();
  ui.setPersonality(assistant.getPersonality());

  if (voice.synthesisSupported && "onvoiceschanged" in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = updateVoiceStatus;
  }

  ui.elements.pwaStatus.textContent = "serviceWorker" in navigator ? "Compatível" : "Não compatível";
  ui.setNotificationStatus(reminders.notificationPermission);

  // V0.5 migration: o áudio contínuo passa a ser ON por padrão inclusive
  // para quem veio de uma versão antiga. A migração acontece uma única vez;
  // depois disso a escolha do usuário é respeitada normalmente.
  const audioDefaultApplied = await getSetting("v05AudioDefaultApplied", false);
  if (!audioDefaultApplied) {
    await setSetting("alwaysListening", true);
    await setSetting("v05AudioDefaultApplied", true);
  }

  const savedAlwaysListening = await getSetting("alwaysListening", true);
  ui.elements.alwaysListeningToggle.checked = savedAlwaysListening;

  if (savedAlwaysListening && voice.recognitionSupported) {
    setTimeout(() => {
      const started = voice.setAlwaysListening(true);
      if (!started) {
        ui.setStatus("Áudio contínuo está ativado. Toque no símbolo uma vez se o navegador pedir permissão.");
      }
    }, 450);
  } else if (!voice.recognitionSupported) {
    ui.setStatus("Áudio contínuo ativado por padrão, mas este navegador não oferece reconhecimento de voz.");
  }

  await ui.refreshAll();
  await registerServiceWorker();
  reminders.start();
  resetIdleTimer();

  ui.elements.commandInput.focus();
}

function updateVoiceStatus() {
  if (!voice.synthesisSupported) {
    ui.elements.speechSynthesisStatus.textContent = "Indisponível";
    return;
  }

  const selected = voice.chooseJordanVoice?.();
  const base = selected?.name ? ` · base: ${selected.name}` : "";
  ui.elements.speechSynthesisStatus.textContent = `${voice.getVoiceProfileLabel?.() || "JORDAN Spark"}${base}`;
}

function renderSystemCommandLearning() {
  const container = ui.elements.systemCommandList;
  if (!container) return;

  container.innerHTML = "";
  for (const command of getSystemCommands()) {
    const item = document.createElement("article");
    item.className = "system-command-item";

    const body = document.createElement("div");
    const phrase = document.createElement("strong");
    phrase.textContent = command.phrase;

    const description = document.createElement("p");
    description.textContent = command.description;

    const hint = document.createElement("span");
    hint.className = "command-pronunciation-hint";
    hint.textContent = command.hint;

    body.append(phrase, description, hint);

    const play = document.createElement("button");
    play.type = "button";
    play.className = "hud-button small pronunciation-button";
    play.textContent = "▶ PRONÚNCIA";
    play.addEventListener("click", () => {
      registerInteraction();
      voice.pronounceEnglish(command.phrase);
    });

    item.append(body, play);
    container.appendChild(item);
  }
}

function bindEvents() {
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => {
      registerInteraction();
      ui.openView(button.dataset.viewTarget);
    });
  });

  document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", async () => {
      registerInteraction();
      ui.openView("core");
      await handleCommand(button.dataset.command);
    });
  });

  ui.elements.commandForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = ui.elements.commandInput.value.trim();
    if (!text) return;

    ui.elements.commandInput.value = "";
    await handleCommand(text);
  });

  ui.elements.commandInput.addEventListener("input", registerInteraction);
  ui.elements.orbButton.addEventListener("click", toggleVoice);
  ui.elements.micButton.addEventListener("click", toggleVoice);
  ui.elements.clearChatButton.addEventListener("click", () => ui.clearChat());

  ui.elements.languageModeSelect?.addEventListener("change", async (event) => {
    registerInteraction();
    languageMode = event.target.value;
    voice.setLanguageMode(languageMode);
    assistant.setResponseLanguage?.(languageMode);
    await setSetting("languageMode", languageMode);
    ui.setLanguageStatus(languageMode, voice.currentLanguage);
    ui.toast(`Idioma fixo da conversa: ${event.target.selectedOptions[0]?.textContent || languageMode}.`);
  });

  ui.elements.internetToggleButton?.addEventListener("click", async () => {
    registerInteraction();
    internetEnabled = !internetEnabled;
    internet.setEnabled(internetEnabled);
    await setSetting("internetEnabled", internetEnabled);
    ui.setInternetStatus({ enabled: internetEnabled, online: navigator.onLine });

    if (internetEnabled && navigator.onLine) {
      const test = await internet.testConnection();
      ui.setInternetStatus({ enabled: internetEnabled, online: navigator.onLine, tested: test.ok });
      ui.toast(test.ok ? "Internet da JORDAN ativada." : "Internet ativada, mas a fonte de teste não respondeu.");
    } else {
      ui.toast(internetEnabled ? "Internet ativada, mas o dispositivo está offline." : "Internet da JORDAN desativada.");
    }
  });

  ui.elements.mediaProviderSelect?.addEventListener("change", async (event) => {
    registerInteraction();
    mediaProvider = event.target.value;
    media.setDefaultProvider(mediaProvider);
    await setSetting("mediaProvider", mediaProvider);
    ui.toast(`Provedor de mídia: ${event.target.selectedOptions[0]?.textContent || mediaProvider}.`);
  });

  ui.elements.testVoiceButton.addEventListener("click", async () => {
    registerInteraction();
    if (voice.isSpeaking) voice.cancelSpeech();
    const profile = assistant.getPersonality();
    await voice.speak(
      "Oi! Eu sou a Jordan. Esta é a minha voz jovem original, rápida, leve e expressiva!",
      {
        volume: assistantVolume,
        rate: profile.voice.rate,
        pitch: profile.voice.pitch,
        mood: "excited"
      }
    );
  });

  ui.elements.personalitySelect.addEventListener("change", async (event) => {
    const map = {
      extroverted: "Jordan, seja extrovertida",
      introverted: "Jordan, seja introvertida",
      balanced: "Jordan, use personalidade equilibrada",
      playful: "Jordan, seja brincalhona",
      professional: "Jordan, seja profissional"
    };
    await handleCommand(map[event.target.value] ?? map.extroverted);
  });

  ui.elements.calendarShortcut.addEventListener("click", () => {
    registerInteraction();
    ui.openView("calendar");
  });

  ui.elements.alwaysListeningToggle.addEventListener("change", async (event) => {
    registerInteraction();
    const enabled = event.target.checked;
    await setSetting("alwaysListening", enabled);

    if (enabled) {
      if (!voice.recognitionSupported) {
        event.target.checked = false;
        ui.addMessage("JORDAN", "Este navegador não oferece reconhecimento de voz. O modo contínuo não pode ser ativado aqui.");
        return;
      }

      voice.setAlwaysListening(true);
      ui.addMessage("JORDAN", 'Áudio contínuo ativado. Agora você pode falar comigo sem dizer “Jordan”. Para interromper minha fala, diga “Shut up”.');
    } else {
      voice.setAlwaysListening(false);
    }
  });

  ui.elements.searchInput.addEventListener("input", () => ui.renderAgenda());
  ui.elements.periodFilter.addEventListener("change", () => ui.renderAgenda());
  ui.elements.newEventButton.addEventListener("click", () => ui.openEventDialog());
  ui.elements.closeDialogButton.addEventListener("click", () => ui.closeEventDialog());
  ui.elements.cancelEventButton.addEventListener("click", () => ui.closeEventDialog());
  ui.elements.eventForm.addEventListener("submit", saveEventFromForm);
  ui.elements.deleteEventButton.addEventListener("click", deleteEventFromForm);

  ui.elements.closeEmergencyButton.addEventListener("click", () => ui.closeEmergencyPanel());
  ui.elements.closeTutorialButton.addEventListener("click", () => ui.closeTutorialPanel());

  ui.elements.notificationButton.addEventListener("click", async () => {
    registerInteraction();
    const permission = await reminders.requestPermission();
    ui.setNotificationStatus(permission);

    if (permission === "granted") {
      ui.toast("Alertas ativados. Enquanto a JORDAN estiver aberta, também posso falar os lembretes.");
    } else if (permission === "denied") {
      ui.toast("O navegador bloqueou os alertas. Você pode mudar a permissão nas configurações do site.");
    }
  });

  ui.elements.exportButton.addEventListener("click", async () => {
    registerInteraction();
    const data = await exportMemory();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(`JORDAN-backup-${stamp}.json`, data);
    ui.addMessage("JORDAN", "Backup da agenda e da memória exportado.");
  });

  ui.elements.importInput.addEventListener("change", async (event) => {
    registerInteraction();
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importMemory(data);
      await assistant.initialize();
      ui.setPersonality(assistant.getPersonality());
      await ui.refreshAll();
      ui.addMessage("JORDAN", "Backup importado. Minha agenda, histórias e memórias foram restauradas.");
    } catch (error) {
      ui.addMessage("JORDAN", `Não consegui importar o backup: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    ui.elements.installButton.classList.remove("hidden");
  });

  ui.elements.installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    ui.elements.installButton.classList.add("hidden");
  });

  window.addEventListener("online", () => {
    ui.setInternetStatus({ enabled: internetEnabled, online: true });
    if (internetEnabled) internet.testConnection().then((test) => {
      ui.setInternetStatus({ enabled: internetEnabled, online: true, tested: test.ok });
    });
  });

  window.addEventListener("offline", () => {
    ui.setInternetStatus({ enabled: internetEnabled, online: false });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" && voice.listening) {
      voice.stop({ manual: false, clearPending: true });
      ui.setStatus("Pausado em segundo plano.");
    }
    if (document.visibilityState === "visible") resetIdleTimer();
  });

  document.addEventListener("pointerdown", registerInteraction, { passive: true });
  document.addEventListener("keydown", registerInteraction, { passive: true });
}

async function toggleVoice() {
  registerInteraction();

  if (!voice.recognitionSupported) {
    ui.addMessage("JORDAN", "O reconhecimento de voz não está disponível neste navegador. Você ainda pode conversar comigo pelo campo de texto.");
    return;
  }

  if (voice.isSpeaking) {
    voice.interruptAndListen();
    return;
  }

  if (voice.listening || voice.alwaysListening) {
    ui.elements.alwaysListeningToggle.checked = false;
    await setSetting("alwaysListening", false);
    voice.stop({ manual: true });
    return;
  }

  voice.start({ always: false });
}

async function handleCommand(text, { fromVoice = false } = {}) {
  registerInteraction();

  // Digitar ou falar um novo comando sempre pode interromper a fala atual.
  if (voice.isSpeaking) voice.cancelSpeech({ resumeListening: false });

  ui.addMessage("VOCÊ", text);
  ui.setInterimTranscript("");
  ui.setStatus("Processando...");

  try {
    const systemCommand = matchSystemCommand(text);
    if (systemCommand) {
      await executeSystemCommand(systemCommand);
      return;
    }

    const result = await assistant.execute(text);
    ui.addMessage("JORDAN", result.text);

    if (result.refreshAgenda) {
      await Promise.all([ui.renderToday(), ui.renderNext(), ui.renderAgenda()]);
    }

    if (result.refreshMemory) await ui.renderMemory();

    if (result.action === "open-view" && result.view) ui.openView(result.view);
    if (result.action === "open-emergency") ui.openEmergencyPanel(result.priorityNumber || "190");
    if (result.action === "open-tutorial") ui.openTutorialPanel();
    if (result.action === "open-link" && result.url) {
      ui.addExternalLink(result.linkLabel || "ABRIR", result.url, "MÍDIA / LINK");
    }
    if (result.action === "location-results" && result.places) {
      ui.addLocationLinks(result.places);
      if (ui.elements.locationStatus) ui.elements.locationStatus.textContent = `${result.places.length} locais encontrados`;
    }
    if (result.sourceUrl) {
      ui.addSourceLink(result.sourceTitle || "Pesquisa", result.sourceUrl, result.source || "WEB");
    }
    if (result.language) {
      ui.setLanguageStatus(languageMode, result.language);
    }

    if (result.personalityChanged) {
      ui.setPersonality(assistant.getPersonality());
      resetIdleTimer();
    }

    if (voiceEnabled && voice.synthesisSupported && result.speak) {
      const profile = assistant.getPersonality();
      await voice.speak(result.speak, {
        volume: assistantVolume,
        rate: profile.voice.rate,
        pitch: profile.voice.pitch,
        mood: result.mood || "neutral",
        language: result.language || "pt"
      });
    } else {
      ui.setStatus("Sistema pronto.");
    }

    if (
      result.awaitingReply &&
      fromVoice &&
      !voice.alwaysListening &&
      voice.recognitionSupported
    ) {
      setTimeout(() => voice.start({ always: false }), 320);
    }
  } catch (error) {
    console.error(error);
    ui.addMessage("JORDAN", `Ocorreu um erro ao processar isso: ${error.message}`);
    ui.setStatus("Erro.");
  } finally {
    resetIdleTimer();
  }
}


async function executeSystemCommand(command) {
  const id = command?.id;

  if (id === "stop_speaking") {
    voice.cancelSpeech({ resumeListening: voice.alwaysListening });
    ui.setStatus("Fala interrompida.");
    return;
  }

  if (id === "audio_on") {
    ui.elements.alwaysListeningToggle.checked = true;
    await setSetting("alwaysListening", true);
    voice.setAlwaysListening(true);
    ui.addMessage("JORDAN", "Áudio contínuo ativado. Pode falar normalmente.");
    return;
  }

  if (id === "audio_off") {
    ui.elements.alwaysListeningToggle.checked = false;
    await setSetting("alwaysListening", false);
    voice.setAlwaysListening(false);
    ui.addMessage("JORDAN", "Áudio contínuo desativado.");
    return;
  }

  if (id === "open_calendar") {
    ui.openView("calendar");
    ui.toast("Calendário aberto.");
    return;
  }

  if (id === "open_memory") {
    ui.openView("memory");
    ui.toast("Memória aberta.");
    return;
  }

  if (id === "open_settings") {
    ui.openView("system");
    ui.toast("Configurações abertas.");
    return;
  }

  if (id === "go_home") {
    ui.openView("core");
    return;
  }

  if (id === "open_tutorial") {
    ui.openTutorialPanel();
    return;
  }

  if (id === "internet_on" || id === "internet_off") {
    internetEnabled = id === "internet_on";
    internet.setEnabled(internetEnabled);
    await setSetting("internetEnabled", internetEnabled);
    ui.setInternetStatus({ enabled: internetEnabled, online: navigator.onLine });
    ui.toast(internetEnabled ? "Internet Core ativada." : "Internet Core desativada.");
    return;
  }

  if (id === "voice_mute" || id === "voice_unmute") {
    voiceEnabled = id === "voice_unmute";
    await setSetting("voiceEnabled", voiceEnabled);
    ui.toast(voiceEnabled ? "Respostas faladas ativadas." : "Respostas faladas desativadas.");
    return;
  }

  if (id === "volume_up" || id === "volume_down") {
    const delta = id === "volume_up" ? 0.1 : -0.1;
    assistantVolume = Math.max(0.1, Math.min(1, Math.round((assistantVolume + delta) * 10) / 10));
    await setSetting("assistantVolume", assistantVolume);
    ui.toast(`Volume da JORDAN: ${Math.round(assistantVolume * 100)}%.`);
    return;
  }

  if (id === "clear_chat") {
    ui.clearChat();
    ui.toast("Chat limpo.");
  }
}

function registerInteraction() {
  lastInteractionAt = Date.now();
  resetIdleTimer();
}

function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = null;

  const profile = assistant.getPersonality();
  const delay = randomIdleDelay(profile);
  if (!delay) return;

  idleTimer = setTimeout(async () => {
    const quietFor = Date.now() - lastInteractionAt;
    if (quietFor < delay - 500) return resetIdleTimer();
    if (document.visibilityState !== "visible") return resetIdleTimer();
    if (voice.isSpeaking || voice.listening || document.querySelector("dialog[open]")) return resetIdleTimer();

    const prompt = randomIdlePrompt(profile);
    if (!prompt) return;

    ui.addMessage("JORDAN", prompt);
    if (voiceEnabled && voice.synthesisSupported) {
      await voice.speak(prompt, {
        volume: assistantVolume,
        rate: profile.voice.rate,
        pitch: profile.voice.pitch,
        mood: "excited"
      });
    }

    lastInteractionAt = Date.now();
    resetIdleTimer();
  }, delay);
}

async function saveEventFromForm(event) {
  event.preventDefault();
  registerInteraction();

  const id = ui.elements.eventId.value;
  const title = ui.elements.eventTitle.value.trim();
  const date = ui.elements.eventDate.value;
  const time = ui.elements.eventTime.value;
  const duration = Number(ui.elements.eventDuration.value);
  const description = ui.elements.eventDescription.value.trim();
  if (!title || !date || !time) return;

  const startAt = new Date(`${date}T${time}:00`);
  const endAt = new Date(startAt.getTime() + duration * 60000);
  const profile = detectEventProfile(`${title} ${description}`);

  if (id) {
    await calendar.update(id, { title, description, startAt, endAt, category: profile.id });
    ui.addMessage("JORDAN", `Atualizei o compromisso “${title}”.`);
  } else {
    const conflicts = await calendar.conflicts(startAt, endAt);
    await calendar.create({ title, description, startAt, endAt, source: "manual", category: profile.id });
    let message = `Adicionei “${title}” à minha agenda.`;
    if (conflicts.length) message += ` Atenção: ele conflita com “${conflicts[0].title}”.`;
    ui.addMessage("JORDAN", message);
  }

  ui.closeEventDialog();
  await ui.refreshAll();
}

async function deleteEventFromForm() {
  registerInteraction();
  const id = ui.elements.eventId.value;
  if (!id) return;

  const event = await calendar.get(id);
  if (!event) return;
  const confirmed = window.confirm(`Excluir “${event.title}”?`);
  if (!confirmed) return;

  await calendar.remove(id);
  ui.closeEventDialog();
  await ui.refreshAll();
  ui.addMessage("JORDAN", `Excluí “${event.title}”.`);
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    await navigator.serviceWorker.register("./sw.js");
    ui.elements.pwaStatus.textContent = "Offline ativado";
  } catch (error) {
    console.warn("Service Worker:", error);
    ui.elements.pwaStatus.textContent = "Web normal";
  }
}

initialize();
