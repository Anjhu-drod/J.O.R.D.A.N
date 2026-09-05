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
import { ManualCoreService } from "./manualCoreService.js";
import { JordanChessService, coordToSquare } from "./jordanChessService.js";
import { safeCalculate } from "./mathService.js";
import { NativeBridgeService } from "./nativeBridgeService.js";
import { LocalReasoningService } from "./localReasoningService.js";
import { GeneralKnowledgeService } from "./generalKnowledgeService.js";
import { AutomationCoreService } from "./automationCoreService.js";

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
const manualCore = new ManualCoreService();
const chess = new JordanChessService();
const nativeBridge = new NativeBridgeService();
const localReasoning = new LocalReasoningService();
const generalKnowledge = new GeneralKnowledgeService();
const automation = new AutomationCoreService(nativeBridge);
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
let theme = "nova";
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
let manualCoreEnabled = true;
let chessSelectedSquare = null;
let chessLegalTargets = [];
let chessFlipped = false;
let chessThinking = false;
let automationRuntimeTimer = null;

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

  const nativeStatus = await nativeBridge.init().catch((error) => ({ native: false, platform: "web", lastError: error.message }));
  ui.setNativeRuntimeStatus?.(nativeStatus);
  const automationSnapshot = await automation.init().catch((error) => ({
    capabilities: { platform: nativeStatus.platform || "web", native: nativeStatus.native, global_input: false, reason: error.message },
    runtime: { running: false, count: 0 }
  }));
  applyAutomationSnapshot(automationSnapshot);
  startAutomationRuntimePolling();
  localReasoning.status().then(async (status) => {
    ui.setLocalReasoningStatus?.(status);
    if (status?.availability === "available" && !status?.ready) {
      const prepared = await localReasoning.prepare().catch(() => null);
      if (prepared) ui.setLocalReasoningStatus?.(prepared);
    }
  }).catch(() => null);

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
  theme = await startupCloudValue("theme", () => getSetting("theme", "nova"), "nova");
  voiceIdentityEnabled = await startupCloudValue("voiceIdentityEnabled", () => getSetting("voiceIdentityEnabled", false), false);
  allowThirdPartyConversation = await startupCloudValue("allowThirdPartyConversation", () => getSetting("allowThirdPartyConversation", true), true);
  neuralVoiceEnabled = await startupCloudValue("neuralVoiceEnabled", () => getSetting("neuralVoiceEnabled", true), true);
  deviceVoiceFallbackEnabled = await startupCloudValue("deviceVoiceFallbackEnabled", () => getSetting("deviceVoiceFallbackEnabled", true), true);
  manualCoreEnabled = await startupCloudValue("manualCoreEnabled", () => getSetting("manualCoreEnabled", true), true);
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
  manualCore.configure({ enabled: manualCoreEnabled });
  voice.setDeviceVoiceFallback(deviceVoiceFallbackEnabled);
  voice.setLanguageMode(languageMode);
  assistant.setResponseLanguage?.(languageMode);
  internet.setEnabled(internetEnabled);
  ui.setTheme(theme);

  const savedChessState = await startupCloudValue("chess.localState", () => getSetting("chess.localState", null), null);
  if (savedChessState) chess.load(savedChessState);
  chessFlipped = chess.playerColor === "b";
  renderChess();
  if (chess.status === "playing" && chess.turn === chess.jordanColor) {
    window.setTimeout(() => scheduleJordanChessMove().catch(console.warn), 450);
  }

  if (ui.elements.languageModeSelect) ui.elements.languageModeSelect.value = languageMode;
  if (ui.elements.themeSelect) ui.elements.themeSelect.value = theme;
  if (ui.elements.voiceIdentityToggle) ui.elements.voiceIdentityToggle.checked = voiceIdentityEnabled;
  if (ui.elements.thirdPartyConversationToggle) ui.elements.thirdPartyConversationToggle.checked = allowThirdPartyConversation;
  if (ui.elements.neuralVoiceToggle) ui.elements.neuralVoiceToggle.checked = neuralVoiceEnabled;
  if (ui.elements.deviceVoiceFallbackToggle) ui.elements.deviceVoiceFallbackToggle.checked = deviceVoiceFallbackEnabled;
  if (ui.elements.manualCoreToggle) ui.elements.manualCoreToggle.checked = manualCoreEnabled;
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
  updateManualCoreStatus();
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

function updateManualCoreStatus() {
  if (!ui.elements.manualCoreStatus) return;
  const health = manualCore.health();
  ui.setManualCoreStatus?.({ ...health, enabled: manualCoreEnabled });
}


function automationActionFromUi() {
  const kind = ui.elements.automationActionSelect?.value || "mouse_left";
  return {
    kind,
    key: ui.elements.automationKeyInput?.value?.trim() || "j",
    fixedPoint: kind === "screen_tap" || Boolean(ui.elements.automationFixedPointToggle?.checked),
    x: Number(ui.elements.automationPointX?.value || 0),
    y: Number(ui.elements.automationPointY?.value || 0)
  };
}

function syncAutomationFieldVisibility() {
  const kind = ui.elements.automationActionSelect?.value || "mouse_left";
  const keyMode = kind === "key";
  const fixedMode = kind === "screen_tap" || Boolean(ui.elements.automationFixedPointToggle?.checked);
  if (ui.elements.automationKeyField) ui.elements.automationKeyField.classList.toggle("automation-field-muted", !keyMode);
  if (ui.elements.automationKeyInput) ui.elements.automationKeyInput.disabled = !keyMode;
  if (ui.elements.automationFixedPointToggle) {
    ui.elements.automationFixedPointToggle.disabled = kind === "screen_tap";
    if (kind === "screen_tap") ui.elements.automationFixedPointToggle.checked = true;
  }
  if (ui.elements.automationPointX) ui.elements.automationPointX.disabled = !fixedMode;
  if (ui.elements.automationPointY) ui.elements.automationPointY.disabled = !fixedMode;
}

function renderAutomationMacros() {
  const snapshot = automation.snapshot();
  ui.renderAutomationMacros?.(snapshot.macros, (action) => automation.describeAction(action));
}

function applyAutomationSnapshot(snapshot = automation.snapshot()) {
  const state = snapshot?.enabled === undefined ? automation.snapshot() : snapshot;
  const action = state.action || automation.state?.action || { kind: "mouse_left", key: "j", fixedPoint: false, x: 0, y: 0 };

  if (ui.elements.automationCoreToggle) ui.elements.automationCoreToggle.checked = state.enabled !== false;
  if (ui.elements.automationVoiceMacrosToggle) ui.elements.automationVoiceMacrosToggle.checked = state.voiceMacrosEnabled !== false;
  if (ui.elements.automationSilentMacrosToggle) ui.elements.automationSilentMacrosToggle.checked = state.silentVoiceMacros !== false;
  if (ui.elements.automationActionSelect) ui.elements.automationActionSelect.value = action.kind || "mouse_left";
  if (ui.elements.automationIntervalMs) ui.elements.automationIntervalMs.value = String(state.intervalMs || 250);
  if (ui.elements.automationKeyInput) ui.elements.automationKeyInput.value = action.key || "j";
  if (ui.elements.automationFixedPointToggle) ui.elements.automationFixedPointToggle.checked = Boolean(action.fixedPoint || action.kind === "screen_tap");
  if (ui.elements.automationPointX) ui.elements.automationPointX.value = String(Number(action.x || 0));
  if (ui.elements.automationPointY) ui.elements.automationPointY.value = String(Number(action.y || 0));

  const caps = state.capabilities || automation.capabilities || {};
  if (ui.elements.automationPlatformNote) {
    if (caps.platform === "windows" && caps.global_input) {
      ui.elements.automationPlatformNote.textContent = "Windows nativo: mouse, teclado, combinações e coordenadas funcionam globalmente pelo SendInput. Para parar a qualquer momento, use PARAR ou diga ‘parar autoclick’.";
    } else if (caps.platform === "android") {
      ui.elements.automationPlatformNote.textContent = "Android: a interface e os comandos já ficam salvos, mas tocar em outros apps exige um Accessibility Service com permissão explícita do usuário. Esse bridge móvel ainda não está ativado nesta build.";
    } else if (caps.platform === "ios") {
      ui.elements.automationPlatformNote.textContent = "iPhone: a JORDAN pode automatizar a própria interface e ações permitidas pelo iOS, mas um app comum não pode injetar toques arbitrários em outros aplicativos.";
    } else {
      ui.elements.automationPlatformNote.textContent = "No site, a JORDAN não pode enviar cliques/teclas globais. Instale a versão Windows para liberar o Automation Core do sistema.";
    }
  }

  syncAutomationFieldVisibility();
  renderAutomationMacros();
  ui.setAutomationCoreStatus?.({ ...state, capabilities: caps, runtime: state.runtime || automation.runtime || {} });
}

async function refreshAutomationRuntime() {
  const runtime = await automation.refreshRuntime().catch(() => automation.runtime);
  ui.setAutomationCoreStatus?.({ ...automation.snapshot(), runtime });
  return runtime;
}

function startAutomationRuntimePolling() {
  clearInterval(automationRuntimeTimer);
  automationRuntimeTimer = setInterval(() => {
    if (!automation.runtime?.running && document.hidden) return;
    refreshAutomationRuntime().catch(() => null);
  }, 800);
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
      if (button.dataset.viewTarget === "games") renderChess();
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

  ui.elements.chessDifficulty?.addEventListener("change", (event) => {
    registerInteraction();
    chess.setDifficulty(event.target.value);
    persistChess();
    renderChess();
    ui.toast(`Xadrez: dificuldade ${event.target.selectedOptions[0]?.textContent || event.target.value}.`, "JORDAN ARENA");
  });

  ui.elements.chessNewGameButton?.addEventListener("click", async () => {
    registerInteraction();
    await startChessGame({ difficulty: ui.elements.chessDifficulty?.value || chess.difficulty, playerColor: "w", open: true });
    ui.toast("Nova partida iniciada. Você joga com as brancas.", "JORDAN ARENA");
  });

  ui.elements.chessUndoButton?.addEventListener("click", () => {
    registerInteraction();
    if (chessThinking) return;
    const state = chess.publicState();
    const plies = state.turn === state.playerColor ? 2 : 1;
    if (chess.undo(plies)) {
      chessSelectedSquare = null;
      chessLegalTargets = [];
      persistChess();
      renderChess();
    }
  });

  ui.elements.chessFlipButton?.addEventListener("click", () => {
    registerInteraction();
    chessFlipped = !chessFlipped;
    renderChess();
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

  ui.elements.manualCoreToggle?.addEventListener("change", async (event) => {
    registerInteraction();
    manualCoreEnabled = Boolean(event.target.checked);
    await setSetting("manualCoreEnabled", manualCoreEnabled);
    manualCore.configure({ enabled: manualCoreEnabled });
    manualCore.resetConversation();
    updateManualCoreStatus();
    ui.toast(manualCoreEnabled
      ? "Manual Core ativado. O cérebro local voltou a interpretar contexto e acionar ferramentas."
      : "Manual Core desativado. A JORDAN continuará apenas com os módulos especializados antigos.", "JORDAN MANUAL CORE");
  });

  ui.elements.resetManualConversationButton?.addEventListener("click", () => {
    registerInteraction();
    manualCore.resetConversation();
    updateManualCoreStatus();
    ui.toast("Contexto de conversa do Manual Core reiniciado. Memórias, calendário e xadrez foram preservados.", "JORDAN MANUAL CORE");
  });

  ui.elements.checkManualCoreButton?.addEventListener("click", async () => {
    registerInteraction();
    ui.setManualCoreStatus?.({ ok: false, enabled: manualCoreEnabled, reason: "checking" });
    const health = await manualCore.diagnose();
    ui.setManualCoreStatus?.({ ...health, enabled: manualCoreEnabled });
    ui.toast(health.ok
      ? `Manual Core local aprovado · ${health.passed}/${health.total} testes internos. Não usa API.`
      : `O Manual Core encontrou uma falha interna · ${health.passed}/${health.total} testes passaram.`, "JORDAN MANUAL CORE", 8000);
  });

  ui.elements.nativeAutostartToggle?.addEventListener("change", async (event) => {
    registerInteraction();
    const desired = Boolean(event.target.checked);
    const result = await nativeBridge.setAutostart(desired).catch((error) => ({ ok: false, reason: error.message }));
    if (!result.ok) {
      event.target.checked = false;
      ui.toast("Inicialização automática só fica disponível no app nativo de desktop.", "JORDAN NATIVE");
    } else {
      ui.setNativeRuntimeStatus?.(nativeBridge.status());
      ui.toast(result.enabled ? "JORDAN configurada para iniciar com o sistema." : "Inicialização automática desativada.", "JORDAN NATIVE");
    }
  });

  ui.elements.minimizeJordanButton?.addEventListener("click", async () => {
    registerInteraction();
    const result = await nativeBridge.minimize();
    if (!result.ok) ui.toast("Minimizar por comando nativo só funciona na versão instalada.", "JORDAN NATIVE");
  });

  ui.elements.backgroundJordanButton?.addEventListener("click", async () => {
    registerInteraction();
    const result = await nativeBridge.hideToBackground();
    if (!result.ok) ui.toast("Segundo plano nativo só funciona na versão instalada.", "JORDAN NATIVE");
  });

  ui.elements.automationCoreToggle?.addEventListener("change", async (event) => {
    registerInteraction();
    automation.configure({ enabled: Boolean(event.target.checked) });
    if (!event.target.checked && automation.runtime?.running) await automation.stop().catch(() => null);
    applyAutomationSnapshot();
    ui.toast(event.target.checked ? "Automation Core ativado." : "Automation Core desativado.", "JORDAN AUTOMATION");
  });

  ui.elements.automationVoiceMacrosToggle?.addEventListener("change", (event) => {
    registerInteraction();
    automation.configure({ voiceMacrosEnabled: Boolean(event.target.checked) });
    applyAutomationSnapshot();
  });

  ui.elements.automationSilentMacrosToggle?.addEventListener("change", (event) => {
    registerInteraction();
    automation.configure({ silentVoiceMacros: Boolean(event.target.checked) });
    applyAutomationSnapshot();
  });

  ui.elements.automationActionSelect?.addEventListener("change", () => {
    registerInteraction();
    automation.setAction(automationActionFromUi());
    syncAutomationFieldVisibility();
  });
  ui.elements.automationFixedPointToggle?.addEventListener("change", () => {
    automation.setAction(automationActionFromUi());
    syncAutomationFieldVisibility();
  });
  ui.elements.automationKeyInput?.addEventListener("change", () => automation.setAction(automationActionFromUi()));
  ui.elements.automationPointX?.addEventListener("change", () => automation.setAction(automationActionFromUi()));
  ui.elements.automationPointY?.addEventListener("change", () => automation.setAction(automationActionFromUi()));
  ui.elements.automationIntervalMs?.addEventListener("change", (event) => {
    const interval = automation.setInterval(event.target.value);
    event.target.value = String(interval);
  });

  ui.elements.automationCaptureCursorButton?.addEventListener("click", async () => {
    registerInteraction();
    const result = await automation.captureCursor();
    if (!result.ok) {
      ui.toast(result.reason || "Não consegui ler a posição do cursor.", "JORDAN AUTOMATION", 7000);
      return;
    }
    applyAutomationSnapshot();
    ui.toast(`Posição capturada: X${result.x} Y${result.y}.`, "JORDAN AUTOMATION");
  });

  ui.elements.automationTestButton?.addEventListener("click", async () => {
    registerInteraction();
    automation.setAction(automationActionFromUi());
    const result = await automation.executeOnce();
    await refreshAutomationRuntime();
    ui.toast(result.ok ? `Executado: ${automation.describeAction()}.` : `Não consegui executar: ${result.reason || "ação indisponível"}`, "JORDAN AUTOMATION", 7000);
  });

  ui.elements.automationStartButton?.addEventListener("click", async () => {
    registerInteraction();
    const action = automationActionFromUi();
    const intervalMs = Number(ui.elements.automationIntervalMs?.value || 250);
    const result = await automation.start({ action, intervalMs });
    await refreshAutomationRuntime();
    ui.toast(result.ok
      ? `Autoclique iniciado: ${automation.describeAction(action)} a cada ${automation.state.intervalMs} ms.`
      : `Não consegui iniciar: ${result.reason || "Automation Core indisponível"}`, "JORDAN AUTOMATION", 8000);
  });

  ui.elements.automationStopButton?.addEventListener("click", async () => {
    registerInteraction();
    await automation.stop().catch(() => null);
    await refreshAutomationRuntime();
    ui.toast("Autoclique parado.", "JORDAN AUTOMATION");
  });

  ui.elements.automationMacroAction?.addEventListener("change", (event) => {
    if (ui.elements.automationMacroValue) {
      ui.elements.automationMacroValue.disabled = event.target.value !== "key";
      ui.elements.automationMacroValue.placeholder = event.target.value === "key" ? "tecla: j" : "não precisa";
    }
  });

  ui.elements.automationMacroAddButton?.addEventListener("click", () => {
    registerInteraction();
    try {
      const kind = ui.elements.automationMacroAction?.value || "key";
      const macro = automation.addMacro({
        phrase: ui.elements.automationMacroPhrase?.value || "",
        action: { kind, key: kind === "key" ? (ui.elements.automationMacroValue?.value || "j") : "" }
      });
      if (ui.elements.automationMacroPhrase) ui.elements.automationMacroPhrase.value = "";
      renderAutomationMacros();
      ui.toast(`Atalho criado: “${macro.phrase}” → ${automation.describeAction(macro.action)}.`, "JORDAN AUTOMATION");
    } catch (error) {
      ui.toast(error.message, "JORDAN AUTOMATION");
    }
  });

  ui.elements.automationMacroList?.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-automation-macro-remove]");
    if (!button) return;
    automation.removeMacro(button.dataset.automationMacroRemove);
    renderAutomationMacros();
    ui.toast("Atalho de voz removido.", "JORDAN AUTOMATION");
  });

  ui.elements.prepareLocalReasoningButton?.addEventListener("click", async () => {
    registerInteraction();
    try {
      ui.elements.prepareLocalReasoningButton.disabled = true;
      const status = await localReasoning.prepare({
        onProgress: (progress) => ui.setLocalReasoningStatus?.({ availability: "downloading", progress })
      });
      ui.setLocalReasoningStatus?.(status);
      ui.toast("IA local preparada. Perguntas fora do roteiro agora podem usar o modelo do próprio dispositivo.", "JORDAN LOCAL REASONING", 8000);
    } catch (error) {
      ui.setLocalReasoningStatus?.(await localReasoning.status());
      ui.toast(`IA local não pôde ser ativada: ${error.message}`, "JORDAN LOCAL REASONING", 9000);
    } finally {
      if (ui.elements.prepareLocalReasoningButton) ui.elements.prepareLocalReasoningButton.disabled = false;
    }
  });

  ui.elements.nativeDownloadButtons?.forEach((button) => {
    button.addEventListener("click", async () => {
      registerInteraction();
      const platform = button.dataset.nativeDownload;
      const url = nativeBridge.downloadTargets()[platform];
      if (!url) return;
      const opened = await nativeBridge.openUrl(url, { title: `Download JORDAN · ${platform}`, inApp: false });
      if (!opened.ok) window.location.href = url;
    });
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
    ui.toast("Endpoint do Voice Core salvo neste dispositivo. O Manual Core não depende desse endereço.", "JORDAN VOICE");
  });

  ui.elements.checkVoiceCoreButton?.addEventListener("click", async () => {
    registerInteraction();
    ui.setNeuralVoiceStatus({ ok: false, enabled: neuralVoiceEnabled, reason: "checking" });
    const health = await voice.neuralVoiceHealth({ force: true });
    ui.setNeuralVoiceStatus({ ...health, enabled: neuralVoiceEnabled });
    ui.toast(health.ok ? `JORDAN Spark V2 está respondendo${health.voice_provider ? ` · ${String(health.voice_provider).toUpperCase()}` : ""}.` : "Voice Server não respondeu. A voz do dispositivo continuará como fallback.", "JORDAN VOICE");
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



const CHESS_GLYPHS = Object.freeze({
  wK: "♔", wQ: "♕", wR: "♖", wB: "♗", wN: "♘", wP: "♙",
  bK: "♚", bQ: "♛", bR: "♜", bB: "♝", bN: "♞", bP: "♟"
});

function chessColorLabel(color) {
  return color === "w" ? "BRANCAS" : "PRETAS";
}

function chessStatusCopy(state) {
  if (state.status === "checkmate") {
    const userWon = state.winner === state.playerColor;
    return userWon
      ? { title: "Xeque-mate! Você venceu.", text: "Boa. Você fechou a posição antes da JORDAN conseguir escapar." }
      : { title: "Xeque-mate · JORDAN venceu", text: "Fim de jogo. Pode pedir revanche quando quiser." };
  }
  if (state.status === "stalemate") return { title: "Empate por afogamento", text: "Não existem lances legais, mas o rei não está em xeque." };
  if (state.status === "draw-50") return { title: "Empate · regra dos 50 lances", text: "A partida terminou sem captura nem movimento de peão por tempo suficiente." };
  if (chessThinking) return { title: "JORDAN está pensando...", text: "O motor local está avaliando a posição e escolhendo o próximo lance." };
  if (state.turn === state.playerColor) {
    return state.check
      ? { title: "Sua vez · você está em xeque", text: "Proteja o rei. As casas marcadas são lances legais para a peça selecionada." }
      : { title: "Sua vez", text: "Clique em uma peça e depois em uma das casas marcadas." };
  }
  return { title: "Vez da JORDAN", text: "A JORDAN está pronta para responder ao seu último lance." };
}

function renderChess() {
  const boardEl = ui.elements.chessBoard;
  if (!boardEl) return;
  const state = chess.publicState();
  const copy = chessStatusCopy(state);

  if (ui.elements.chessStatusTitle) ui.elements.chessStatusTitle.textContent = copy.title;
  if (ui.elements.chessStatusText) ui.elements.chessStatusText.textContent = copy.text;
  if (ui.elements.chessTurnLabel) {
    const owner = state.turn === state.playerColor ? "SUA VEZ" : "JORDAN";
    ui.elements.chessTurnLabel.textContent = `${owner} · ${chessColorLabel(state.turn)}`;
  }
  if (ui.elements.chessCheckBadge) {
    ui.elements.chessCheckBadge.classList.toggle("hidden", !state.check);
    ui.elements.chessCheckBadge.textContent = state.check ? "CHECK" : "";
  }
  if (ui.elements.chessDifficulty) ui.elements.chessDifficulty.value = state.difficulty;

  const vsStrong = document.querySelectorAll(".chess-vs strong");
  if (vsStrong[0]) vsStrong[0].textContent = `${CHESS_GLYPHS[`${state.playerColor}K`]} ${state.playerColor === "w" ? "WHITE" : "BLACK"}`;
  if (vsStrong[1]) vsStrong[1].textContent = `${CHESS_GLYPHS[`${state.jordanColor}K`]} ${state.jordanColor === "w" ? "WHITE" : "BLACK"}`;

  boardEl.innerHTML = "";
  const rows = chessFlipped ? [...Array(8).keys()].reverse() : [...Array(8).keys()];
  const cols = chessFlipped ? [...Array(8).keys()].reverse() : [...Array(8).keys()];
  const last = state.lastMove;

  rows.forEach((row, displayRow) => {
    cols.forEach((col, displayCol) => {
      const squareName = coordToSquare(row, col);
      const piece = state.board[row][col];
      const button = document.createElement("button");
      button.type = "button";
      button.className = `chess-square ${(row + col) % 2 ? "dark" : "light"}`;
      button.dataset.square = squareName;
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", piece ? `${squareName} ${piece}` : squareName);

      if (squareName === chessSelectedSquare) button.classList.add("selected");
      const legal = chessLegalTargets.find((move) => move.to === squareName);
      if (legal) button.classList.add(legal.captured || legal.enPassant ? "legal-capture" : "legal-target");
      if (last && (last.from === squareName || last.to === squareName)) button.classList.add("last-move");
      if (state.check && piece === `${state.turn}K`) button.classList.add("king-check");

      if (piece) {
        const span = document.createElement("span");
        span.className = `chess-piece ${piece[0] === "w" ? "white" : "black"}`;
        span.textContent = CHESS_GLYPHS[piece] || "?";
        button.appendChild(span);
      }

      if (displayRow === 7) {
        const file = document.createElement("span");
        file.className = "chess-square-coordinate file";
        file.textContent = squareName[0];
        button.appendChild(file);
      }
      if (displayCol === 0) {
        const rank = document.createElement("span");
        rank.className = "chess-square-coordinate rank";
        rank.textContent = squareName[1];
        button.appendChild(rank);
      }

      button.addEventListener("click", () => handleChessSquareClick(squareName));
      boardEl.appendChild(button);
    });
  });

  const logEl = ui.elements.chessMoveLog;
  if (logEl) {
    logEl.innerHTML = "";
    if (!state.moveLog.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "A partida ainda não começou.";
      logEl.appendChild(empty);
    } else {
      for (let index = 0; index < state.moveLog.length; index += 2) {
        const white = state.moveLog[index];
        const black = state.moveLog[index + 1];
        const row = document.createElement("div");
        row.className = "chess-move-row";
        const number = document.createElement("b");
        number.textContent = `${Math.floor(index / 2) + 1}.`;
        const w = document.createElement("span");
        w.textContent = white?.notation || "—";
        const b = document.createElement("span");
        b.textContent = black?.notation || "…";
        row.append(number, w, b);
        logEl.appendChild(row);
      }
      logEl.scrollTop = logEl.scrollHeight;
    }
  }
  if (ui.elements.chessMoveCount) ui.elements.chessMoveCount.textContent = String(state.moveLog.length);
  if (ui.elements.chessUndoButton) ui.elements.chessUndoButton.disabled = chessThinking || !chess.canUndo();
}

function persistChess() {
  setSetting("chess.localState", chess.serialize()).catch((error) => console.warn("JORDAN Chess save:", error));
}

async function scheduleJordanChessMove({ immediate = false } = {}) {
  if (chessThinking || chess.status !== "playing" || chess.turn !== chess.jordanColor) return null;
  chessThinking = true;
  chessSelectedSquare = null;
  chessLegalTargets = [];
  renderChess();

  if (!immediate) await new Promise((resolve) => setTimeout(resolve, 260));
  let result = null;
  try {
    result = chess.playJordanMove({ difficulty: chess.difficulty });
    persistChess();
  } finally {
    chessThinking = false;
    renderChess();
  }
  return result;
}

async function handleChessSquareClick(square) {
  registerInteraction();
  const state = chess.publicState();
  if (chessThinking || state.status !== "playing" || state.turn !== state.playerColor) return;

  const piece = chess.pieceAt(square);
  if (chessSelectedSquare) {
    const target = chessLegalTargets.find((move) => move.to === square);
    if (target) {
      const result = chess.move(chessSelectedSquare, square, target.promotion || "Q");
      chessSelectedSquare = null;
      chessLegalTargets = [];
      persistChess();
      renderChess();
      if (result.ok && chess.status === "playing") await scheduleJordanChessMove();
      return;
    }
  }

  if (piece && piece[0] === state.playerColor) {
    chessSelectedSquare = square;
    chessLegalTargets = chess.legalMovesFrom(square);
  } else {
    chessSelectedSquare = null;
    chessLegalTargets = [];
  }
  renderChess();
}

async function startChessGame({ difficulty = "normal", playerColor = "w", open = true } = {}) {
  chess.setDifficulty(difficulty);
  chess.reset({ difficulty, playerColor });
  chessSelectedSquare = null;
  chessLegalTargets = [];
  chessFlipped = playerColor === "b";
  persistChess();
  renderChess();
  if (open) ui.openView("games");
  let jordanMove = null;
  if (chess.turn === chess.jordanColor) jordanMove = await scheduleJordanChessMove({ immediate: true });
  return { state: chess.publicState(), jordanMove };
}

function chessCoreState() {
  const state = chess.publicState();
  return {
    status: state.status,
    winner: state.winner,
    turn: state.turn,
    player_color: state.playerColor,
    jordan_color: state.jordanColor,
    difficulty: state.difficulty,
    check: state.check,
    fen: state.fen,
    last_move: state.lastMove,
    move_count: state.moveLog.length
  };
}

function coreEventView(event) {
  if (!event) return null;
  return {
    id: event.id,
    title: event.title,
    startAt: event.startAt,
    endAt: event.endAt,
    allDay: Boolean(event.allDay),
    category: event.category || "default",
    description: event.description || ""
  };
}

async function buildManualCoreContext() {
  const [facts, upcoming, unreadCount] = await Promise.all([
    memory.summarizeFacts(10).catch(() => []),
    calendar.upcoming(8).catch(() => []),
    messages.unreadCount().catch(() => 0)
  ]);

  const identity = lineageService.currentIdentity;
  return {
    now: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo",
    language: languageMode,
    online: navigator.onLine,
    currentView: ui.currentView || "core",
    user: identity ? {
      id: identity.id,
      firstName: identity.firstName,
      confirmationName: identity.confirmationName || identity.firstName,
      fullName: [identity.firstName, identity.confirmationName].filter(Boolean).join(" ").trim(),
      isCreator: Boolean(lineageService.isCreator)
    } : null,
    personality: assistant.getPersonality()?.id || "extroverted",
    memories: facts.map((item) => ({ label: item.label, value: item.value })),
    upcomingEvents: upcoming.map(coreEventView),
    unreadMessages: unreadCount,
    availableApps: appLauncher.listTargets().map((item) => item.id),
    native: nativeBridge.status(),
    localReasoning: localReasoning.snapshot(),
    automation: automation.snapshot(),
    chess: chessCoreState()
  };
}

async function applyLegacyCoreAction(result) {
  if (!result) return;
  if (result.refreshAgenda) {
    await Promise.all([ui.renderToday(), ui.renderNext(), ui.renderAgenda(), ui.renderMonthGrid(), ui.renderSelectedDay()]);
  }
  if (result.refreshMemory) await ui.renderMemory();
  if (result.refreshMessages || result.action === "message-sent") await refreshMessagesView({ markSeen: false }).catch(console.warn);

  if (result.action === "open-view" && result.view) ui.openView(result.view);
  if (result.action === "open-emergency") ui.openEmergencyPanel(result.priorityNumber || "190");
  if (result.action === "open-tutorial") ui.openTutorialPanel();
  if (result.action === "open-link" && result.url) ui.addExternalLink(result.linkLabel || "ABRIR", result.url, "MÍDIA / LINK");
  if (result.action === "location-results" && result.places) ui.addLocationLinks(result.places);
  if (result.action === "research-results" && result.research) ui.renderResearch(result.research);
  if (result.action === "route-results" && result.route) ui.renderRoute(result.route);
  if (result.action === "science-result" && result.science) ui.renderScience(result.science);
  if (result.action === "open-music-library") ui.openCompanion("media");
  if (result.action === "play-media" && result.track) {
    ui.renderMediaTrack(result.track);
    await media.playTrack(result.track.id).catch(() => null);
  }
  if (result.action === "open-youtube-music") {
    const query = String(result.query || "").trim();
    const opened = await nativeBridge.openYoutube(query);
    if (!opened.ok) {
      const url = query ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` : "https://www.youtube.com/";
      ui.addExternalLink("ABRIR YOUTUBE", url, "JORDAN MUSIC");
    }
  }
  if (result.action === "launch-app" && result.appTarget?.url) {
    const opened = await nativeBridge.launchTarget(result.appTarget, { inApp: true });
    if (!opened.ok) ui.addExternalLink(`ABRIR ${result.appTarget.label}`, result.appTarget.url, "APP / SITE");
  }
}

function createManualCoreToolHandlers() {
  return {
    async get_agenda({ range = "upcoming", limit = 10 } = {}) {
      let events = [];
      if (range === "today") {
        events = await calendar.today();
      } else if (range === "tomorrow") {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        events = await calendar.forDay(tomorrow);
      } else if (range === "next_7_days") {
        events = await calendar.nextDays(7);
      } else {
        events = await calendar.upcoming(Math.max(1, Math.min(30, Number(limit) || 10)));
      }
      return { ok: true, events: events.slice(0, Math.max(1, Math.min(30, Number(limit) || 10))).map(coreEventView) };
    },

    async create_calendar_event({ title, start_at, end_at = null, duration_minutes = null, description = "", all_day = false } = {}) {
      const startAt = new Date(start_at);
      if (!title?.trim() || Number.isNaN(startAt.getTime())) throw new Error("Título ou data inicial inválidos.");

      let endAt = end_at ? new Date(end_at) : null;
      if (!endAt || Number.isNaN(endAt.getTime())) {
        const minutes = Math.max(1, Number(duration_minutes) || (all_day ? 1440 : 60));
        endAt = new Date(startAt.getTime() + minutes * 60000);
      }
      if (endAt <= startAt) throw new Error("O fim do compromisso precisa ser depois do início.");

      const event = await calendar.create({
        title: title.trim(),
        startAt,
        endAt,
        description: String(description || ""),
        source: "jordan-manual-core",
        allDay: Boolean(all_day)
      });
      await Promise.all([ui.renderToday(), ui.renderNext(), ui.renderAgenda(), ui.renderMonthGrid(), ui.renderSelectedDay()]);
      return { ok: true, event: coreEventView(event) };
    },

    async delete_calendar_event({ query = "" } = {}) {
      const matches = await calendar.search(String(query || ""), { futureOnly: false });
      if (!matches.length) return { ok: false, error: "Nenhum compromisso corresponde à busca." };
      if (matches.length > 1) {
        return { ok: false, needs_disambiguation: true, matches: matches.slice(0, 6).map(coreEventView) };
      }
      await calendar.remove(matches[0].id);
      await Promise.all([ui.renderToday(), ui.renderNext(), ui.renderAgenda(), ui.renderMonthGrid(), ui.renderSelectedDay()]);
      return { ok: true, deleted: coreEventView(matches[0]) };
    },

    async search_memory({ query = "", limit = 10 } = {}) {
      const found = await memory.find(String(query || ""));
      return {
        ok: true,
        memories: found.slice(0, Math.max(1, Math.min(20, Number(limit) || 10))).map((item) => ({
          id: item.id,
          key: item.key,
          label: item.label,
          value: item.value,
          protected: Boolean(item.protected)
        }))
      };
    },

    async remember_fact({ label = "Informação", value = "" } = {}) {
      if (!String(value).trim()) throw new Error("A memória ficou vazia.");
      const item = await memory.remember({
        key: `manual.fact.${Date.now()}`,
        label: String(label || "Informação").trim(),
        value: String(value).trim(),
        type: "fact",
        source: "manual-core-conversation"
      });
      await ui.renderMemory();
      return { ok: true, memory: { id: item.id, label: item.label, value: item.value } };
    },

    async forget_memory({ query = "" } = {}) {
      const found = await memory.find(String(query || ""));
      if (!found.length) return { ok: false, error: "Não encontrei uma memória correspondente." };
      if (found.length > 1) {
        return { ok: false, needs_disambiguation: true, matches: found.slice(0, 6).map((item) => ({ id: item.id, label: item.label, value: item.value, protected: Boolean(item.protected) })) };
      }
      const removed = await memory.forget(found[0].key || found[0].id);
      await ui.renderMemory();
      return removed
        ? { ok: true, forgotten: { label: found[0].label, value: found[0].value } }
        : { ok: false, error: "Essa memória é protegida pelo núcleo da JORDAN." };
    },

    async read_messages({ unread_only = true, limit = 10 } = {}) {
      const list = unread_only ? await messages.unread() : await messages.inbox({ includeSent: false });
      const clipped = list.slice(0, Math.max(1, Math.min(20, Number(limit) || 10))).map((item) => ({
        id: item.id,
        from: item.senderName,
        text: item.text,
        createdAtMs: item.createdAtMs || null
      }));
      return { ok: true, count: list.length, messages: clipped };
    },

    async send_lineage_message({ recipient = "", text = "" } = {}) {
      const sent = await messages.send(String(recipient || ""), String(text || ""));
      await refreshMessagesView({ markSeen: false });
      return { ok: true, message: { to: sent.recipientName, text: sent.text, id: sent.id } };
    },

    async open_app({ app = "" } = {}) {
      const normalized = String(app || "").trim().toLowerCase().replace(/\s+/g, "");
      const aliases = { googlemaps: "maps", mapa: "maps", mapas: "maps", email: "gmail", "e-mail": "gmail", whats: "whatsapp" };
      const target = appLauncher.getTarget(aliases[normalized] || normalized);
      if (!target) return { ok: false, error: `App/site não cadastrado: ${app}` };
      const opened = await nativeBridge.launchTarget(target, { inApp: true });
      if (!opened.ok && opened.mode === "blocked") ui.addExternalLink(`ABRIR ${target.label}`, target.url, "APP / SITE");
      return { ...opened, app: target.label, url: target.url, blocked: !opened.ok };
    },

    async add_voice_macro({ phrase = "", kind = "key", key = "j" } = {}) {
      try {
        const macro = automation.addMacro({ phrase, action: { kind, key } });
        renderAutomationMacros();
        return { ok: true, macro };
      } catch (error) {
        return { ok: false, reason: error.message };
      }
    },

    async automation_input_once({ kind = "mouse_left", key = "j", x = null, y = null } = {}) {
      const action = { kind, key, fixedPoint: x !== null && y !== null, x: Number(x || 0), y: Number(y || 0) };
      const result = await automation.executeOnce(action);
      await refreshAutomationRuntime().catch(() => null);
      return { ...result, action: automation.describeAction(action) };
    },

    async automation_start({ kind = "mouse_left", key = "j", x = null, y = null, interval_ms = 250 } = {}) {
      const action = { kind, key, fixedPoint: x !== null && y !== null, x: Number(x || 0), y: Number(y || 0) };
      const result = await automation.start({ action, intervalMs: interval_ms });
      await refreshAutomationRuntime().catch(() => null);
      return { ...result, action: automation.describeAction(action), interval_ms: automation.state.intervalMs };
    },

    async automation_stop() {
      const result = await automation.stop();
      await refreshAutomationRuntime().catch(() => null);
      return result;
    },

    async automation_status() {
      const runtime = await automation.refreshRuntime().catch(() => automation.runtime);
      return { ok: true, runtime, capabilities: automation.capabilities, enabled: automation.state.enabled };
    },

    async get_system_status({ target = "all" } = {}) {
      const native = nativeBridge.status();
      const payload = {
        ok: true,
        target,
        core: manualCoreEnabled,
        online: Boolean(navigator.onLine && internetEnabled),
        internetEnabled,
        native: native.native,
        platform: native.platform,
        backgroundCapable: native.backgroundCapable,
        autostart: native.autostart,
        localReasoning: localReasoning.snapshot(),
        automation: automation.snapshot()
      };
      return payload;
    },

    async answer_local_knowledge({ query = "" } = {}) {
      return generalKnowledge.answer(String(query || "")) || { ok: false };
    },

    async reason_general({ query = "" } = {}) {
      const local = await localReasoning.answer(String(query || ""), {
        memories: (await memory.summarizeFacts(8).catch(() => [])).map((item) => ({ label: item.label, value: item.value }))
      });
      if (local?.ok) return local;

      // Sem modelo local, reaproveita os módulos antigos e a pesquisa automática.
      const result = await assistant.execute(String(query || ""), { source: "manual-core-reasoning", confidence: 1 });
      await applyLegacyCoreAction(result);
      return result?.understood !== false && result?.text
        ? { ok: true, text: result.text, source: result.source || "legacy-reasoning" }
        : { ok: false, reason: local?.reason || "no-local-model" };
    },

    async open_view({ view = "core" } = {}) {
      const aliases = { calendario: "calendar", calendário: "calendar", memoria: "memory", memória: "memory", mensagens: "messages", sistema: "system", xadrez: "games", jogo: "games", jogos: "games", chess: "games", inicio: "core", início: "core" };
      const target = aliases[String(view).toLowerCase()] || String(view).toLowerCase();
      if (!document.querySelector(`[data-view="${target}"]`)) return { ok: false, error: `Tela inexistente: ${view}` };
      ui.openView(target);
      if (target === "messages") await refreshMessagesView({ markSeen: true });
      return { ok: true, view: target };
    },

    async get_nearby_places({ category = "fuel", limit = 5 } = {}) {
      const result = await locationService.nearest(String(category || "fuel"), { limit: Math.max(1, Math.min(8, Number(limit) || 5)) });
      ui.addLocationLinks(result.places);
      return {
        ok: true,
        category: result.label,
        places: result.places.map((place) => ({ name: place.name, address: place.address, distance: place.distanceLabel, mapsUrl: place.mapsUrl }))
      };
    },

    async get_directions({ destination = "" } = {}) {
      const result = await locationService.directionsTo(String(destination || ""));
      ui.renderRoute(result);
      return { ok: true, destination: result.destination || destination, url: result.mapsUrl || result.url || null };
    },

    async get_current_location({ detail = "coarse" } = {}) {
      const result = await locationService.currentLocationInfo({ detail: detail === "address" ? "address" : "coarse" });
      if (ui.elements.locationStatus) ui.elements.locationStatus.textContent = `${result.label} · precisão ~${Math.round(result.accuracy || 0)} m`;
      return {
        ok: true,
        label: result.label,
        city: result.place?.city || null,
        state: result.place?.state || null,
        country: result.place?.country || null,
        neighbourhood: detail === "address" ? (result.place?.neighbourhood || null) : null,
        road: detail === "address" ? (result.place?.road || null) : null,
        latitude: result.lat,
        longitude: result.lon,
        accuracy_m: result.accuracy
      };
    },

    async calculate({ expression = "" } = {}) {
      const calculated = safeCalculate(String(expression || ""));
      return { ok: true, expression: calculated.expression, result: calculated.value };
    },

    async get_chess_state() {
      return { ok: true, ...chessCoreState() };
    },

    async start_chess_game({ difficulty = "normal", player_color = "white" } = {}) {
      const playerColor = String(player_color).toLowerCase() === "black" ? "b" : "w";
      const started = await startChessGame({ difficulty, playerColor, open: true });
      return {
        ok: true,
        message: `Nova partida iniciada. Usuário: ${chessColorLabel(playerColor)}.`,
        jordan_opening_move: started.jordanMove?.move || null,
        state: chessCoreState()
      };
    },

    async play_chess_move({ from = "", to = "", promotion = "Q" } = {}) {
      const before = chess.publicState();
      if (before.status !== "playing") return { ok: false, error: "A partida já terminou.", state: chessCoreState() };
      if (before.turn !== before.playerColor) return { ok: false, error: "Agora é a vez da JORDAN.", state: chessCoreState() };
      const userMove = chess.move(String(from).toLowerCase(), String(to).toLowerCase(), promotion);
      if (!userMove.ok) return { ...userMove, state: chessCoreState() };
      persistChess();
      renderChess();
      let jordanMove = null;
      if (chess.status === "playing") jordanMove = await scheduleJordanChessMove({ immediate: true });
      ui.openView("games");
      return {
        ok: true,
        user_move: userMove.move,
        jordan_move: jordanMove?.move || null,
        state: chessCoreState()
      };
    },

    async undo_chess_move() {
      if (chessThinking) return { ok: false, error: "A JORDAN ainda está calculando o lance." };
      const state = chess.publicState();
      const plies = state.turn === state.playerColor ? 2 : 1;
      const ok = chess.undo(plies);
      chessSelectedSquare = null;
      chessLegalTargets = [];
      if (ok) { persistChess(); renderChess(); ui.openView("games"); }
      return { ok, state: chessCoreState(), error: ok ? null : "Não há lances para desfazer." };
    },

    async legacy_jordan_capability({ instruction = "" } = {}) {
      const result = await assistant.execute(String(instruction || ""), { source: "manual-core-tool", confidence: 1 });
      await applyLegacyCoreAction(result);
      return {
        ok: result?.understood !== false,
        text: result?.text || "",
        action: result?.action || null,
        source: result?.source || "legacy"
      };
    }
  };
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

  if (fromVoice) {
    const voiceAutomation = await automation.handleVoiceTranscript(text).catch((error) => ({ handled: true, ok: false, reason: error.message }));
    if (voiceAutomation?.handled) {
      ui.addMessage("VOCÊ", text);
      await refreshAutomationRuntime().catch(() => null);
      if (voiceAutomation.ok) {
        if (!voiceAutomation.silent || voiceAutomation.type === "stop") {
          const message = voiceAutomation.type === "stop"
            ? "Autoclique parado."
            : `Executado: ${automation.describeAction(voiceAutomation.macro?.action)}.`;
          ui.addMessage("JORDAN", message);
          if (voiceEnabled && voice.synthesisSupported) await voice.speak(message, { volume: assistantVolume, mood: "confident" });
        } else {
          ui.setStatus(`AUTOMATION · ${automation.describeAction(voiceAutomation.macro?.action).toUpperCase()}`);
        }
      } else {
        const message = `O atalho foi reconhecido, mas não consegui executar a ação: ${voiceAutomation.result?.reason || voiceAutomation.reason || "Automation Core indisponível"}.`;
        ui.addMessage("JORDAN", message);
        if (voiceEnabled && voice.synthesisSupported) await voice.speak(message, { volume: assistantVolume, mood: "serious" });
      }
      telemetry.setExecution("idle");
      if (voice.alwaysListening) setTimeout(() => voice.start({ always: true }), 120);
      return;
    }
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

    let result = null;

    if (manualCoreEnabled) {
      try {
        ui.setStatus("JORDAN MANUAL CORE · interpretando...");
        const context = await buildManualCoreContext();
        result = await manualCore.execute(text, {
          context,
          toolHandlers: createManualCoreToolHandlers(),
          fallback: () => assistant.execute(text, {
            source: fromVoice ? "voice" : "typed",
            confidence: fromVoice ? Number(recognitionMeta?.confidence || 0) : 1
          }),
          onToolCall: (call) => {
            const toolLabel = String(call?.name || "AÇÃO").replace(/_/g, " ").toUpperCase();
            ui.setStatus(`JORDAN MANUAL CORE · ${toolLabel}`);
          }
        });
      } catch (coreError) {
        console.warn("JORDAN Manual Core fallback:", coreError);
        ui.setStatus("Manual Core encontrou um erro · usando módulo especializado");
      }
    }

    if (!result) {
      result = await assistant.execute(text, {
        source: fromVoice ? "voice" : "typed",
        confidence: fromVoice ? Number(recognitionMeta?.confidence || 0) : 1
      });
    }

    ui.addMessage("JORDAN", result.text || "Pronto.");

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
      const opened = await nativeBridge.openYoutube(query);
      if (!opened.ok) {
        const url = query ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` : "https://www.youtube.com/";
        ui.addExternalLink("ABRIR YOUTUBE", url, "JORDAN MUSIC");
      }
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
      const opened = await nativeBridge.launchTarget(result.appTarget, { inApp: true });
      if (!opened.ok) ui.addExternalLink(`ABRIR ${result.appTarget.label}`, result.appTarget.url, "APP / SITE");
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
