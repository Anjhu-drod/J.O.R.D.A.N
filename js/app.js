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
import { lineageService } from "./lineageService.js";
import { listLineageMembers, LINEAGE_PRIVACY_NOTICE } from "./lineageConfig.js";
import { lineageAdminService } from "./lineageAdminService.js";
import { SystemTelemetryService } from "./systemTelemetryService.js";
import { voiceIdentityService } from "./voiceIdentityService.js";
import { visualEffects } from "./visualEffectsService.js";
import { OfflineKnowledgeService } from "./offlineKnowledgeService.js";
import { LanguageLearningService } from "./languageLearningService.js";
import { SemanticBrainService } from "./semanticBrainService.js";
import { PresenceModeService } from "./presenceModeService.js";
import { lineageVoiceConfigService, DEFAULT_SHARED_VOICE_TUNING } from "./lineageVoiceConfigService.js";
import { MessageService } from "./messageService.js";

const calendar = new CalendarService();
const memory = new MemoryService();
const stories = new StoryService(memory);
const internet = new InternetService();
const locationService = new LocationService();
const media = new MediaService();
const science = new ScienceService();
const appLauncher = new AppLauncherService();
const originalSongs = new OriginalSongService();
const offlineKnowledge = new OfflineKnowledgeService();
const languageLearning = new LanguageLearningService(memory);
const semanticBrain = new SemanticBrainService({ memory, lineage: lineageService, offlineKnowledge, languageLearning });
const presence = new PresenceModeService({ getSetting, setSetting });
const messages = new MessageService(lineageService);
const assistant = new JordanAssistant(calendar, memory, stories, {
  internet,
  location: locationService,
  media,
  science,
  appLauncher,
  originalSongs,
  lineage: lineageService,
  offlineKnowledge,
  languageLearning,
  semanticBrain,
  messages,
  getMusicDefaultSource: () => getSetting("music.defaultSource", "youtube")
});
const ui = new JordanUI(calendar, memory);
const telemetry = new SystemTelemetryService({ onUpdate: (data) => ui.updateTelemetry(data) });
visualEffects.start();

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
let selectedLineageIdentityId = null;
let voiceIdentityEnabled = false;
let allowThirdPartyConversation = true;
let neuralVoiceEnabled = true;
let neuralVoiceEndpoint = "http://127.0.0.1:8787";
let deviceVoiceFallbackEnabled = false;
let musicDefaultSource = "youtube";
let sharedVoiceTuning = { ...DEFAULT_SHARED_VOICE_TUNING };
let voiceConfigUnsubscribe = null;
let presenceTimer = null;
let messagePollTimer = null;

const voice = new VoiceService({
  silenceMs: 2000,
  onTranscript: async (transcript, recognitionMeta = {}) => {
    const speaker = voiceIdentityService.verifyRecent();
    await handleCommand(transcript, { fromVoice: true, speaker, recognitionMeta });
  },
  onImmediateCommand: async (transcript) => {
    const speaker = voiceIdentityService.verifyRecent();
    await handleCommand(transcript, { fromVoice: true, speaker, recognitionMeta: { source: "voice", confidence: 1 } });
  },
  onInterimTranscript: (transcript) => {
    ui.setInterimTranscript(transcript);
    if (transcript) telemetry.setExecution("user-speaking");
  },
  onStatusChange: (status) => {
    ui.setStatus(status);
    if (/processando/i.test(status)) telemetry.setExecution("processing");
  },
  onListeningChange: (active) => ui.setListening(active),
  onSpeakingChange: (active) => {
    ui.setSpeaking(active);
    media.setDucked(active);
    telemetry.setExecution(active ? "jordan-speaking" : "idle");
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

function withStartupTimeout(task, ms = 4500, label = "Cloud Core") {
  let timer = null;
  return Promise.race([
    Promise.resolve().then(task).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(`${label} demorou para responder. A JORDAN seguirá em contingência.`);
        error.code = "jordan/startup-timeout";
        reject(error);
      }, ms);
    })
  ]);
}

async function startupCloudValue(label, task, fallback) {
  try {
    return await withStartupTimeout(task, 4500, label);
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
  ui.setAccountProviders(authService.providerSummary(), authService.providerIds());
  ui.setCloudStatus(cloudState);

  const lineageIdentity = lineageService.currentIdentity;
  ui.setLineageIdentity(lineageIdentity);
  ui.setCreatorMode(lineageService.isCreator);
  voiceIdentityService.setIdentity(lineageIdentity?.id || null);
  await presence.initialize();
  ui.setPresenceState?.(presence.state());
  if (ui.elements.lineageRelationSummary && lineageIdentity) {
    const mother = lineageService.relationAnswer("mother");
    const father = lineageService.relationAnswer("father");
    const parts = [];
    if (mother) parts.push(`mãe: ${mother}`);
    if (father) parts.push(`pai: ${father}`);
    ui.elements.lineageRelationSummary.textContent = parts.length
      ? `Árvore ativa · ${parts.join(" · ")}`
      : "Árvore da linhagem ativa para esta identidade.";
  }

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
  const identityName = lineageIdentity?.firstName || accountUser?.displayName;
  if (identityName) {
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
          value: identityName,
          type: "fact",
          source: "lineage-id"
        }),
        null
      );
    }
  }

  try {
    await withStartupTimeout(() => assistant.initialize(), 6500, "Assistant Memory Core");
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
  voiceIdentityEnabled = await startupCloudValue("voiceIdentityEnabled", () => getSetting("voiceIdentityEnabled", false), false);
  allowThirdPartyConversation = await startupCloudValue("allowThirdPartyConversation", () => getSetting("allowThirdPartyConversation", true), true);
  neuralVoiceEnabled = await startupCloudValue("neuralVoiceEnabled", () => getSetting("neuralVoiceEnabled", true), true);
  deviceVoiceFallbackEnabled = await startupCloudValue("deviceVoiceFallbackEnabled", () => getSetting("deviceVoiceFallbackEnabled", false), false);
  musicDefaultSource = await startupCloudValue("music.defaultSource", () => getSetting("music.defaultSource", "youtube"), "youtube");
  if (!['youtube','jordan'].includes(musicDefaultSource)) musicDefaultSource = "youtube";
  // O endpoint é específico do aparelho: PC pode usar localhost enquanto o celular
  // aponta para um endpoint HTTPS remoto da mesma voz. Não sincronizamos essa URL.
  neuralVoiceEndpoint = localStorage.getItem("jordan.voice-endpoint-v1") || "http://127.0.0.1:8787";

  const syncedVoiceprint = await startupCloudValue("voiceIdentityProfile", () => getSetting("voiceIdentityProfile", null), null);
  if (!voiceIdentityService.hasProfile() && syncedVoiceprint?.vector) voiceIdentityService.importProfile(syncedVoiceprint);

  sharedVoiceTuning = await startupCloudValue("shared voice tuning", () => lineageVoiceConfigService.load(), { ...DEFAULT_SHARED_VOICE_TUNING });
  voice.setSharedVoiceTuning(sharedVoiceTuning);
  ui.setVoiceTuning?.(sharedVoiceTuning);
  voiceConfigUnsubscribe?.();
  voiceConfigUnsubscribe = lineageVoiceConfigService.subscribe((next) => {
    sharedVoiceTuning = next;
    voice.setSharedVoiceTuning(next);
    ui.setVoiceTuning?.(next);
  });

  voice.configureNeuralVoice({ enabled: neuralVoiceEnabled, endpoint: neuralVoiceEndpoint });
  voice.setDeviceVoiceFallback(deviceVoiceFallbackEnabled);
  voice.setLanguageMode(languageMode);
  assistant.setResponseLanguage?.(languageMode);
  internet.setEnabled(internetEnabled);
  ui.setTheme(theme);

  if (ui.elements.languageModeSelect) ui.elements.languageModeSelect.value = languageMode;
  if (ui.elements.themeSelect) ui.elements.themeSelect.value = theme;
  if (ui.elements.voiceIdentityToggle) ui.elements.voiceIdentityToggle.checked = voiceIdentityEnabled;
  if (ui.elements.thirdPartyConversationToggle) ui.elements.thirdPartyConversationToggle.checked = allowThirdPartyConversation;
  if (ui.elements.neuralVoiceToggle) ui.elements.neuralVoiceToggle.checked = neuralVoiceEnabled;
  if (ui.elements.deviceVoiceFallbackToggle) ui.elements.deviceVoiceFallbackToggle.checked = deviceVoiceFallbackEnabled;
  if (ui.elements.musicDefaultSource) ui.elements.musicDefaultSource.value = musicDefaultSource;
  if (ui.elements.neuralVoiceEndpoint) ui.elements.neuralVoiceEndpoint.value = neuralVoiceEndpoint;
  voiceIdentityService.setPolicy({ enabled: voiceIdentityEnabled, allowThirdPartyConversation });
  updateVoiceIdentityStatus();
  ui.setLanguageStatus(languageMode, voice.currentLanguage);
  ui.setInternetStatus({ enabled: internetEnabled, online: navigator.onLine });
  ui.setLexiconStatus(getLexiconStats());
  ui.setOfflineKnowledgeStatus?.(offlineKnowledge.stats());
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

  if (voice.browserSynthesisSupported && "onvoiceschanged" in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => updateVoiceStatus();
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
  await refreshMessagesView({ markSeen: false });
  clearInterval(messagePollTimer);
  messagePollTimer = setInterval(async () => {
    if (!jordanInitialized || document.visibilityState === "hidden") return;
    try {
      const unread = await messages.unreadCount();
      ui.setMessageUnreadCount?.(unread);
      if (ui.currentView === "messages") await refreshMessagesView({ markSeen: false });
    } catch {}
  }, 15000);
  if (lineageService.isCreator) {
    refreshCreatorMemoryOverview().catch((error) => console.warn("Creator memory overview:", error));
  }
  telemetry.start();

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
            if (lineageService.isCreator && status.kind === "memories") {
              await refreshCreatorMemoryOverview();
            }
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
  clearInterval(presenceTimer);
  presenceTimer = setInterval(async () => {
    const due = presence.due(new Date());
    if (due.shouldRemind) {
      presence.lastReminderDate = due.dateKey;
      const msg = "Ei, esse é seu lembrete de horário de dormir.";
      ui.addMessage("JORDAN", msg);
      if (voiceEnabled && !presence.silent && !presence.sleeping) await voice.speak(msg, { volume: assistantVolume, mood: "soft" });
    }
    if (due.shouldSleep) {
      await presence.enterSleep();
      ui.setPresenceState?.(presence.state());
      voice.cancelSpeech({ resumeListening: false });
      ui.setStatus("SLEEP MODE · aguardando ‘Bom dia’ ou ‘Socorro’");
    }
  }, 30000);
  resetIdleTimer();

  ui.elements.commandInput.focus();
}

function updateVoiceIdentityStatus(extra = "") {
  const target = ui.elements.voiceIdentityStatus;
  if (!target) return;
  if (!voiceIdentityEnabled) {
    target.textContent = "Desativado";
    return;
  }
  if (!voiceIdentityService.hasProfile()) {
    target.textContent = "Ativo · perfil ainda não cadastrado";
    return;
  }
  target.textContent = extra || "Ativo · perfil local cadastrado";
}

async function refreshCreatorMemoryOverview() {
  if (!lineageService.isCreator) return;
  const groups = await lineageAdminService.getMemoryOverview();
  ui.renderLineageMemoryOverview(groups);
}


async function updateVoiceStatus({ force = false } = {}) {
  if (!voice.synthesisSupported) {
    if (ui.elements.speechSynthesisStatus) ui.elements.speechSynthesisStatus.textContent = "Indisponível";
    ui.setNeuralVoiceStatus({ ok: false, enabled: false });
    return;
  }

  let health = { ok: false, enabled: neuralVoiceEnabled, reason: "disabled" };
  if (neuralVoiceEnabled) {
    health = await voice.neuralVoiceHealth({ force }).catch((error) => ({ ok: false, enabled: true, error }));
    health.enabled = true;
  }
  ui.setNeuralVoiceStatus(health);

  if (!health.ok && ui.elements.speechSynthesisStatus) {
    if (deviceVoiceFallbackEnabled) {
      const selected = voice.chooseJordanVoice?.();
      const base = selected?.name ? ` · contingência: ${selected.name}` : " · contingência do dispositivo";
      ui.elements.speechSynthesisStatus.textContent = `Voice Core offline${base}`;
    } else {
      ui.elements.speechSynthesisStatus.textContent = "Voice Core offline · resposta em texto";
    }
  }
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
      if (button.dataset.viewTarget === "messages") refreshMessagesView({ markSeen: true }).catch(console.warn);
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

  ui.elements.saveVoiceTuningButton?.addEventListener("click", async () => {
    registerInteraction();
    if (!lineageService.isCreator) { ui.toast("Ajuste global de voz é exclusivo do criador.", "JORDAN VOICE"); return; }
    try {
      const next = ui.readVoiceTuning?.() || sharedVoiceTuning;
      sharedVoiceTuning = await lineageVoiceConfigService.save(next);
      voice.setSharedVoiceTuning(sharedVoiceTuning);
      ui.toast("Perfil de voz global salvo para toda a linhagem.", "JORDAN VOICE");
    } catch (error) { ui.toast(`Não consegui salvar a voz: ${error.message}`, "JORDAN VOICE"); }
  });

  ui.elements.testVoiceTuningButton?.addEventListener("click", async () => {
    registerInteraction();
    const local = ui.readVoiceTuning?.() || sharedVoiceTuning;
    voice.setSharedVoiceTuning(local);
    await voice.speak("Oi! Eu sou a JORDAN. Essa é a minha voz com os ajustes atuais!", { volume: assistantVolume, mood: "excited" });
    voice.setSharedVoiceTuning(sharedVoiceTuning);
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

  ui.elements.neuralVoiceToggle?.addEventListener("change", async (event) => {
    registerInteraction();
    neuralVoiceEnabled = Boolean(event.target.checked);
    await setSetting("neuralVoiceEnabled", neuralVoiceEnabled);
    voice.configureNeuralVoice({ enabled: neuralVoiceEnabled, endpoint: neuralVoiceEndpoint });
    await updateVoiceStatus({ force: true });
    ui.toast(neuralVoiceEnabled ? "JORDAN Voice Core ativado." : "Voice Core desativado. Vou usar o fallback do dispositivo.", "JORDAN VOICE");
  });

  ui.elements.deviceVoiceFallbackToggle?.addEventListener("change", async (event) => {
    registerInteraction();
    deviceVoiceFallbackEnabled = Boolean(event.target.checked);
    await setSetting("deviceVoiceFallbackEnabled", deviceVoiceFallbackEnabled);
    voice.setDeviceVoiceFallback(deviceVoiceFallbackEnabled);
    ui.toast(deviceVoiceFallbackEnabled
      ? "Contingência do dispositivo ativada. Ela só será usada se a voz neural falhar."
      : "Contingência desligada. Se o Voice Core cair, a JORDAN responde em texto em vez de trocar de voz.", "JORDAN VOICE");
  });

  ui.elements.musicDefaultSource?.addEventListener("change", async (event) => {
    musicDefaultSource = event.target.value === "jordan" ? "jordan" : "youtube";
    await setSetting("music.defaultSource", musicDefaultSource);
    ui.toast(musicDefaultSource === "youtube" ? "Pedidos de música vão para o YouTube por padrão." : "Pedidos de música usam a biblioteca JORDAN por padrão.", "JORDAN MUSIC");
  });

  ui.elements.saveVoiceEndpointButton?.addEventListener("click", async () => {
    registerInteraction();
    const value = ui.elements.neuralVoiceEndpoint?.value?.trim() || "http://127.0.0.1:8787";
    neuralVoiceEndpoint = value.replace(/\/+$/, "");
    localStorage.setItem("jordan.voice-endpoint-v1", neuralVoiceEndpoint);
    voice.configureNeuralVoice({ enabled: neuralVoiceEnabled, endpoint: neuralVoiceEndpoint });
    await updateVoiceStatus({ force: true });
    ui.toast("Endpoint da voz salvo neste perfil JORDAN.", "JORDAN VOICE");
  });

  ui.elements.checkVoiceCoreButton?.addEventListener("click", async () => {
    registerInteraction();
    ui.setNeuralVoiceStatus({ ok: false, enabled: neuralVoiceEnabled, reason: "checking" });
    const health = await voice.neuralVoiceHealth({ force: true });
    ui.setNeuralVoiceStatus({ ...health, enabled: neuralVoiceEnabled });
    ui.toast(health.ok ? "JORDAN Spark Neural V1 está respondendo." : "Voice Server não respondeu. A voz do dispositivo continuará como fallback.", "JORDAN VOICE");
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

  ui.elements.messageSendButton?.addEventListener("click", async () => {
    registerInteraction();
    const recipient = ui.elements.messageRecipient?.value || "";
    const text = ui.elements.messageInput?.value?.trim() || "";
    if (!recipient || !text) return;
    try {
      await messages.send(recipient, text);
      ui.elements.messageInput.value = "";
      ui.toast("Mensagem enviada.", "JORDAN MSG");
      await refreshMessagesView({ markSeen: false });
    } catch (error) {
      ui.toast(error.message, "JORDAN MSG");
    }
  });
  ui.elements.messageInput?.addEventListener("keydown", async (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      ui.elements.messageSendButton?.click();
    }
  });
  ui.elements.messageRefreshButton?.addEventListener("click", () => refreshMessagesView({ markSeen: true }));
  ui.elements.messageMarkReadButton?.addEventListener("click", async () => {
    await messages.markSeen();
    await refreshMessagesView({ markSeen: false });
  });

  ui.elements.calendarShortcut.addEventListener("click", () => {
    registerInteraction();
    ui.openView("calendar");
  });

  ui.elements.calendarPrevButton?.addEventListener("click", () => { registerInteraction(); ui.moveCalendarMonth(-1); });
  ui.elements.calendarNextButton?.addEventListener("click", () => { registerInteraction(); ui.moveCalendarMonth(1); });
  ui.elements.calendarTodayButton?.addEventListener("click", () => { registerInteraction(); ui.goCalendarToday(); });

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
  ui.elements.eventAllDay?.addEventListener("change", () => ui.syncEventModeFields());
  ui.elements.eventForm.addEventListener("submit", saveEventFromForm);
  ui.elements.deleteEventButton.addEventListener("click", deleteEventFromForm);

  ui.elements.closeEmergencyButton.addEventListener("click", () => ui.closeEmergencyPanel());
  ui.elements.closeTutorialButton.addEventListener("click", () => ui.closeTutorialPanel());

  ui.elements.voiceIdentityToggle?.addEventListener("change", async (event) => {
    registerInteraction();
    voiceIdentityEnabled = Boolean(event.target.checked);
    await setSetting("voiceIdentityEnabled", voiceIdentityEnabled);
    voiceIdentityService.setPolicy({ enabled: voiceIdentityEnabled, allowThirdPartyConversation });
    updateVoiceIdentityStatus();
    ui.toast(voiceIdentityEnabled
      ? "Voice Lock experimental ativado. Cadastre sua voz neste dispositivo antes de usar como trava."
      : "Voice Lock desativado.", "JORDAN VOICE LOCK");
  });

  ui.elements.thirdPartyConversationToggle?.addEventListener("change", async (event) => {
    allowThirdPartyConversation = Boolean(event.target.checked);
    await setSetting("allowThirdPartyConversation", allowThirdPartyConversation);
    voiceIdentityService.setPolicy({ enabled: voiceIdentityEnabled, allowThirdPartyConversation });
  });

  ui.elements.enrollVoiceButton?.addEventListener("click", async () => {
    registerInteraction();
    const wasAlwaysListening = voice.alwaysListening;
    voice.stop({ manual: false, clearPending: true });
    ui.elements.enrollVoiceButton.disabled = true;
    try {
      ui.toast("Fale naturalmente por 8 segundos. Exemplo: 'Jordan, sistema pronto. Hoje eu vou organizar minha agenda.'", "CADASTRO DE VOZ", 9000);
      updateVoiceIdentityStatus("Capturando voz · 0%");
      await voiceIdentityService.enroll({
        durationMs: 8000,
        onProgress: (value) => updateVoiceIdentityStatus(`Capturando voz · ${Math.round(value * 100)}%`)
      });
      const voiceprint = voiceIdentityService.exportProfile();
      if (voiceprint) await setSetting("voiceIdentityProfile", voiceprint);
      updateVoiceIdentityStatus("Ativo · perfil cadastrado e sincronizável");
      ui.toast("Perfil de voz cadastrado. A assinatura matemática pode acompanhar sua JORDAN ID sem enviar áudio bruto.", "JORDAN VOICE LOCK");
    } catch (error) {
      updateVoiceIdentityStatus(`Falha no cadastro · ${error.message}`);
      ui.toast(error.message, "JORDAN VOICE LOCK");
    } finally {
      ui.elements.enrollVoiceButton.disabled = false;
      if (wasAlwaysListening) voice.setAlwaysListening(true);
    }
  });

  ui.elements.clearVoiceProfileButton?.addEventListener("click", async () => {
    if (!window.confirm("Apagar o perfil de voz desta identidade?")) return;
    voiceIdentityService.clearProfile();
    await setSetting("voiceIdentityProfile", null);
    updateVoiceIdentityStatus();
  });

  ui.elements.refreshLineageMemoryButton?.addEventListener("click", () => refreshCreatorMemoryOverview());

  ui.elements.linkGoogleAccountButton?.addEventListener("click", async () => {
    registerInteraction();
    ui.elements.linkGoogleAccountButton.disabled = true;
    try {
      const user = await authService.linkGoogleToCurrentUser();
      ui.setAccountUser(user);
      ui.setAccountProviders(authService.providerSummary(user), authService.providerIds(user));
      ui.toast("Google vinculado ao mesmo Firebase UID. Você pode usar esta JORDAN ID em outros aparelhos.", "JORDAN ID");
    } catch (error) {
      ui.toast(friendlyAuthError(error), "JORDAN ID");
      ui.setAccountProviders(authService.providerSummary(), authService.providerIds());
    }
  });

  ui.elements.linkPasswordAccountButton?.addEventListener("click", async () => {
    registerInteraction();
    const password = ui.elements.linkPasswordInput?.value || "";
    ui.elements.linkPasswordAccountButton.disabled = true;
    try {
      const user = await authService.linkPasswordToCurrentUser(password);
      if (ui.elements.linkPasswordInput) ui.elements.linkPasswordInput.value = "";
      ui.setAccountUser(user);
      ui.setAccountProviders(authService.providerSummary(user), authService.providerIds(user));
      ui.toast("Senha vinculada ao mesmo UID. Agora este e-mail + senha pode entrar em outros dispositivos.", "JORDAN ID");
    } catch (error) {
      ui.toast(friendlyAuthError(error), "JORDAN ID");
      ui.setAccountProviders(authService.providerSummary(), authService.providerIds());
    }
  });

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

function formatBriefEvent(event) {
  if (event?.allDay) return `${event.title} (dia inteiro)`;
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(event.startAt));
  return `${event.title} às ${time}`;
}

async function refreshMessagesView({ markSeen = false } = {}) {
  try {
    const items = await messages.inbox({ includeSent: true });
    ui.renderMessages?.(items, lineageService.currentIdentity?.id || null);
    if (markSeen) await messages.markSeen();
    const unread = await messages.unreadCount();
    ui.setMessageUnreadCount?.(unread);
    ui.setMessageRecipients?.(messages.recipientOptions());
    return items;
  } catch (error) {
    console.warn("JORDAN Messages:", error);
    ui.renderMessages?.([], lineageService.currentIdentity?.id || null, error.message);
    return [];
  }
}

async function buildMorningBriefing() {
  const name = lineageService.currentIdentity?.firstName || (await memory.get("profile.name"))?.value || "";
  const events = await calendar.today().catch(() => []);
  const messageSummary = await messages.summary({ max: 3, markSeen: false }).catch(() => ({ count: 0, text: "Não consegui conferir as mensagens agora." }));
  const greeting = `Bom dia${name ? `, ${name}` : ""}!`;

  let agendaText = "Sua agenda está livre hoje.";
  if (events.length) {
    const shown = events.slice(0, 4).map(formatBriefEvent);
    const rest = events.length - shown.length;
    agendaText = `Hoje você tem ${events.length} ${events.length === 1 ? "compromisso" : "compromissos"}: ${shown.join("; ")}${rest > 0 ? `; e mais ${rest}` : ""}.`;
  }

  const messagesText = messageSummary.count ? messageSummary.text : "Você não tem mensagens novas.";
  return `${greeting} ${agendaText} ${messagesText}`;
}

async function handleCommand(text, { fromVoice = false, speaker = null, recognitionMeta = {} } = {}) {
  registerInteraction();

  if (voice.isSpeaking) voice.cancelSpeech({ resumeListening: false });

  if (presence.sleeping) {
    if (presence.isWake(text)) {
      await presence.wake();
      ui.setPresenceState?.(presence.state());
      const msg = await buildMorningBriefing();
      ui.addMessage("VOCÊ", text); ui.addMessage("JORDAN", msg);
      await refreshMessagesView({ markSeen: false });
      if (voiceEnabled) await voice.speak(msg, { volume: assistantVolume, mood: "happy" });
      if (voice.alwaysListening) setTimeout(() => voice.start({ always: true }), 150);
      return;
    }
    if (presence.isEmergency(text)) {
      const canUsePrivatePriority = !fromVoice || !voiceIdentityEnabled || speaker?.authorized;
      const number = canUsePrivatePriority ? await assistant.getHelpNumber() : "190";
      ui.addMessage("VOCÊ", text);
      ui.addMessage("JORDAN", `Emergência detectada. Abri o acesso de ajuda para ${number}.`);
      ui.openEmergencyPanel(number);
      if (voiceEnabled) await voice.speak(`Emergência detectada. Acesso de ajuda ${number}.`, { volume: assistantVolume, mood: "serious" });
      return;
    }
    ui.setStatus("SLEEP MODE · aguardando ‘Bom dia’ ou ‘Socorro’");
    return;
  }

  if (presence.isWake(text)) {
    const msg = await buildMorningBriefing();
    ui.addMessage("VOCÊ", text);
    ui.addMessage("JORDAN", msg);
    await refreshMessagesView({ markSeen: false });
    if (voiceEnabled) await voice.speak(msg, { volume: assistantVolume, mood: "happy" });
    return;
  }

  if (presence.isSleep(text)) {
    await presence.enterSleep(); ui.setPresenceState?.(presence.state());
    ui.addMessage("VOCÊ", text); ui.addMessage("JORDAN", "Boa noite. Vou ficar em modo sono. Se precisar, diga ‘Bom dia’ ou ‘Socorro’. ");
    if (voiceEnabled) await voice.speak("Boa noite. Vou ficar em modo sono. Se precisar, diga bom dia ou socorro.", { volume: assistantVolume, mood: "soft" });
    return;
  }

  if (presence.isSilence(text)) {
    voice.cancelSpeech({ resumeListening: false });
    await presence.enterSilence(); ui.setPresenceState?.(presence.state());
    ui.addMessage("VOCÊ", text); ui.addMessage("JORDAN", "SILENCE MODE");
    ui.setStatus("SILENCE MODE · aguardando interação do usuário");
    if (voice.alwaysListening) setTimeout(() => voice.start({ always: true }), 120);
    return;
  }

  if (presence.silent) { await presence.clearSilence(); ui.setPresenceState?.(presence.state()); }
  const schedulePresence = await presence.parseSchedule(text);
  if (schedulePresence?.handled) {
    ui.addMessage("VOCÊ", text); ui.addMessage("JORDAN", schedulePresence.text);
    if (voiceEnabled) await voice.speak(schedulePresence.text, { volume: assistantVolume, mood: "neutral" });
    ui.setPresenceState?.(presence.state());
    return;
  }

  ui.addMessage("VOCÊ", text);
  ui.setInterimTranscript("");
  ui.setStatus("Processando...");
  telemetry.setExecution("processing");
  const visualKind = ui.pulseCommand(text, "start");
  if (["research","navigation","system","music","calendar","science"].includes(visualKind)) {
    ui.playCinematic(visualKind, visualKind.toUpperCase(), "Comando recebido · analisando intenção", 420);
  }

  if (fromVoice && voiceIdentityEnabled && speaker?.state === "guest" && !speaker?.authorized) {
    const score = Math.round((speaker?.score || 0) * 100);

    if (!allowThirdPartyConversation) {
      const message = speaker?.reason === "no-profile"
        ? "O Voice Lock está ativo, mas a voz autorizada ainda não foi cadastrada neste dispositivo. Use SYS para fazer o cadastro."
        : `Essa voz não correspondeu ao perfil autorizado${score ? ` (${score}% de similaridade experimental)` : ""}. Conversas de terceiros estão desligadas.`;
      ui.addMessage("JORDAN", message);
      ui.setStatus("VOICE LOCK · ACESSO BLOQUEADO");
      telemetry.setExecution("idle");
      if (voiceEnabled && voice.synthesisSupported) {
        const profile = assistant.getPersonality();
        await voice.speak(message, { volume: assistantVolume, rate: profile.voice.rate, pitch: profile.voice.pitch, mood: "serious" });
      }
      return;
    }

    // Terceiros entram em uma rota separada e estritamente read-only. Não importa
    // se uma frase escapa do regex de comandos: ela nunca chega ao execute() normal.
    const readOnlyResult = await assistant.executeReadOnly(text, recognitionMeta);
    ui.addMessage("JORDAN", readOnlyResult.text);
    ui.setStatus("VOICE LOCK · CONVERSA DE TERCEIRO");

    if (readOnlyResult.sourceUrl) {
      ui.addSourceLink(readOnlyResult.sourceTitle || "Pesquisa", readOnlyResult.sourceUrl, readOnlyResult.source || "WEB");
    }

    if (voiceEnabled && voice.synthesisSupported && readOnlyResult.speak) {
      const profile = assistant.getPersonality();
      await voice.speak(readOnlyResult.speak, {
        volume: assistantVolume,
        rate: profile.voice.rate,
        pitch: profile.voice.pitch,
        mood: readOnlyResult.mood || "neutral",
        language: readOnlyResult.language || "pt"
      });
    } else {
      ui.setStatus("Sistema pronto.");
    }

    telemetry.setExecution("idle");
    resetIdleTimer();
    return;
  }

  try {
    const systemCommand = matchSystemCommand(text);
    if (systemCommand) {
      await executeSystemCommand(systemCommand);
      return;
    }

    const result = await assistant.execute(text, { source: fromVoice ? "voice" : "typed", confidence: fromVoice ? Number(recognitionMeta?.confidence || 0) : 1 });
    ui.addMessage("JORDAN", result.text);

    if (result.refreshAgenda) {
      await Promise.all([ui.renderToday(), ui.renderNext(), ui.renderAgenda(), ui.renderMonthGrid(), ui.renderSelectedDay()]);
    }

    if (result.refreshMemory) await ui.renderMemory();

    if (result.action === "stop-speaking") {
      voice.cancelSpeech({ resumeListening: voice.alwaysListening });
      ui.setStatus("Fala interrompida.");
      return;
    }
    if (result.action === "open-view" && result.view) {
      ui.openView(result.view);
      if (result.view === "messages") await refreshMessagesView({ markSeen: true }).catch(console.warn);
    }
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
    if (result.action === "open-youtube-music") {
      const query = String(result.query || "").trim();
      const url = query
        ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
        : "https://www.youtube.com/";
      const popup = window.open(url, "_blank", "noopener,noreferrer");
      if (!popup) ui.addExternalLink("ABRIR YOUTUBE", url, "JORDAN MUSIC");
    }
    if (result.refreshMessages || result.action === "message-sent") {
      await refreshMessagesView({ markSeen: false }).catch(console.warn);
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
    ui.pulseCommand(text, "done");
    if (!voice.isSpeaking) telemetry.setExecution("idle");
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
    if (!lineageService.isCreator) {
      ui.toast("A memória continua ativa em segundo plano. A visualização administrativa é exclusiva do criador.", "JORDAN MEMORY");
      return;
    }
    ui.openView("memory");
    ui.toast("Console de memória da linhagem aberto.");
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
  if (!profile || !["extroverted", "playful"].includes(profile.id)) return;
  const delay = 65000 + Math.floor(Math.random() * 35000);
  idleTimer = setTimeout(async () => {
    if (presence.sleeping || presence.silent) return resetIdleTimer();
    if (document.visibilityState !== "visible" || voice.isSpeaking || document.querySelector("dialog[open]")) return resetIdleTimer();
    if (!voice.heardRecentSound?.(12000)) return resetIdleTimer();
    const prompt = "Tem alguém aí?";
    ui.addMessage("JORDAN", prompt);
    if (voiceEnabled && voice.synthesisSupported) await voice.speak(prompt, { volume: assistantVolume, mood: "curious" });
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
  const duration = Number(ui.elements.eventDuration.value || 60);
  const description = ui.elements.eventDescription.value.trim();
  const allDay = Boolean(ui.elements.eventAllDay?.checked);
  const yearly = Boolean(ui.elements.eventYearly?.checked);
  if (!title || !date || (!allDay && !time)) return;

  const startAt = allDay ? new Date(`${date}T00:00:00`) : new Date(`${date}T${time}:00`);
  const endAt = allDay
    ? new Date(startAt.getTime() + 86400000)
    : new Date(startAt.getTime() + duration * 60000);
  const profile = detectEventProfile(`${title} ${description}`);
  const recurrence = yearly ? { frequency: "yearly", interval: 1 } : null;

  if (id) {
    await calendar.update(id, { title, description, startAt, endAt, category: profile.id, allDay, recurrence });
    ui.addMessage("JORDAN", `Atualizei o compromisso “${title}”.${yearly ? " Ele se repete todo ano." : ""}`);
  } else {
    const conflicts = allDay ? [] : await calendar.conflicts(startAt, endAt);
    await calendar.create({
      title,
      description,
      startAt,
      endAt,
      source: "manual",
      category: profile.id,
      allDay,
      recurrence
    });
    let message = `Adicionei “${title}” à minha agenda.${allDay ? " Como evento de dia inteiro." : ""}${yearly ? " Vai se repetir todo ano." : ""}`;
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

async function presentAuthenticatedIdentity(user) {
  const identity = await lineageService.loadCurrentIdentity();
  if (!identity) {
    ui.showAuthGate("Conta autenticada. Agora vincule sua identidade da linhagem.");
    if (!lineageService.familyGatePassed()) {
      ui.setAuthStage("family");
      ui.setAuthMessage("Confirme a senha da linhagem antes de escolher uma identidade.");
    } else {
      selectedLineageIdentityId = null;
      ui.renderIdentityChoices(listLineageMembers());
      ui.setAuthStage("identity");
      ui.setAuthMessage("Selecione seu nome e confirme o segundo nome.");
    }
    ui.setAuthBusy(false);
    return false;
  }

  ui.setLineageIdentity(identity);
  ui.setCreatorMode(lineageService.isCreator);
  voiceIdentityService.setIdentity(identity.id);
  ui.setAccountUser(user);
  ui.setAccountProviders(authService.providerSummary(user), authService.providerIds(user));
  ui.setAuthMessage(`${identity.firstName} reconhecido. Carregando sua JORDAN...`, "success");

  try {
    await initialize();
    await ui.playCinematic("boot", `BEM-VINDO, ${identity.firstName.toUpperCase()}`, "Voice · Memory · Cloud · Command Core online", 880);
    ui.hideAuthGate();
    return true;
  } catch (error) {
    console.error("JORDAN boot:", error);
    if (isStartupCloudError(error)) {
      cloudState = { ...cloudState, fromCache: true, pending: true, error };
      ui.setCloudStatus(cloudState);
      ui.hideAuthGate();
      ui.toast("Cloud temporariamente indisponível. A JORDAN abriu em contingência e sincronizará quando possível.", "JORDAN CLOUD");
      return true;
    }
    jordanInitialized = false;
    ui.showAuthGate();
    ui.setAuthMessage(`Falha ao iniciar a JORDAN: ${error.message}`, "error");
    return false;
  }
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

  ui.elements.familyGateForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    ui.setAuthBusy(true);
    ui.setAuthMessage("Validando chave da linhagem...");
    try {
      const ok = await lineageService.verifyFamilyPin(ui.elements.familyGatePassword?.value || "");
      if (!ok) {
        ui.setAuthMessage("Senha da linhagem incorreta.", "error");
        return;
      }
      if (ui.elements.familyGatePassword) ui.elements.familyGatePassword.value = "";
      ui.setAuthMessage("Gateway da linhagem liberado.", "success");
      if (authService.currentUser) {
        selectedLineageIdentityId = null;
        ui.renderIdentityChoices(listLineageMembers());
        ui.setAuthStage("identity");
      } else {
        ui.setAuthStage("account");
        ui.setAuthMode("login");
      }
    } finally {
      ui.setAuthBusy(false);
    }
  });

  ui.elements.authLoginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    ui.setAuthBusy(true);
    ui.setAuthMessage("Autenticando acesso individual...");
    try {
      await authService.loginEmail(
        ui.elements.authLoginEmail.value,
        ui.elements.authLoginPassword.value,
        { remember: ui.elements.authRememberLogin.checked }
      );
      ui.setAuthMessage("Conta confirmada. Verificando identidade da linhagem...", "success");
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
    ui.setAuthMessage("Criando acesso individual...");
    try {
      await authService.createAccount({
        name: "JORDAN Member",
        email: ui.elements.authRegisterEmail.value,
        password,
        remember: true
      });
      ui.setAuthMessage("Conta criada. Agora confirme quem você é na linhagem.", "success");
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
      const result = await authService.loginGoogle({ remember: ui.elements.authRememberLogin?.checked !== false });
      if (result?.redirected) ui.setAuthMessage("Redirecionando para o Google...");
    } catch (error) {
      ui.setAuthMessage(friendlyAuthError(error), "error");
      ui.setAuthBusy(false);
    }
  });

  ui.elements.identityChoiceGrid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-identity-id]");
    if (!button) return;
    selectedLineageIdentityId = button.dataset.identityId;
    document.querySelectorAll(".identity-choice").forEach((item) => item.classList.toggle("active", item === button));
    if (ui.elements.identityConfirmButton) ui.elements.identityConfirmButton.disabled = false;
    ui.elements.identityConfirmation?.focus();
  });

  ui.elements.identityConfirmButton?.addEventListener("click", async () => {
    if (!selectedLineageIdentityId) return;

    const confirmation = ui.elements.identityConfirmation?.value || "";
    if (!lineageService.validateConfirmation(selectedLineageIdentityId, confirmation)) {
      ui.setAuthMessage("O segundo nome não corresponde à identidade selecionada.", "error");
      ui.elements.identityConfirmation?.focus();
      return;
    }

    ui.setAuthBusy(true);
    ui.setIdentityBindProgress("Conectando ao Cloud Core…", 8, true);
    ui.setAuthMessage("Confirmando identidade sem bloquear a interface...");

    try {
      const identity = await lineageService.claimIdentity(
        selectedLineageIdentityId,
        confirmation,
        {
          onProgress: (message, percent) => {
            ui.setIdentityBindProgress(message, percent, true);
            ui.setAuthMessage(message);
          }
        }
      );

      ui.setIdentityBindProgress("Vínculo confirmado.", 100, true);
      ui.setLineageIdentity(identity);
      ui.setAuthMessage(`${identity.firstName} confirmado. Abrindo sua JORDAN...`, "success");

      // Display name é complementar; nunca pode prender o fluxo de entrada.
      authService.setDisplayName(identity.firstName).catch((error) => {
        console.warn("JORDAN displayName:", error);
      });

      jordanInitialized = false;
      ui.setAuthBusy(false);
      await presentAuthenticatedIdentity(authService.currentUser);
    } catch (error) {
      console.error("JORDAN identity bind:", error);
      ui.setIdentityBindProgress("Vínculo não concluído.", 0, false);
      ui.setAuthMessage(error.message || "Não consegui vincular essa identidade.", "error");
    } finally {
      ui.setAuthBusy(false);
      setTimeout(() => ui.setIdentityBindProgress("", 0, false), 900);
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
      ui.toast("Sem internet agora. O Firestore sincronizará automaticamente quando a conexão voltar.", "JORDAN CLOUD");
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
        ui.toast("Ainda não recebi confirmação do Firestore. Mantive tudo no cache.", "JORDAN CLOUD");
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
    const confirmed = window.confirm("Sair desta identidade JORDAN neste dispositivo?");
    if (!confirmed) return;
    try {
      voice.stop?.({ manual: true, clearPending: true });
      voice.cancelSpeech?.({ resumeListening: false });
      voiceIdentityService.stopMonitoring();
      telemetry.stop();
      reminders.stop();
      cloudUnsubscribe?.();
      cloudUnsubscribe = null;
      lineageService.clearFamilyGate();
      await authService.logout();
      window.location.reload();
    } catch (error) {
      ui.toast(friendlyAuthError(error), "JORDAN ID");
    }
  });
}

async function boot() {
  bindAuthEvents();
  ui.showAuthGate("Inicializando protocolo da linhagem...");
  ui.setAuthStage("family");
  ui.renderIdentityChoices(listLineageMembers());

  try {
    await authService.waitUntilReady();
    await authService.consumeRedirectResult();
  } catch (error) {
    ui.setAuthMessage(friendlyAuthError(error), "error");
  }

  authService.watch(async (user) => {
    if (!user) {
      jordanInitialized = false;
      ui.showAuthGate();
      ui.setAuthBusy(false);
      if (lineageService.familyGatePassed()) {
        ui.setAuthStage("account");
        ui.setAuthMode("login");
        ui.setAuthMessage("Gateway liberado. Entre com seu acesso individual ou Google.");
      } else {
        ui.setAuthStage("family");
        ui.setAuthMessage("Digite a senha da linhagem para continuar.");
      }
      return;
    }

    await presentAuthenticatedIdentity(user);
  });
}

boot();
