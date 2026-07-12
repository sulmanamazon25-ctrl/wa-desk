export type Tone = "professional" | "friendly" | "casual";

/** Per-chat routing when global mode is `selective` (stored on disk per account). */
export type ChatReplyRoute = "auto" | "draft" | "off";

/**
 * Inbound auto-reply behaviour (per WhatsApp account session).
 * `draft` — AI reads each inbound message, generates a reply, and queues it in the
 * draft dock only; nothing is sent until you tap Send there (controlled “auto”).
 * `selective` — use each chat’s route (Auto / Draft / Off) from the inbox list; chats with no route behave as Off.
 */
export type ReplyMode = "auto" | "paused" | "draft" | "selective";

export type WaDraftReplyPayload = {
  accountId: string;
  chatId: string;
  inboundMessageId: string;
  suggestedText: string;
  provider: "openrouter" | "xai" | "groq" | "openai" | "voice-ai";
};

export type WaQrPayload = {
  accountId: string;
  qr: string;
};

export type WaPairingCodePayload = {
  accountId: string;
  code: string;
};

export type WaAuthMode = "qr" | "phone";

export type WaStartRequest = {
  accountId: string;
  mode: WaAuthMode;
  /** Digits only, country code + national (no +), e.g. 923001234567 */
  phoneDigits?: string;
};

export type WaStartResponse =
  | { ok: true }
  | { ok: false; error: string; trialExpired?: boolean; licenseRequired?: boolean };

export type WaStatusPayload = {
  accountId: string;
  state:
    | "initializing"
    | "qr"
    | "pairing"
    | "authenticated"
    | "ready"
    | "disconnected"
    | "error";
  detail?: string;
};

export type WaInboundPayload = {
  accountId: string;
  id: string;
  chatId: string;
  from: string;
  body: string;
  timestamp: number;
  isFromMe: boolean;
  hasMedia: boolean;
  type: string;
  transcript?: string;
  /** Rough duration from audio size (seconds), for voice-note UI. */
  voiceDurationSec?: number;
};

/** Patches an existing thread message (e.g. voice STT finished in background). */
export type WaMessageUpdatePayload = {
  accountId: string;
  id: string;
  chatId: string;
  transcript?: string;
  voiceDurationSec?: number;
};

export type WaFetchVoiceAudioResult =
  | { ok: true; base64: string; mimeType: string; durationSec?: number }
  | { ok: false; error: string };

export type WaVoiceQueueItem = {
  messageId: string;
  chatId: string;
  status: "queued" | "active";
};

export type WaVoiceQueuePayload = {
  accountId: string;
  pending: number;
  active: number;
  items: WaVoiceQueueItem[];
};

export type WaFetchChatHistoryResult =
  | { ok: true; messages: WaInboundPayload[] }
  | { ok: false; error: string };

export type SettingsSaveResponse = { ok: true } | { ok: false; error: string };

export type ApiKeyCheckResult = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  required: boolean;
};

export type ApiKeysTestResponse = {
  ok: boolean;
  checks: ApiKeyCheckResult[];
  summary: string;
};

/** One row from WhatsApp chat list (fast inbox fill after connect). */
export type WaChatRow = {
  chatId: string;
  /** Display name (contact or group title) */
  title: string;
  preview: string;
  lastAt: number;
  unread: number;
  isGroup?: boolean;
};

export type WaChatsSyncPayload = {
  accountId: string;
  chats: WaChatRow[];
  /** Total chats returned by client (may exceed `chats.length` if capped). */
  totalFetched: number;
};

/** One turn sent to the chat model (WhatsApp customer vs you). */
export type AiThreadTurn = { role: "user" | "assistant"; content: string };

export type WaFetchAiThreadResult =
  | {
      ok: true;
      messages: AiThreadTurn[];
      /** Text of the anchored inbound message (when `anchorMessageId` was passed). */
      lastCustomerText?: string;
      voiceSttMissing?: boolean;
      anchorTranscript?: string;
    }
  | { ok: false; error: string; sttFailed?: boolean };

export type AIReplyVariant = { label: string; text: string };

export type AIReplyRequest = {
  accountId: string;
  chatId: string;
  tone: Tone;
  /** Recent turns for context (newest last) */
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  /** Injected business / FAQ / custom instructions */
  training?: string;
  /** Optional hint from client-detected language */
  languageHint?: string;
  /**
   * When true (manual “Suggest” only), model returns 2–4 human-style reply options
   * (different topics / angles / wording) as JSON — see `variants` on the response.
   */
  multiSuggest?: boolean;
  /**
   * Desktop “re-craft”: improve the current suggestion. When both are set, the model
   * rewrites `seedReply` according to `refinement` (plain text only — no JSON variants).
   */
  seedReply?: string;
  refinement?: string;
  /** WhatsApp direct vs group — steers natural tone (especially draft/auto). */
  chatSurface?: "direct" | "group";
  /**
   * Latest inbound was voice but STT produced no usable text. Model must still reply from
   * thread context and must never mention voice/audio/hearing/typing/download/transcription.
   */
  voiceSttMissing?: boolean;
  /** Latest customer line — primary intent for this reply (this chat only). */
  lastCustomerText?: string;
};

export type AIReplyResponse = {
  text: string;
  provider: "openrouter" | "xai" | "groq" | "openai" | "voice-ai";
  /** Which chat model produced the reply (for debugging / UI). */
  model?: string;
  language?: string;
  /** Populated when `multiSuggest` was used and JSON parsed successfully (≥2 options). */
  variants?: AIReplyVariant[];
};

/** Desktop feature flags (e.g. premium tools unlocked for admin testing). */
export type AppCapabilities = {
  /** Grok image + sticker send tools (xAI images API). */
  premiumMedia: boolean;
};

export type XaiImageStyle = "image" | "sticker";

export type GenerateXaiImageRequest = {
  prompt: string;
  style: XaiImageStyle;
};

export type GenerateXaiImageResponse =
  | { ok: true; base64: string; mimeType: string }
  | { ok: false; error: string };

export type SendMediaB64Request = {
  accountId: string;
  chatId: string;
  base64: string;
  mimeType: string;
  asSticker: boolean;
  caption?: string;
  /** Send recorded / uploaded audio as a WhatsApp voice note (not gated on premium image tools). */
  sendAsVoice?: boolean;
};
