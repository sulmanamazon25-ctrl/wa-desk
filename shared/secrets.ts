import { z } from "zod";

/** Stored on disk under Electron userData (never commit). */
export const AppSecretsSchema = z.object({
  /** OpenRouter — unified chat + STT (https://openrouter.ai/api/v1). */
  openrouterApiKey: z.string().optional(),
  /** e.g. anthropic/claude-sonnet-4, google/gemini-2.5-flash */
  openrouterChatModel: z.string().optional(),
  /** e.g. openai/whisper-large-v3-turbo; comma = try in order */
  openrouterSttModel: z.string().optional(),
  /** xAI Grok — legacy fallback chat + STT (OpenAI-compatible base URL https://api.x.ai/v1). */
  xaiApiKey: z.string().optional(),
  /** e.g. grok-3, grok-4.3 — see x.ai/models */
  xaiChatModel: z.string().optional(),
  /** Grok STT model(s) — same xAI key as chat. Default grok-stt; comma = try in order. */
  xaiSttModel: z.string().optional(),
  groqApiKey: z.string().optional(),
  groqModel: z.string().optional(),
  /** Groq Whisper model id(s); comma-separated ok — maps to GROQ_WHISPER_MODEL_LIST. */
  whisperModel: z.string().optional(),
  supabaseUrl: z.string().optional(),
  supabaseAnonKey: z.string().optional(),
  /** Meta WhatsApp Cloud API — reserved for a future HTTP transport (not whatsapp-web.js). */
  metaWaAccessToken: z.string().optional(),
  metaWaPhoneNumberId: z.string().optional(),
  metaWaBusinessAccountId: z.string().optional(),
  metaWaVerifyToken: z.string().optional(),
});

export type AppSecrets = z.infer<typeof AppSecretsSchema>;

/**
 * Patch for save: `undefined` = leave unchanged, `null` = remove, string = set.
 */
export const SecretsPatchSchema = z.object({
  openrouterApiKey: z.union([z.string(), z.null()]).optional(),
  openrouterChatModel: z.union([z.string(), z.null()]).optional(),
  openrouterSttModel: z.union([z.string(), z.null()]).optional(),
  xaiApiKey: z.union([z.string(), z.null()]).optional(),
  xaiChatModel: z.union([z.string(), z.null()]).optional(),
  xaiSttModel: z.union([z.string(), z.null()]).optional(),
  groqApiKey: z.union([z.string(), z.null()]).optional(),
  groqModel: z.union([z.string(), z.null()]).optional(),
  whisperModel: z.union([z.string(), z.null()]).optional(),
  supabaseUrl: z.union([z.string(), z.null()]).optional(),
  supabaseAnonKey: z.union([z.string(), z.null()]).optional(),
  metaWaAccessToken: z.union([z.string(), z.null()]).optional(),
  metaWaPhoneNumberId: z.union([z.string(), z.null()]).optional(),
  metaWaBusinessAccountId: z.union([z.string(), z.null()]).optional(),
  metaWaVerifyToken: z.union([z.string(), z.null()]).optional(),
});

export type SecretsPatch = z.infer<typeof SecretsPatchSchema>;

export type SecretsFormModel = {
  openrouterApiKey: string;
  openrouterChatModel: string;
  openrouterSttModel: string;
  xaiApiKey: string;
  xaiChatModel: string;
  /** xAI Grok STT — same key as chat */
  xaiSttModel: string;
  groqApiKey: string;
  groqModel: string;
  whisperModel: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  metaWaAccessToken: string;
  metaWaPhoneNumberId: string;
  metaWaBusinessAccountId: string;
  metaWaVerifyToken: string;
  /** Which fields already have a saved value (inputs stay blank = keep). */
  configured: {
    openrouterApiKey: boolean;
    xaiApiKey: boolean;
    groqApiKey: boolean;
    supabaseAnonKey: boolean;
    metaWaAccessToken: boolean;
    metaWaVerifyToken: boolean;
  };
};
