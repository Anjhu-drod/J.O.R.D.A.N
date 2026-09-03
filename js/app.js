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
import { ScienceService } from "./scienceService.js";
import { AppLauncherService } from "./appLauncherService.js";
import { OriginalSongService } from "./originalSongService.js";
import { getLexiconStats } from "./semanticLexicon.js";
import { getSystemCommands, matchSystemCommand } from "./systemCommandService.js";
import { detectEventProfile } from "./eventProfiles.js";
import { getPersonality, randomIdleDelay, randomIdlePrompt } from "./personalityService.js";
import {
  exportMemory,
  getSetting,
  importMemory,
  openDatabase,
  setSetting,
  subscribeCloudChanges,
  waitForCloudSync
} from "./db.js";
import { authService, friendlyAuthError } from "./authService.js";
import { hasPersistentFirestoreCache } from "./firebaseService.js";
import { migrateLegacyJordanDB } from "./legacyMigrationService.js";
import { downloadJson } from "./utils.js";

const calendar = new CalendarService();
const memory = new MemoryService();
const stories = new StoryService(memory);
const internet = new InternetService();
const locationService = new LocationService();
const media = new MediaService();
const science = new ScienceService();
const appLauncher = new AppLauncherService();
const originalSongs = new OriginalSongService();
const assistant = new JordanAssistant(calendar, memory, stories, {
  internet,
  location: locationService,
  media,
  science,
  appLauncher,
  originalSongs
});
const ui = new JordanUI(calendar, memory);

let deferredInstallPrompt = null;
let voiceEnabled = true;
let assistantVolume = 1;
let languageMode = "pt";
let internetEnabled = true;
let theme = "crimson";
let idleTimer = null;
let lastInteractionAt = Date.now();
let jordanInitialized = false;
let cloudUnsubscribe = null;
let cloudRefreshTimer = null;
let cloudState = { online: navigator.onLine, pending: false, fromCache: true, error: null };

const voice = new VoiceService({
  silenceMs: 2000,
  onTranscript: async (transcript) => {
    await handleCommand(transcript, { fromVoice: true });
  },
  onInterimTranscript: (transcript) => ui.setInterimTranscript(transcript),
  onStatusChange: (status) => ui.setStatus(status),
  onListeningChange: (active) => ui.setListening(active),
  onSpeakingChange: (active) => {
    ui.setSpeaking(active);
    media.setDucked(active);
  },
  onLanguageDetected: (language) => ui.setLanguageStatus(languageMode, language)
});

let musicLibrarySnapshot = [];

media.setCallbacks({
  onTrackChange: (track) => {
    ui.renderMediaTrack(track);
    ui.renderMusicLibrary(musicLibrarySnapshot, track?.id || null);
  },
  onStateChange: (state) => ui.updateMusicPlaybackState(state),
  onTimeUpdate: (time) => ui.updateMusicTime(time),
  onLibraryChange: (tracks) => {
    musicLibrarySnapshot = tracks;
    ui.setMusicLibraryStatus(tracks.length);
    ui.renderMusicLibrary(tracks, media.getState()?.currentTrack?.id || null);
  }
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

let legacyMigrationRunning = false;

function isStartupCloudError(error) {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return !navigator.onLine
    || error?.name === "FirebaseError"
    || code.includes("unavailable")
    || code.includes("network-request-failed")
    || code.includes("permission-denied")
    || code.includes("failed-precondition")
    || code.includes("not-found")
    || code.includes("deadline-exceeded")
    || message.includes("client is offline")
    || message.includes("failed to fetch")
    || message.includes("network error");
}

async function startupCloudValue(label, task, fallback) {
  try {
    return await task();
  } catch (error) {
    console.warn(`JORDAN startup / ${label}:`, error);
    cloudState = {
      ...cloudState,
      online: navigator.onLine,
      fromCache: true,
      pending: true,
      error
    };
    ui.setCloudStatus(cloudState);

    if (!isStartupCloudError(error)) {
      ui.addMessage("JORDAN", `O Cloud Core respondeu com um erro em ${label}. Vou iniciar com o modo de contingência e continuar tentando sincronizar.`);
    }
    return fallback;
  }
}

async function attemptLegacyMigration({ notify = false } = {}) {
  if (legacyMigrationRunning || !authService.currentUser) return null;

  legacyMigrationRunning = true;
  try {
    const migration = await migrateLegacyJordanDB();

    if (migration?.migrated) {
      ui.toast(
        `Migrei ${migration.memoryCount} memórias e ${migration.eventCount} compromissos antigos para sua JORDAN ID.`,
        "JORDAN CLOUD"
      );
    } else if (migration?.deferred && notify) {
      ui.toast(
        "A memória antiga está segura neste aparelho. Vou concluir a migração assim que o Firestore confirmar a conexão.",
        "JORDAN CLOUD"
      );
    }

    return migration;
  } catch (error) {
    console.warn("JORDAN legacy migration:", error);
    if (notify) {
      ui.toast(
        "Não consegui confirmar a migração agora. Mantive sua memória antiga intacta e tentarei novamente depois.",
        "JORDAN CLOUD"
      );
    }
    return { migrated: false, deferred: true, error };
  } finally {
    legacyMigrationRunning = false;
  }
}

async function initialize() {
  if (jordanInitialized) return;
  jordanInitialized = true;

  ui.startClock();
  bindEvents();
  ui.setAccountUser(authService.currentUser);
  ui.setCloudStatus(cloudState);

  await startupCloudValue("abertura da memória", async () => {
    await openDatabase();
    ui.elements.dbStatus.textContent = hasPersistentFirestoreCache()
      ? "CLOUD + OFFLINE CACHE"
      : "CLOUD · CACHE TEMPORÁRIO";
    return true;
  }, false);

  // A migração nunca mais pode impedir a tela principal de abrir.
  attemptLegacyMigration().catch((error) => {
    console.warn("JORDAN legacy migration background:", error);
  });

  const accountUser = authService.currentUser;
  if (accountUser?.displayName) {
    const currentName = await startupCloudValue(
      "nome do perfil",
      () => memory.get("profile.name"),
      null
    );

    if (!currentName) {
      await startupCloudValue(
        "gravação do nome do perfil",
        () => memory.remember({
          key: "profile.name",
          label: "Seu nome",
          value: accountUser.displayName,
          type: "fact",
          source: "jordan-id"
        }),
        null
      );
    }
  }

  try {
    await assistant.initialize();
  } catch (error) {
    if (!isStartupCloudError(error)) throw error;
    console.warn("JORDAN Assistant iniciou sem resposta do Firestore:", error);
    cloudState = { ...cloudState, fromCache: true, pending: true, error };
    ui.setCloudStatus(cloudState);
  }

  voiceEnabled = await startupCloudValue("voiceEnabled", () => getSetting("voiceEnabled", true), true);
  assistantVolume = await startupCloudValue("assistantVolume", () => getSetting("assistantVolume", 1), 1);
  languageMode = await startupCloudValue("languageMode", () => getSetting("languageMode", "pt"), "pt");
  if (languageMode === "auto") {
    languageMode = "pt";
    startupCloudValue("migração languageMode", () => setSetting("languageMode", "pt"), null);
  }
  internetEnabled = await startupCloudValue("internetEnabled", () => getSetting("internetEnabled", true), true);
  theme = await startupCloudValue("theme", () => getSetting("theme", "crimson"), "crimson");

  voice.setLanguageMode(languageMode);
  assistant.setResponseLanguage?.(languageMode);
  internet.setEnabled(internetEnabled);
  ui.setTheme(theme);

  if (ui.elements.languageModeSelect) ui.elements.languageModeSelect.value = languageMode;
  if (ui.elements.themeSelect) ui.elements.themeSelect.value = theme;
  ui.setLanguageStatus(languageMode, voice.currentLanguage);
  ui.setInternetStatus({ enabled: internetEnabled, online: navigator.onLine });
  ui.setLexiconStatus(getLexiconStats());
  renderSystemCommandLearning();

  try {
    await media.initialize();
    musicLibrarySnapshot = await media.getLibrary();
    ui.setMusicLibraryStatus(musicLibrarySnapshot.length);
    ui.renderMusicLibrary(musicLibrarySnapshot, null);
    ui.updateMusicPlaybackState(media.getState());
  } catch (error) {
    console.warn("JORDAN Music:", error);
    ui.setMusicLibraryStatus(0);
    ui.toast("Não consegui abrir a biblioteca local de música neste navegador.");
  }

  if (internetEnabled && navigator.onLine) {
    internet.testConnection().then((test) => {
      ui.setInternetStatus({ enabled: internetEnabled, online: navigator.onLine, tested: test.ok });
    });
  }

  ui.elements.speechRecognitionStatus.textContent =
    voice.recognitionSupported ? "Disponível · silêncio: 2 s" : "Indisponível neste navegador";

  if (ui.elements.offlineSpeechStatus) {
    voice.localRecognitionAvailability().then((status) => {
      const labels = {
        available: "PT-BR local disponível",
        downloadable: "Pacote PT-BR disponível para download",
        downloading: "Pacote PT-BR baixando",
        unavailable: "Reconhecimento local indisponível",
        unsupported: "Navegador sem suporte"
      };
      ui.elements.offlineSpeechStatus.textContent = labels[status] || status;
    });
  }

  updateVoiceStatus();
  ui.setPersonality(assistant.getPersonality());

  if (voice.synthesisSupported && "onvoiceschanged" in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = updateVoiceStatus;
  }

  ui.elements.pwaStatus.textContent = "serviceWorker" in navigator ? "Compatível" : "Não compatível";
  ui.setNotificationStatus(reminders.notificationPermission);

  const audioDefaultApplied = await startupCloudValue(
    "v05AudioDefaultApplied",
    () => getSetting("v05AudioDefaultApplied", false),
    false
  );

  if (!audioDefaultApplied) {
    await startupCloudValue("alwaysListening default", () => setSetting("alwaysListening", true), null);
    await startupCloudValue("v05AudioDefaultApplied save", () => setSetting("v05AudioDefaultApplied", true), null);
  }

  const savedAlwaysListening = await startupCloudValue(
    "alwaysListening",
    () => getSetting("alwaysListening", true),
    true
  );
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

  await startupCloudValue("atualização da interface", () => ui.refreshAll(), null);

  cloudUnsubscribe?.();
  try {
    cloudUnsubscribe = subscribeCloudChanges((status) => {
      cloudState = { ...cloudState, ...status, error: status.error || null };
      ui.setCloudStatus(cloudState);

      if (["events", "memories"].includes(status.kind)) {
        clearTimeout(cloudRefreshTimer);
        cloudRefreshTimer = setTimeout(async () => {
          if (!jordanInitialized) return;
          try {
            await ui.refreshAll();
          } catch (error) {
            console.warn("JORDAN Cloud refresh:", error);
          }
        }, 420);
      }
    });
  } catch (error) {
    console.warn("JORDAN Cloud listener:", error);
    cloudState = { ...cloudState, fromCache: true, pending: true, error };
    ui.setCloudStatus(cloudState);
  }

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

  const importMusicFiles = async (fileInput) => {
    registerInteraction();
    const files = fileInput?.files;
    if (!files?.length) return;
    try {
      const result = await media.importFiles(files);
      musicLibrarySnapshot = await media.getLibrary();
      ui.setMusicLibraryStatus(musicLibrarySnapshot.length);
      ui.renderMusicLibrary(musicLibrarySnapshot, media.getState()?.currentTrack?.id || null);
      const importedText = result.imported === 1 ? "1 música adicionada" : `${result.imported} músicas adicionadas`;
      const skippedText = result.skipped ? ` · ${result.skipped} já existiam` : "";
      ui.toast(`${importedText}${skippedText}.`, "JORDAN MUSIC");
      ui.openCompanion("media");
    } catch (error) {
      console.warn("Import music:", error);
      ui.toast("Não consegui salvar esses arquivos de áudio.", "JORDAN MUSIC");
    } finally {
      fileInput.value = "";
    }
  };

  ui.elements.musicImportInput?.addEventListener("change", (event) => importMusicFiles(event.target));
  ui.elements.musicImportInputCompanion?.addEventListener("change", (event) => importMusicFiles(event.target));

  ui.elements.musicClearButton?.addEventListener("click", async () => {
    registerInteraction();
    if (!window.confirm("Apagar todas as músicas salvas na biblioteca local da JORDAN neste dispositivo?")) return;
    await media.clearLibrary();
    musicLibrarySnapshot = [];
    ui.renderMediaTrack(null);
    ui.renderMusicLibrary([], null);
    ui.toast("Biblioteca local limpa.", "JORDAN MUSIC");
  });

  ui.elements.musicPlayPauseButton?.addEventListener("click", async () => {
    registerInteraction();
    const result = await media.togglePlayPause();
    if (result?.blocked) ui.toast("O navegador pediu uma interação manual. Toque em Play novamente.", "JORDAN MUSIC");
  });
  ui.elements.musicPreviousButton?.addEventListener("click", () => { registerInteraction(); media.previous(); });
  ui.elements.musicNextButton?.addEventListener("click", () => { registerInteraction(); media.next(); });
  ui.elements.musicShuffleButton?.addEventListener("click", () => {
    registerInteraction();
    const enabled = media.toggleShuffle();
    ui.toast(enabled ? "Shuffle ativado." : "Shuffle desativado.", "JORDAN MUSIC");
  });
  ui.elements.musicRepeatButton?.addEventListener("click", () => {
    registerInteraction();
    const mode = media.cycleRepeat();
    const labels = { off: "Repeat desligado.", all: "Repetir biblioteca.", one: "Repetir faixa atual." };
    ui.toast(labels[mode], "JORDAN MUSIC");
  });
  ui.elements.musicFavoriteButton?.addEventListener("click", async () => {
    registerInteraction();
    if (!media.getState()?.currentTrack) {
      ui.toast("Nenhuma música está carregada.", "JORDAN MUSIC");
      return;
    }
    const favorite = await media.toggleFavorite();
    ui.toast(favorite ? "Adicionei às favoritas." : "Removi das favoritas.", "JORDAN MUSIC");
  });
  ui.elements.musicVolume?.addEventListener("input", (event) => media.setVolume(event.target.value));
  ui.elements.musicProgress?.addEventListener("input", (event) => media.seekPercent(event.target.value));
  ui.elements.musicSearchInput?.addEventListener("input", () => {
    ui.renderMusicLibrary(musicLibrarySnapshot, media.getState()?.currentTrack?.id || null);
  });
  ui.elements.musicLibraryList?.addEventListener("click", async (event) => {
    const item = event.target.closest("[data-track-id]");
    if (!item) return;
    registerInteraction();
    const result = await media.playTrack(item.dataset.trackId);
    if (result?.blocked) ui.toast("Toque no Play do player para liberar o áudio.", "JORDAN MUSIC");
  });

  ui.elements.themeSelect?.addEventListener("change", async (event) => {
    registerInteraction();
    theme = event.target.value;
    ui.setTheme(theme);
    await setSetting("theme", theme);
    ui.toast(`Tema visual: ${event.target.selectedOptions[0]?.textContent || theme}.`);
  });

  document.querySelectorAll("[data-companion-target]").forEach((button) => {
    button.addEventListener("click", () => ui.openCompanion(button.dataset.companionTarget));
  });
  ui.elements.closeCompanionButton?.addEventListener("click", () => ui.closeCompanion());

  ui.elements.offlineSpeechButton?.addEventListener("click", async () => {
    registerInteraction();
    ui.elements.offlineSpeechStatus.textContent = "Preparando pacote local...";
    const result = await voice.prepareLocalRecognition();
    const labels = {
      available: "PT-BR local ativado",
      downloadable: "Pacote ainda precisa ser baixado",
      downloading: "Pacote em download",
      unavailable: "PT-BR local indisponível",
      failed: "Falha ao instalar pacote local",
      unsupported: "Navegador sem suporte"
    };
    ui.elements.offlineSpeechStatus.textContent = labels[result.status] || result.status;
    ui.toast(result.status === "available" ? "Reconhecimento PT-BR local ativado." : "Este navegador continuará usando o reconhecimento normal.");
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
    cloudState = { ...cloudState, online: true, error: null };
    ui.setCloudStatus(cloudState);
    ui.setInternetStatus({ enabled: internetEnabled, online: true });
    if (internetEnabled) internet.testConnection().then((test) => {
      ui.setInternetStatus({ enabled: internetEnabled, online: true, tested: test.ok });
    });

    // Se a primeira inicialização aconteceu sem o Firestore disponível,
    // tentamos concluir a migração antiga sem bloquear a JORDAN.
    window.setTimeout(() => {
      attemptLegacyMigration({ notify: false }).catch((error) => {
        console.warn("JORDAN Cloud migration retry:", error);
      });
    }, 1200);
  });

  window.addEventListener("offline", () => {
    cloudState = { ...cloudState, online: false, fromCache: true };
    ui.setCloudStatus(cloudState);
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
    if (result.action === "play-media" && result.track) {
      ui.renderMediaTrack(result.track);
      const playback = await media.playTrack(result.track.id);
      if (playback?.blocked) {
        ui.toast("A faixa está pronta. Toque no botão Play para liberar o áudio neste navegador.", "JORDAN MUSIC");
      }
    }
    if (result.action === "open-music-library") {
      ui.openCompanion("media");
    }
    if (result.action === "research-results" && result.research) {
      ui.renderResearch(result.research);
    }
    if (result.action === "route-results" && result.route) {
      ui.renderRoute(result.route);
      if (ui.elements.locationStatus) ui.elements.locationStatus.textContent = "Rota preparada";
    }
    if (result.action === "science-result" && result.science) {
      ui.renderScience(result.science);
    }
    if (result.action === "launch-app" && result.appTarget?.url) {
      const popup = window.open(result.appTarget.url, "_blank", "noopener,noreferrer");
      if (!popup) ui.addExternalLink(`ABRIR ${result.appTarget.label}`, result.appTarget.url, "APP / SITE");
    }
    if (result.action === "sing-original" && result.song?.text && voice.synthesisSupported) {
      // A fala normal abaixo usa a prosódia da JORDAN; a letra é um improviso original do próprio app.
      ui.openCompanion("media");
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

    if (voiceEnabled && voice.synthesisSupported && result.action === "sing-original" && result.song?.lines) {
      await voice.singOriginal(result.song.lines, { volume: assistantVolume });
    } else if (voiceEnabled && voice.synthesisSupported && result.speak) {
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

  if (id === "open_player") {
    ui.openCompanion("media");
    return;
  }

  if (id === "music_pause") {
    ui.openCompanion("media");
    media.pause();
    return;
  }

  if (id === "music_resume") {
    ui.openCompanion("media");
    const result = await media.resume();
    if (!result?.ok && result?.reason === "nothing-loaded") {
      ui.toast("Nenhuma música está carregada.", "JORDAN MUSIC");
    }
    return;
  }

  if (id === "music_next") {
    ui.openCompanion("media");
    await media.next();
    return;
  }

  if (id === "music_previous") {
    ui.openCompanion("media");
    await media.previous();
    return;
  }

  if (id === "music_shuffle") {
    ui.openCompanion("media");
    const enabled = media.toggleShuffle();
    ui.toast(enabled ? "Shuffle ativado." : "Shuffle desativado.", "JORDAN MUSIC");
    return;
  }

  if (id === "open_research") {
    ui.openCompanion("research");
    return;
  }

  if (id === "open_navigation") {
    ui.openCompanion("route");
    return;
  }

  if (id === "open_lab") {
    ui.openCompanion("science");
    return;
  }

  if (id === "close_panel") {
    ui.closeCompanion();
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



function setAuthTab(mode) {
  ui.setAuthMode(mode);
}

function bindAuthEvents() {
  ui.elements.authLoginTab?.addEventListener("click", () => setAuthTab("login"));
  ui.elements.authRegisterTab?.addEventListener("click", () => setAuthTab("register"));

  document.querySelectorAll("[data-password-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.passwordTarget);
      if (!input) return;
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      button.textContent = visible ? "VER" : "OCULTAR";
    });
  });

  ui.elements.authLoginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    ui.setAuthBusy(true);
    ui.setAuthMessage("Autenticando JORDAN ID...");

    try {
      await authService.loginEmail(
        ui.elements.authLoginEmail.value,
        ui.elements.authLoginPassword.value,
        { remember: ui.elements.authRememberLogin.checked }
      );
      ui.setAuthMessage("Identidade confirmada. Carregando sua JORDAN...", "success");
    } catch (error) {
      ui.setAuthMessage(friendlyAuthError(error), "error");
    } finally {
      ui.setAuthBusy(false);
    }
  });

  ui.elements.authRegisterForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = ui.elements.authRegisterPassword.value;
    const confirm = ui.elements.authRegisterConfirm.value;

    if (password !== confirm) {
      ui.setAuthMessage("As duas senhas precisam ser iguais.", "error");
      return;
    }

    ui.setAuthBusy(true);
    ui.setAuthMessage("Criando sua JORDAN ID...");

    try {
      await authService.createAccount({
        name: ui.elements.authRegisterName.value,
        email: ui.elements.authRegisterEmail.value,
        password,
        remember: true
      });
      ui.setAuthMessage("JORDAN ID criada. Preparando sua memória...", "success");
    } catch (error) {
      ui.setAuthMessage(friendlyAuthError(error), "error");
    } finally {
      ui.setAuthBusy(false);
    }
  });

  ui.elements.authGoogleButton?.addEventListener("click", async () => {
    ui.setAuthBusy(true);
    ui.setAuthMessage("Abrindo autenticação Google...");

    try {
      const result = await authService.loginGoogle({
        remember: ui.elements.authRememberLogin?.checked !== false
      });
      if (result?.redirected) {
        ui.setAuthMessage("Redirecionando para o Google...");
      }
    } catch (error) {
      ui.setAuthMessage(friendlyAuthError(error), "error");
      ui.setAuthBusy(false);
    }
  });

  ui.elements.authForgotPassword?.addEventListener("click", async () => {
    const email = ui.elements.authLoginEmail?.value?.trim();
    if (!email) {
      ui.setAuthMessage("Digite seu e-mail no campo acima para eu enviar a recuperação.", "error");
      ui.elements.authLoginEmail?.focus();
      return;
    }

    try {
      await authService.resetPassword(email);
      ui.setAuthMessage("Enviei o link de recuperação para seu e-mail.", "success");
    } catch (error) {
      ui.setAuthMessage(friendlyAuthError(error), "error");
    }
  });

  ui.elements.syncNowButton?.addEventListener("click", async () => {
    if (!navigator.onLine) {
      ui.toast("Sem internet agora. O Firestore vai sincronizar automaticamente quando a conexão voltar.", "JORDAN CLOUD");
      return;
    }

    ui.elements.syncNowButton.disabled = true;
    cloudState = { ...cloudState, pending: true, online: true };
    ui.setCloudStatus(cloudState);

    try {
      const synced = await waitForCloudSync(8000);
      if (!synced) {
        cloudState = { ...cloudState, online: navigator.onLine, pending: true, fromCache: true };
        ui.setCloudStatus(cloudState);
        ui.toast("Ainda não recebi confirmação do Firestore. Mantive tudo no cache e vou tentar novamente automaticamente.", "JORDAN CLOUD");
        return;
      }

      cloudState = { online: true, pending: false, fromCache: false, error: null };
      ui.setCloudStatus(cloudState);
      ui.toast("Memória e agenda sincronizadas.", "JORDAN CLOUD");
      await attemptLegacyMigration({ notify: false });
    } catch (error) {
      cloudState = { ...cloudState, error };
      ui.setCloudStatus(cloudState);
      ui.toast("Não consegui confirmar a sincronização agora.", "JORDAN CLOUD");
    } finally {
      ui.elements.syncNowButton.disabled = false;
    }
  });

  ui.elements.logoutButton?.addEventListener("click", async () => {
    const confirmed = window.confirm("Sair da sua JORDAN ID neste dispositivo?");
    if (!confirmed) return;

    try {
      voice.stop?.({ manual: true, clearPending: true });
      voice.cancelSpeech?.({ resumeListening: false });
      reminders.stop();
      cloudUnsubscribe?.();
      cloudUnsubscribe = null;
      await authService.logout();
      window.location.reload();
    } catch (error) {
      ui.toast(friendlyAuthError(error), "JORDAN ID");
    }
  });
}

async function boot() {
  bindAuthEvents();
  ui.showAuthGate("Verificando sua JORDAN ID...");

  try {
    await authService.consumeRedirectResult();
  } catch (error) {
    ui.setAuthMessage(friendlyAuthError(error), "error");
  }

  authService.watch(async (user) => {
    if (!user) {
      ui.showAuthGate("Entre com e-mail ou Google para carregar sua memória compartilhada.");
      ui.setAuthBusy(false);
      return;
    }

    ui.setAccountUser(user);
    ui.setAuthMessage("JORDAN ID reconhecida. Sincronizando memória...", "success");

    try {
      await initialize();
      ui.hideAuthGate();
    } catch (error) {
      console.error("JORDAN boot:", error);

      // Firestore indisponível não deve mais bloquear uma conta já autenticada.
      // Abrimos o CORE em contingência e o SDK continua tentando sincronizar.
      if (isStartupCloudError(error)) {
        cloudState = { ...cloudState, fromCache: true, pending: true, error };
        ui.setCloudStatus(cloudState);
        ui.hideAuthGate();
        ui.toast("Cloud temporariamente indisponível. A JORDAN abriu em modo de contingência e tentará sincronizar sozinha.", "JORDAN CLOUD");
        return;
      }

      jordanInitialized = false;
      ui.showAuthGate();
      ui.setAuthMessage(`Falha ao iniciar a JORDAN: ${error.message}`, "error");
    }
  });
}

boot();
