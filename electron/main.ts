import "dotenv/config";
import path from "node:path";
import { app, BrowserWindow, ipcMain, shell } from "electron";
import type {
  AIReplyRequest,
  ChatReplyRoute,
  GenerateXaiImageResponse,
  ReplyMode,
  WaStartRequest,
} from "./ipc-contract";
import { normalizeGroqApiKey, verifyGroqApiKey } from "./lib/groq-key";
import { normalizeOpenRouterApiKey, verifyOpenRouterApiKey } from "./lib/openrouter-key";
import { normalizeXaiApiKey, verifyXaiApiKey } from "./lib/xai-key";
import { isAllowedExternalUrl } from "./shell-links";
import { generateReply } from "./services/ai-orchestrator";
import { generateXaiImageB64 } from "./services/xai-image-gen";
import {
  applySecretsToProcessEnv,
  broadcastPublicConfig,
  getSecretsFormModel,
  loadSecrets,
  mergeSecretsPatch,
  saveSecrets,
} from "./services/secrets-store";
import type { TrainingBundle } from "../shared/training";
import type { SecretsPatch } from "../shared/secrets";
import { DeskAccountsStateSchema, normalizeDeskAccountsState } from "../shared/desk-accounts";
import { bundleToPromptText, loadTraining, pickAndAppendReferenceDocs, saveTraining } from "./services/training-store";
import { loadDeskAccounts, saveDeskAccounts } from "./services/desk-accounts-store";
import { runApiKeysHealthCheck } from "./services/api-keys-test";
import { activateLicenseKey, getLicenseStatus, isLicensed } from "./services/license-store";
import { canConnectWhatsApp, getConnectLicenseStatus, setAdminConnectBypass } from "./services/connect-license";
import { ensureTrialStarted } from "./services/trial-store";
import { startStandaloneServer, stopStandaloneServer, getStandaloneBaseUrl } from "./standalone-server";
import { setupAutoUpdater } from "./auto-updater";
import { WhatsAppManager } from "./services/whatsapp-manager";

const wa = new WhatsAppManager();

let mainWindow: BrowserWindow | null = null;
const gateDisabled = process.env.DESK_GATE_DISABLED === "1";
let appSessionUnlocked = gateDisabled;

function premiumMediaUnlocked(): boolean {
  if (process.env.DESK_PREMIUM_MEDIA_LOCKED === "1") return false;
  if (process.env.DESK_PREMIUM_MEDIA_UNLOCKED === "1") return true;
  if (gateDisabled) return true;
  if (appSessionUnlocked) return true;
  return false;
}

function appBaseUrl(): string {
  return getStandaloneBaseUrl();
}

function getAdminPin(): string {
  return (process.env.DESK_ADMIN_PIN || "1997").trim();
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0b0f14",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow = win;
  const base = appBaseUrl();
  void win.loadURL(`${base}/dashboard`);

  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.webContents.setWindowOpenHandler(({ url: target }) => {
    void shell.openExternal(target);
    return { action: "deny" };
  });
}

function registerIpc() {
  ipcMain.handle("gate:status", async () => ({
    unlocked: true,
    licensed: (await isLicensed()),
    license: await getLicenseStatus(),
    connect: await getConnectLicenseStatus(),
  }));

  ipcMain.handle("license:connect-status", async () => getConnectLicenseStatus());

  ipcMain.handle("license:activate", async (_e, key: unknown) => {
    if (typeof key !== "string" || !key.trim()) {
      return { ok: false as const, error: "Enter your license key" };
    }
    return activateLicenseKey(key);
  });

  ipcMain.handle("license:status", async () => getLicenseStatus());

  ipcMain.handle("gate:unlock", async (_e, pin: unknown) => {
    if (typeof pin !== "string" || pin.trim() !== getAdminPin()) {
      return { ok: false as const };
    }
    appSessionUnlocked = true;
    setAdminConnectBypass(true);
    return { ok: true as const };
  });

  ipcMain.handle("app:version", () => app.getVersion());

  ipcMain.handle("app:get-capabilities", () => ({
    premiumMedia: premiumMediaUnlocked(),
  }));

  ipcMain.handle("app:public-config", async () => {
    const s = await loadSecrets();
    return {
      supabaseUrl: s.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      supabaseAnonKey: s.supabaseAnonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    };
  });

  ipcMain.handle("settings:get", async () => getSecretsFormModel());
  ipcMain.handle("settings:save", async (_e, patch: SecretsPatch) => {
    const cur = await loadSecrets();
    const next = mergeSecretsPatch(cur, patch);
    if (typeof patch.openrouterApiKey === "string" && patch.openrouterApiKey.trim()) {
      const k = normalizeOpenRouterApiKey(patch.openrouterApiKey);
      if (k) {
        const check = await verifyOpenRouterApiKey(k);
        if (!check.ok) {
          return {
            ok: false as const,
            error: `OpenRouter rejected this key (HTTP ${check.status}): ${check.detail}`,
          };
        }
      }
    }
    if (typeof patch.xaiApiKey === "string" && patch.xaiApiKey.trim()) {
      const k = normalizeXaiApiKey(patch.xaiApiKey);
      if (k) {
        const check = await verifyXaiApiKey(k);
        if (!check.ok) {
          return {
            ok: false as const,
            error: `xAI rejected this key (HTTP ${check.status}): ${check.detail}`,
          };
        }
      }
    }
    if (typeof patch.groqApiKey === "string" && patch.groqApiKey.trim()) {
      const k = normalizeGroqApiKey(patch.groqApiKey);
      if (k) {
        const check = await verifyGroqApiKey(k);
        if (!check.ok) {
          return {
            ok: false as const,
            error: `Groq rejected this key (HTTP ${check.status}): ${check.detail}`,
          };
        }
      }
    }
    await saveSecrets(next);
    const reloaded = await loadSecrets();
    applySecretsToProcessEnv(reloaded, patch);
    broadcastPublicConfig(reloaded);
    return { ok: true as const };
  });

  ipcMain.handle("settings:test-keys", async (_e, patch?: SecretsPatch) => {
    try {
      return await runApiKeysHealthCheck(patch);
    } catch (e) {
      return {
        ok: false,
        checks: [],
        summary: e instanceof Error ? e.message : String(e),
      };
    }
  });

  ipcMain.handle("shell:open-external", async (_e, url: unknown) => {
    if (typeof url !== "string" || !isAllowedExternalUrl(url)) return { ok: false as const, error: "URL not allowed" };
    await shell.openExternal(url);
    return { ok: true as const };
  });

  ipcMain.handle("training:load", async () => loadTraining());
  ipcMain.handle("training:save", async (_e, bundle: TrainingBundle) => {
    await saveTraining(bundle);
    return { ok: true as const };
  });
  ipcMain.handle("training:to-prompt", async (_e, bundle: TrainingBundle) => bundleToPromptText(bundle));

  ipcMain.handle("training:pick-reference-docs", async () => {
    const res = await pickAndAppendReferenceDocs(mainWindow);
    if (!res.ok && res.error === "cancelled") return { ok: false as const, cancelled: true as const };
    return res;
  });

  ipcMain.handle("desk-accounts:get", async () => loadDeskAccounts());
  ipcMain.handle("desk-accounts:save", async (_e, raw: unknown) => {
    const p = DeskAccountsStateSchema.safeParse(raw);
    if (!p.success) {
      return { ok: false as const, error: "Invalid desk accounts (exactly two slots; ids: letters, digits, _ or -)." };
    }
    return saveDeskAccounts(normalizeDeskAccountsState(p.data));
  });

  ipcMain.handle("wa:start", async (_e, req: WaStartRequest) => {
    if (!req || typeof req.accountId !== "string" || !req.accountId.trim()) {
      return { ok: false, error: "accountId required" };
    }
    if (!(await canConnectWhatsApp())) {
      const trialActive = (await getConnectLicenseStatus()).trialActive;
      return {
        ok: false,
        error: "LICENSE_REQUIRED",
        licenseRequired: true,
        trialExpired: !trialActive,
      };
    }
    return wa.start({
      accountId: req.accountId.trim(),
      mode: req.mode === "phone" ? "phone" : "qr",
      phoneDigits: req.phoneDigits,
    });
  });

  ipcMain.handle("wa:cancel-pairing", async (_e, accountId: string) => {
    return wa.cancelPairing(String(accountId));
  });

  ipcMain.handle(
    "wa:fetch-ai-thread",
    async (
      _e,
      args: {
        accountId: string;
        chatId: string;
        anchorMessageId?: string;
        cachedTranscript?: string;
        anchorTimestampMs?: number;
      },
    ) => {
      return wa.fetchRecentThreadForAi(
        String(args.accountId),
        String(args.chatId),
        args.anchorMessageId ? String(args.anchorMessageId) : undefined,
        {
          cachedTranscript: args.cachedTranscript ? String(args.cachedTranscript) : undefined,
          anchorTimestampMs:
            args.anchorTimestampMs != null ? Number(args.anchorTimestampMs) : undefined,
        },
      );
    },
  );

  ipcMain.handle(
    "wa:fetch-chat-history",
    async (_e, args: { accountId: string; chatId: string }) => {
      return wa.fetchChatHistoryForUi(String(args.accountId), String(args.chatId));
    },
  );

  ipcMain.handle(
    "wa:seed-chat-memory",
    async (_e, args: { accountId: string; chatId: string }) => {
      return wa.seedChatMemoryFromHistory(String(args.accountId), String(args.chatId));
    },
  );

  ipcMain.handle(
    "wa:fetch-voice-audio",
    async (_e, args: { accountId?: string; chatId?: string; messageId?: string }) => {
      const accountId = String(args?.accountId ?? "").trim() || "default";
      const chatId = String(args?.chatId ?? "").trim();
      const messageId = String(args?.messageId ?? "").trim();
      if (!chatId || !messageId) return { ok: false as const, error: "chatId and messageId required." };
      return wa.fetchChatVoiceAudio(accountId, chatId, messageId);
    },
  );

  ipcMain.handle("wa:reset-local-session", async (_e, accountId: string) => {
    return wa.resetLocalData(String(accountId));
  });

  ipcMain.handle("wa:sync-chats", async (_e, accountId: string) => {
    return wa.syncChatList(String(accountId));
  });

  ipcMain.handle("wa:logout", async (_e, accountId: string) => {
    await wa.logout(String(accountId));
    return { ok: true };
  });

  ipcMain.handle(
    "wa:send-text",
    async (_e, args: { accountId: string; chatId: string; body: string }) => {
      return wa.sendText(args.accountId, args.chatId, args.body);
    },
  );

  ipcMain.handle("wa:send-media-b64", async (_e, body: unknown) => {
    const a = body as {
      accountId?: unknown;
      chatId?: unknown;
      base64?: unknown;
      mimeType?: unknown;
      asSticker?: unknown;
      caption?: unknown;
      sendAsVoice?: unknown;
    };
    const sendAsVoice = Boolean(a.sendAsVoice);
    if (!sendAsVoice && !premiumMediaUnlocked()) {
      return { ok: false as const, error: "Premium media is not available in this session." };
    }
    return wa.sendMediaBase64(
      String(a.accountId ?? ""),
      String(a.chatId ?? ""),
      String(a.base64 ?? ""),
      String(a.mimeType ?? "image/png"),
      {
        asSticker: Boolean(a.asSticker),
        caption: typeof a.caption === "string" ? a.caption : undefined,
        sendAsVoice,
      },
    );
  });

  ipcMain.handle("wa:set-reply-mode", (_e, args: { accountId: string; mode: ReplyMode; arm?: boolean }) => {
    wa.setReplyMode(args.accountId, args.mode, args.arm ?? false);
  });

  ipcMain.handle("wa:get-chat-reply-routes", async (_e, accountId: string) => {
    return wa.getChatReplyRoutes(String(accountId));
  });

  ipcMain.handle(
    "wa:set-chat-reply-route",
    async (_e, args: { accountId: string; chatId: string; route: ChatReplyRoute }) => {
      if (!args || typeof args.chatId !== "string" || !args.chatId.trim()) return { ok: false as const };
      const route = args.route;
      if (route !== "auto" && route !== "draft" && route !== "off") return { ok: false as const };
      await wa.saveChatReplyRoute(String(args.accountId), args.chatId.trim(), route);
      return { ok: true as const };
    },
  );

  ipcMain.handle("wa:clear-linked-compose-draft", async (_e, args: { accountId: string; chatId: string }) => {
    if (!args?.chatId?.trim()) return { ok: false as const };
    return wa.clearLinkedComposeDraft(String(args.accountId), args.chatId.trim());
  });

  ipcMain.handle("ai:generate-reply", async (_e, req: AIReplyRequest) => {
    try {
      const s = await loadSecrets();
      applySecretsToProcessEnv(s);
      return await generateReply(req);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { text: "AI error: " + message, provider: "xai" as const };
    }
  });

  ipcMain.handle("ai:generate-xai-image", async (_e, body: unknown): Promise<GenerateXaiImageResponse> => {
    if (!premiumMediaUnlocked()) {
      return { ok: false, error: "Premium media is not available in this session." };
    }
    const b = body as { prompt?: unknown; style?: unknown };
    const prompt = typeof b.prompt === "string" ? b.prompt : "";
    const style = b.style === "sticker" ? ("sticker" as const) : ("image" as const);
    if (!prompt.trim()) return { ok: false, error: "Enter a prompt." };
    try {
      const s = await loadSecrets();
      applySecretsToProcessEnv(s);
      const out = await generateXaiImageB64(prompt, style);
      return { ok: true, base64: out.base64, mimeType: out.mimeType };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  });

  ipcMain.handle(
    "ai:transcribe-voice",
    async (_e, args: { accountId?: string; messageId?: string; chatId?: string }) => {
      const accountId = String(args?.accountId ?? "").trim() || "default";
      const messageId = String(args?.messageId ?? "").trim();
      const chatId = String(args?.chatId ?? "").trim();
      if (!messageId || !chatId) return { error: "messageId and chatId required." };
      try {
        const s = await loadSecrets();
        applySecretsToProcessEnv(s);
        return await wa.transcribeChatVoiceMessage(accountId, chatId, messageId);
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
  );
}

app.whenReady().then(async () => {
  await startStandaloneServer();
  await maybeSeedXaiFromEnv();
  await ensureTrialStarted();
  const secrets = await loadSecrets();
  applySecretsToProcessEnv(secrets);
  registerIpc();
  createWindow();
  broadcastPublicConfig(secrets);
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

async function maybeSeedXaiFromEnv() {
  const seedKey = normalizeXaiApiKey(process.env.DEV_SEED_XAI_KEY);
  if (!seedKey) return;
  const cur = await loadSecrets();
  if (normalizeXaiApiKey(cur.xaiApiKey)) return;
  const v = await verifyXaiApiKey(seedKey);
  if (!v.ok) {
    console.warn("[desk] DEV_SEED_XAI_KEY rejected (HTTP " + v.status + "):", v.detail);
    return;
  }
  let next = mergeSecretsPatch(cur, { xaiApiKey: seedKey });
  const m = process.env.DEV_SEED_XAI_MODEL?.trim();
  if (m) next = mergeSecretsPatch(next, { xaiChatModel: m });
  await saveSecrets(next);
  console.log("[desk] Seeded xAI key from DEV_SEED_XAI_KEY (no key was stored on disk before).");
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopStandaloneServer();
});
