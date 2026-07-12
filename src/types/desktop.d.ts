import type {
  AIReplyRequest,
  AIReplyResponse,
  AppCapabilities,
  ChatReplyRoute,
  GenerateXaiImageRequest,
  GenerateXaiImageResponse,
  ReplyMode,
  SendMediaB64Request,
  SettingsSaveResponse,
  ApiKeysTestResponse,
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
  WaStartResponse,
  WaStatusPayload,
  WaVoiceQueuePayload,
} from "../../electron/ipc-contract";
import type { TrainingBundle } from "../../shared/training";
import type { DeskAccountsState } from "../../shared/desk-accounts";
import type { LicenseActivateResponse, LicenseConnectStatus, LicenseStatus } from "../../shared/license";
import type { SecretsFormModel, SecretsPatch } from "../../shared/secrets";

declare global {
  interface Window {
    desktop?: {
      wa: {
        startSession: (req: WaStartRequest) => Promise<WaStartResponse>;
        logout: (accountId: string) => Promise<{ ok: boolean }>;
        cancelPairing: (accountId: string) => Promise<{ ok: boolean; error?: string }>;
        resetLocalSession: (accountId: string) => Promise<{ ok: boolean; error?: string }>;
        syncChats: (accountId: string) => Promise<{ ok: boolean; error?: string; count?: number }>;
        fetchAiThread: (
          accountId: string,
          chatId: string,
          anchorMessageId?: string,
          opts?: { cachedTranscript?: string; anchorTimestampMs?: number },
        ) => Promise<WaFetchAiThreadResult>;
        fetchChatHistory: (accountId: string, chatId: string) => Promise<WaFetchChatHistoryResult>;
        seedChatMemory: (accountId: string, chatId: string) => Promise<{ ok: boolean; error?: string }>;
        fetchVoiceAudio: (
          accountId: string,
          chatId: string,
          messageId: string,
        ) => Promise<WaFetchVoiceAudioResult>;
        sendText: (
          accountId: string,
          chatId: string,
          body: string,
        ) => Promise<{ ok: boolean; error?: string }>;
        sendMediaB64: (args: SendMediaB64Request) => Promise<{ ok: boolean; error?: string }>;
        setReplyMode: (accountId: string, mode: ReplyMode, arm?: boolean) => Promise<void>;
        getChatReplyRoutes: (accountId: string) => Promise<Record<string, ChatReplyRoute>>;
        setChatReplyRoute: (
          accountId: string,
          chatId: string,
          route: ChatReplyRoute,
        ) => Promise<{ ok: boolean }>;
        clearLinkedComposeDraft: (accountId: string, chatId: string) => Promise<{ ok: boolean }>;
        onQr: (handler: (payload: WaQrPayload) => void) => () => void;
        onPairingCode: (handler: (payload: WaPairingCodePayload) => void) => () => void;
        onStatus: (handler: (payload: WaStatusPayload) => void) => () => void;
        onMessage: (handler: (payload: WaInboundPayload) => void) => () => void;
        onMessageUpdate: (handler: (payload: WaMessageUpdatePayload) => void) => () => void;
        onVoiceQueue: (handler: (payload: WaVoiceQueuePayload) => void) => () => void;
        onDraftReply: (handler: (payload: WaDraftReplyPayload) => void) => () => void;
        onChatsSync: (handler: (payload: WaChatsSyncPayload) => void) => () => void;
      };
      ai: {
        generateReply: (req: AIReplyRequest) => Promise<AIReplyResponse>;
        generateXaiImage: (req: GenerateXaiImageRequest) => Promise<GenerateXaiImageResponse>;
        transcribeAudio: (args: {
          accountId: string;
          messageId: string;
          chatId: string;
        }) => Promise<{ text?: string; error?: string }>;
      };
      app: {
        getVersion: () => Promise<string>;
        getCapabilities: () => Promise<AppCapabilities>;
      };
      gate: {
        status: () => Promise<{ unlocked: boolean; licensed?: boolean; license?: LicenseStatus }>;
        unlock: (pin: string) => Promise<{ ok: boolean }>;
      };
      license: {
        activate: (key: string) => Promise<LicenseActivateResponse>;
        status: () => Promise<LicenseStatus>;
        connectStatus: () => Promise<LicenseConnectStatus>;
      };
      config: {
        get: () => Promise<{ supabaseUrl: string; supabaseAnonKey: string }>;
        onUpdate: (handler: (cfg: { supabaseUrl: string; supabaseAnonKey: string }) => void) => () => void;
      };
      settings: {
        load: () => Promise<SecretsFormModel>;
        save: (patch: SecretsPatch) => Promise<SettingsSaveResponse>;
        testKeys: (patch?: SecretsPatch) => Promise<ApiKeysTestResponse>;
      };
      shell: {
        openExternal: (url: string) => Promise<{ ok: boolean; error?: string }>;
      };
      training: {
        load: () => Promise<TrainingBundle>;
        save: (bundle: TrainingBundle) => Promise<{ ok: true }>;
        toPrompt: (bundle: TrainingBundle) => Promise<string>;
        pickReferenceDocs: () => Promise<
          | { ok: true; bundle: TrainingBundle }
          | { ok: false; error: string; cancelled?: boolean }
        >;
      };
      deskAccounts: {
        load: () => Promise<DeskAccountsState>;
        save: (state: DeskAccountsState) => Promise<{ ok: true } | { ok: false; error: string }>;
      };
    };
  }
}

export {};
