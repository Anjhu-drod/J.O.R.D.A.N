import { CalendarService } from "./calendarService.js";
import { JordanAssistant } from "./assistant.js";
import { VoiceService } from "./voice.js";
import { JordanUI } from "./ui.js";
import { MemoryService } from "./memoryService.js";
import { ReminderService } from "./reminderService.js";
import { detectEventProfile } from "./eventProfiles.js";
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
const assistant = new JordanAssistant(calendar, memory);
const ui = new JordanUI(calendar, memory);

let deferredInstallPrompt = null;
let voiceEnabled = true;
let assistantVolume = 1;
let preferredVoiceName = "";

const voice = new VoiceService({
  silenceMs: 3000,
  onTranscript: async (transcript) => {
    await handleCommand(transcript, { fromVoice: true });
  },
  onInterimTranscript: (transcript) => {
    ui.setInterimTranscript(transcript);
  },
  onStatusChange: (status) => ui.setStatus(status),
  onListeningChange: (active) => ui.setListening(active),
  onSpeakingChange: (active) => ui.setSpeaking(active)
});

const reminders = new ReminderService(calendar, {
  onReminder: async ({ message }) => {
    ui.toast(message, "JORDAN / ALERTA", 9000);
    ui.addMessage("JORDAN", message);

    if (voiceEnabled && voice.synthesisSupported) {
      await voice.speak(message, { volume: assistantVolume });
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
  preferredVoiceName = await getSetting("preferredVoiceName", "");
  voice.setPreferredVoiceName(preferredVoiceName);

  ui.elements.speechRecognitionStatus.textContent =
    voice.recognitionSupported ? "Disponível" : "Indisponível neste navegador";

  updateVoiceStatus();

  if (voice.synthesisSupported && "onvoiceschanged" in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = updateVoiceStatus;
  }

  ui.elements.pwaStatus.textContent =
    "serviceWorker" in navigator ? "Compatível" : "Não compatível";

  ui.setNotificationStatus(reminders.notificationPermission);

  const savedAlwaysListening = await getSetting("alwaysListening", false);
  ui.elements.alwaysListeningToggle.checked = false;

  if (savedAlwaysListening) {
    ui.setStatus('O modo “Jordan” estava ativo. Toque no controle para reativar o microfone.');
  }

  await ui.refreshAll();
  registerServiceWorker();
  reminders.start();

  ui.elements.commandInput.focus();
}

function populateVoiceSelect() {
  if (!voice.synthesisSupported) return;

  const voices = voice.getPortugueseVoices();
  const current = preferredVoiceName;

  ui.elements.voiceSelect.innerHTML = '<option value="">Automática feminina PT-BR</option>';

  for (const item of voices) {
    const option = document.createElement("option");
    option.value = item.name;
    option.textContent = `${item.name} · ${item.lang}`;
    ui.elements.voiceSelect.appendChild(option);
  }

  ui.elements.voiceSelect.value = current;
}

function updateVoiceStatus() {
  if (!voice.synthesisSupported) {
    ui.elements.speechSynthesisStatus.textContent = "Indisponível";
    return;
  }

  const selectedVoice = voice.chooseFemalePortugueseVoice();

  populateVoiceSelect();

  if (selectedVoice) {
    ui.elements.speechSynthesisStatus.textContent = `Selecionada: ${selectedVoice.name}`;
  } else {
    ui.elements.speechSynthesisStatus.textContent = "Voz PT-BR do sistema";
  }
}

function bindEvents() {
  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", () => {
      ui.openView(button.dataset.viewTarget);
    });
  });

  document.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", async () => {
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

  ui.elements.orbButton.addEventListener("click", toggleVoice);
  ui.elements.micButton.addEventListener("click", toggleVoice);

  ui.elements.clearChatButton.addEventListener("click", () => ui.clearChat());

  ui.elements.voiceSelect.addEventListener("change", async (event) => {
    preferredVoiceName = event.target.value;
    voice.setPreferredVoiceName(preferredVoiceName);
    await setSetting("preferredVoiceName", preferredVoiceName);
    updateVoiceStatus();
  });

  ui.elements.testVoiceButton.addEventListener("click", async () => {
    await voice.speak(
      "Oi. Eu sou a Jordan. Esta é a voz que você escolheu para mim.",
      { volume: assistantVolume }
    );
  });

  ui.elements.calendarShortcut.addEventListener("click", () => {
    ui.openView("calendar");
  });

  ui.elements.alwaysListeningToggle.addEventListener("change", async (event) => {
    const enabled = event.target.checked;
    await setSetting("alwaysListening", enabled);

    if (enabled) {
      if (!voice.recognitionSupported) {
        event.target.checked = false;
        ui.addMessage(
          "JORDAN",
          "Este navegador não oferece reconhecimento de voz. O modo contínuo não pode ser ativado aqui."
        );
        return;
      }

      voice.setAlwaysListening(true);
      ui.addMessage(
        "JORDAN",
        'Modo “Jordan” ativado enquanto esta página estiver ativa. Diga “Jordan” antes do comando.'
      );
    } else {
      voice.setAlwaysListening(false);
    }
  });

  ui.elements.searchInput.addEventListener("input", () => ui.renderAgenda());
  ui.elements.periodFilter.addEventListener("change", () => ui.renderAgenda());

  ui.elements.newEventButton.addEventListener("click", () => {
    ui.openEventDialog();
  });

  ui.elements.closeDialogButton.addEventListener("click", () => {
    ui.closeEventDialog();
  });

  ui.elements.cancelEventButton.addEventListener("click", () => {
    ui.closeEventDialog();
  });

  ui.elements.eventForm.addEventListener("submit", saveEventFromForm);
  ui.elements.deleteEventButton.addEventListener("click", deleteEventFromForm);

  ui.elements.notificationButton.addEventListener("click", async () => {
    const permission = await reminders.requestPermission();
    ui.setNotificationStatus(permission);

    if (permission === "granted") {
      ui.toast("Alertas do navegador ativados. Os avisos falados continuam funcionando enquanto JORDAN estiver aberta.");
    } else if (permission === "denied") {
      ui.toast("O navegador bloqueou os alertas. Você pode mudar essa permissão nas configurações do site.");
    }
  });

  ui.elements.exportButton.addEventListener("click", async () => {
    const data = await exportMemory();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(`JORDAN-backup-${stamp}.json`, data);
    ui.addMessage("JORDAN", "Backup da agenda e da memória exportado.");
  });

  ui.elements.importInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importMemory(data);
      await assistant.initialize();
      await ui.refreshAll();
      ui.addMessage("JORDAN", "Backup importado. Minha agenda e minha memória foram restauradas.");
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

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" && voice.listening) {
      voice.stop({ manual: false, clearPending: true });
      ui.setStatus("Pausado em segundo plano.");
    }
  });
}

async function toggleVoice() {
  if (!voice.recognitionSupported) {
    ui.addMessage(
      "JORDAN",
      "O reconhecimento de voz não está disponível neste navegador. Você ainda pode conversar comigo pelo campo de texto."
    );
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
  ui.addMessage("VOCÊ", text);
  ui.setInterimTranscript("");
  ui.setStatus("Processando...");

  try {
    const result = await assistant.execute(text);
    ui.addMessage("JORDAN", result.text);

    if (result.refreshAgenda) {
      await Promise.all([
        ui.renderToday(),
        ui.renderNext(),
        ui.renderAgenda()
      ]);
    }

    if (result.refreshMemory) {
      await ui.renderMemory();
    }

    if (result.action === "open-view" && result.view) {
      ui.openView(result.view);
    }

    if (voiceEnabled && voice.synthesisSupported) {
      await voice.speak(result.speak, { volume: assistantVolume });
    } else {
      ui.setStatus("Sistema pronto.");
    }

    // Conversa de duas etapas: se JORDAN perguntou a duração e o comando veio
    // por voz, ela volta a ouvir sozinha depois de terminar de falar.
    if (
      result.awaitingReply &&
      fromVoice &&
      !voice.alwaysListening &&
      voice.recognitionSupported
    ) {
      setTimeout(() => voice.start({ always: false }), 500);
    }
  } catch (error) {
    console.error(error);
    ui.addMessage(
      "JORDAN",
      `Ocorreu um erro ao processar isso: ${error.message}`
    );
    ui.setStatus("Erro.");
  }
}

async function saveEventFromForm(event) {
  event.preventDefault();

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
    await calendar.update(id, {
      title,
      description,
      startAt,
      endAt,
      category: profile.id
    });
    ui.addMessage("JORDAN", `Atualizei o compromisso “${title}”.`);
  } else {
    const conflicts = await calendar.conflicts(startAt, endAt);

    await calendar.create({
      title,
      description,
      startAt,
      endAt,
      source: "manual",
      category: profile.id
    });

    let message = `Adicionei “${title}” à minha agenda.`;
    if (conflicts.length) {
      message += ` Atenção: ele conflita com “${conflicts[0].title}”.`;
    }

    ui.addMessage("JORDAN", message);
  }

  ui.closeEventDialog();
  await ui.refreshAll();
}

async function deleteEventFromForm() {
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
