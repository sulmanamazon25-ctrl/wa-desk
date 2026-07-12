import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import type {
  AIReplyRequest,
  AIReplyResponse,
  AppCapabilities,
  ChatReplyRoute,
  GenerateXaiImageRequest,
  GenerateXaiImageResponse,
  ReplyMode,
  SendMediaB64Request,
  WaChatRow,
  WaChatsSyncPayload,
  WaDraftReplyPayload,
  WaFetchAiThreadResult,
  WaFetchChatHistoryResult,
  WaFetchVoiceAudioResult,
  WaInboundPayload,
  WaMessageUpdatePayload,
  WaPairingCodePayload,
  WaQrPayload,
  WaStartRequest,
  WaStatusPayload,
  WaVoiceQueuePayload,
  SettingsSaveResponse,
  ApiKeysTestResponse,
} from "./ipc-contract";
import type { TrainingBundle } from "../shared/training";
import type { DeskAccountsState } from "../shared/desk-accounts";
import type { LicenseActivateResponse, LicenseConnectStatus, LicenseStatus } from "../shared/license";
import type { SecretsFormModel, SecretsPatch } from "../shared/secrets";

const api = {
  wa: {
    startSession: (req: WaStartRequest) =>
      ipcRenderer.invoke("wa:start", req) as Promise<import("./ipc-contract").WaStartResponse>,
    logout: (accountId: string) =>
      ipcRenderer.invoke("wa:logout", accountId) as Promise<{ ok: boolean }>,
    cancelPairing: (accountId: string) =>
      ipcRenderer.invoke("wa:cancel-pairing", accountId) as Promise<{ ok: boolean; error?: string }>,
    syncChats: (accountId: string) =>
      ipcRenderer.invoke("wa:sync-chats", accountId) as Promise<{ ok: boolean; error?: string; count?: number }>,
    fetchAiThread: (
      accountId: string,
      chatId: string,
      anchorMessageId?: string,
      opts?: { cachedTranscript?: string; anchorTimestampMs?: number },
    ) =>
      ipcRenderer.invoke("wa:fetch-ai-thread", {
        accountId,
        chatId,
        anchorMessageId,
        cachedTranscript: opts?.cachedTranscript,
        anchorTimestampMs: opts?.anchorTimestampMs,
      }) as Promise<WaFetchAiThreadResult>,
    fetchChatHistory: (accountId: string, chatId: string) =>
      ipcRenderer.invoke("wa:fetch-chat-history", { accountId, chatId }) as Promise<WaFetchChatHistoryResult>,
    seedChatMemory: (accountId: string, chatId: string) =>
      ipcRenderer.invoke("wa:seed-chat-memory", { accountId, chatId }) as Promise<{ ok: boolean; error?: string }>,
    fetchVoiceAudio: (accountId: string, chatId: string, messageId: string) =>
      ipcRenderer.invoke("wa:fetch-voice-audio", { accountId, chatId, messageId }) as Promise<WaFetchVoiceAudioResult>,
    resetLocalSession: (accountId: string) =>
      ipcRenderer.invoke("wa:reset-local-session", accountId) as Promise<{ ok: boolean; error?: string }>,
    sendText: (accountId: string, chatId: string, body: string) =>
      ipcRenderer.invoke("wa:send-text", { accountId, chatId, body }) as Promise<{
        ok: boolean;
        error?: string;
      }>,
    sendMediaB64: (args: SendMediaB64Request) =>
      ipcRenderer.invoke("wa:send-media-b64", args) as Promise<{ ok: boolean; error?: string }>,
    setReplyMode: (accountId: string, mode: ReplyMode, arm = false) =>
      ipcRenderer.invoke("wa:set-reply-mode", { accountId, mode, arm }) as Promise<void>,
    getChatReplyRoutes: (accountId: string) =>
      ipcRenderer.invoke("wa:get-chat-reply-routes", accountId) as Promise<Record<string, ChatReplyRoute>>,
    setChatReplyRoute: (accountId: string, chatId: string, route: ChatReplyRoute) =>
      ipcRenderer.invoke("wa:set-chat-reply-route", { accountId, chatId, route }) as Promise<{ ok: boolean }>,
    clearLinkedComposeDraft: (accountId: string, chatId: string) =>
      ipcRenderer.invoke("wa:clear-linked-compose-draft", { accountId, chatId }) as Promise<{ ok: boolean }>,
    onQr: (handler: (payload: WaQrPayload) => void) => {
      const sub = (_: IpcRendererEvent, p: WaQrPayload) => handler(p);
      ipcRenderer.on("wa:qr", sub);
      return () => ipcRenderer.removeListener("wa:qr", sub);
    },
    onPairingCode: (handler: (payload: WaPairingCodePayload) => void) => {
      const sub = (_: IpcRendererEvent, p: WaPairingCodePayload) => handler(p);
      ipcRenderer.on("wa:pairing-code", sub);
      return () => ipcRenderer.removeListener("wa:pairing-code", sub);
    },
    onStatus: (handler: (payload: WaStatusPayload) => void) => {
      const sub = (_: IpcRendererEvent, p: WaStatusPayload) => handler(p);
      ipcRenderer.on("wa:status", sub);
      return () => ipcRenderer.removeListener("wa:status", sub);
    },
    onMessage: (handler: (payload: WaInboundPayload) => void) => {
      const sub = (_: IpcRendererEvent, p: WaInboundPayload) => handler(p);
      ipcRenderer.on("wa:message", sub);
      return () => ipcRenderer.removeListener("wa:message", sub);
    },
    onMessageUpdate: (handler: (payload: WaMessageUpdatePayload) => void) => {
      const sub = (_: IpcRendererEvent, p: WaMessageUpdatePayload) => handler(p);
      ipcRenderer.on("wa:message-update", sub);
      return () => ipcRenderer.removeListener("wa:message-update", sub);
    },
    onVoiceQueue: (handler: (payload: WaVoiceQueuePayload) => void) => {
      const sub = (_: IpcRendererEvent, p: WaVoiceQueuePayload) => handler(p);
      ipcRenderer.on("wa:voice-queue", sub);
      return () => ipcRenderer.removeListener("wa:voice-queue", sub);
    },
    onDraftReply: (handler: (payload: WaDraftReplyPayload) => void) => {
      const sub = (_: IpcRendererEvent, p: WaDraftReplyPayload) => handler(p);
      ipcRenderer.on("wa:draft-reply", sub);
      return () => ipcRenderer.removeListener("wa:draft-reply", sub);
    },
    onChatsSync: (handler: (payload: WaChatsSyncPayload) => void) => {
      const sub = (_: IpcRendererEvent, p: WaChatsSyncPayload) => handler(p);
      ipcRenderer.on("wa:chats-sync", sub);
      return () => ipcRenderer.removeListener("wa:chats-sync", sub);
    },
  },
  ai: {
    generateReply: (req: AIReplyRequest) =>
      ipcRenderer.invoke("ai:generate-reply", req) as Promise<AIReplyResponse>,
    generateXaiImage: (req: GenerateXaiImageRequest) =>
      ipcRenderer.invoke("ai:generate-xai-image", req) as Promise<GenerateXaiImageResponse>,
    transcribeAudio: (args: { accountId: string; messageId: string; chatId: string }) =>
      ipcRenderer.invoke("ai:transcribe-voice", args) as Promise<{ text?: string; error?: string }>,
  },
  app: {
    getVersion: () => ipcRenderer.invoke("app:version") as Promise<string>,
    getCapabilities: () => ipcRenderer.invoke("app:get-capabilities") as Promise<AppCapabilities>,
  },
  gate: {
    status: () =>
      ipcRenderer.invoke("gate:status") as Promise<{
        unlocked: boolean;
        licensed?: boolean;
        license?: LicenseStatus;
      }>,
    unlock: (pin: string) => ipcRenderer.invoke("gate:unlock", pin) as Promise<{ ok: boolean }>,
  },
  license: {
    activate: (key: string) => ipcRenderer.invoke("license:activate", key) as Promise<LicenseActivateResponse>,
    status: () => ipcRenderer.invoke("license:status") as Promise<LicenseStatus>,
    connectStatus: () => ipcRenderer.invoke("license:connect-status") as Promise<LicenseConnectStatus>,
  },
  config: {
    get: () =>
      ipcRenderer.invoke("app:public-config") as Promise<{
        supabaseUrl: string;
        supabaseAnonKey: string;
      }>,
    onUpdate: (handler: (cfg: { supabaseUrl: string; supabaseAnonKey: string }) => void) => {
      const sub = (_: IpcRendererEvent, p: { supabaseUrl: string; supabaseAnonKey: string }) => handler(p);
      ipcRenderer.on("app:public-config-updated", sub);
      return () => ipcRenderer.removeListener("app:public-config-updated", sub);
    },
  },
  settings: {
    load: () => ipcRenderer.invoke("settings:get") as Promise<SecretsFormModel>,
    save: (patch: SecretsPatch) => ipcRenderer.invoke("settings:save", patch) as Promise<SettingsSaveResponse>,
    testKeys: (patch?: SecretsPatch) =>
      ipcRenderer.invoke("settings:test-keys", patch) as Promise<ApiKeysTestResponse>,
  },
  shell: {
    openExternal: (url: string) =>
      ipcRenderer.invoke("shell:open-external", url) as Promise<{ ok: boolean; error?: string }>,
  },
  training: {
    load: () => ipcRenderer.invoke("training:load") as Promise<TrainingBundle>,
    save: (bundle: TrainingBundle) =>
      ipcRenderer.invoke("training:save", bundle) as Promise<{ ok: true }>,
    toPrompt: (bundle: TrainingBundle) =>
      ipcRenderer.invoke("training:to-prompt", bundle) as Promise<string>,
    pickReferenceDocs: () =>
      ipcRenderer.invoke("training:pick-reference-docs") as Promise<
        | { ok: true; bundle: TrainingBundle }
        | { ok: false; error: string; cancelled?: boolean }
      >,
  },
  deskAccounts: {
    load: () => ipcRenderer.invoke("desk-accounts:get") as Promise<DeskAccountsState>,
    save: (state: DeskAccountsState) =>
      ipcRenderer.invoke("desk-accounts:save", state) as Promise<{ ok: true } | { ok: false; error: string }>,
  },
};

contextBridge.exposeInMainWorld("desktop", api);

export type DesktopAPI = typeof api;
