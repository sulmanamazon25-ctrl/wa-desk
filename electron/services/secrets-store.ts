import { promises as fs } from "node:fs";
import path from "node:path";
import { BrowserWindow, app } from "electron";
import type { AppSecrets, SecretsFormModel, SecretsPatch } from "../../shared/secrets";
import { AppSecretsSchema } from "../../shared/secrets";
import { normalizeGroqApiKey } from "../lib/groq-key";
import { normalizeOpenRouterApiKey } from "../lib/openrouter-key";
import { normalizeXaiApiKey } from "../lib/xai-key";

function secretsPath() {
  return path.join(app.getPath("userData"), "app-secrets.json");
}

export async function loadSecrets(): Promise<AppSecrets> {
  try {
    const raw = await fs.readFile(secretsPath(), "utf8");
    return AppSecretsSchema.parse(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}

export async function saveSecrets(next: AppSecrets): Promise<void> {
  const parsed = AppSecretsSchema.parse(next);
  await fs.mkdir(path.dirname(secretsPath()), { recursive: true });
  await fs.writeFile(secretsPath(), JSON.stringify(parsed, null, 2), "utf8");
}

/** Apply saved secrets; optional `patch` clears env keys when user explicitly removed a secret. */
export function applySecretsToProcessEnv(secrets: AppSecrets, patch?: SecretsPatch) {
  /* Never use generic OpenAI env from disk for our providers (xAI / Groq use their own keys). */
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  delete process.env.OPENAI_MODEL_LIST;
  delete process.env.WHISPER_MODEL;

  const clear = (patchKey: keyof SecretsPatch, envKey: string) => {
    if (patch && Object.prototype.hasOwnProperty.call(patch, patchKey) && patch[patchKey] === null) {
      delete process.env[envKey];
    }
  };

  clear("openrouterApiKey", "OPENROUTER_API_KEY");
  clear("openrouterChatModel", "OPENROUTER_CHAT_MODEL");
  clear("xaiApiKey", "XAI_API_KEY");
  clear("xaiChatModel", "XAI_CHAT_MODEL");
  clear("groqApiKey", "GROQ_API_KEY");
  clear("groqModel", "GROQ_MODEL");
  clear("whisperModel", "GROQ_WHISPER_MODEL_LIST");
  clear("supabaseUrl", "NEXT_PUBLIC_SUPABASE_URL");
  clear("supabaseAnonKey", "NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (patch && Object.prototype.hasOwnProperty.call(patch, "openrouterSttModel") && patch.openrouterSttModel === null) {
    delete process.env.OPENROUTER_STT_MODEL;
    delete process.env.OPENROUTER_STT_MODEL_LIST;
  }

  if (patch && Object.prototype.hasOwnProperty.call(patch, "xaiSttModel") && patch.xaiSttModel === null) {
    delete process.env.XAI_STT_MODEL;
    delete process.env.XAI_STT_MODEL_LIST;
  }

  const set = (envKey: string, value: string | undefined) => {
    if (value === undefined || value === "") return;
    process.env[envKey] = value;
  };

  const orKey = normalizeOpenRouterApiKey(secrets.openrouterApiKey);
  if (orKey) process.env.OPENROUTER_API_KEY = orKey;
  set("OPENROUTER_CHAT_MODEL", secrets.openrouterChatModel?.trim());

  const orStt = secrets.openrouterSttModel?.trim();
  if (orStt) {
    if (orStt.includes(",")) {
      process.env.OPENROUTER_STT_MODEL_LIST = orStt;
      delete process.env.OPENROUTER_STT_MODEL;
    } else {
      process.env.OPENROUTER_STT_MODEL = orStt;
      delete process.env.OPENROUTER_STT_MODEL_LIST;
    }
  }

  const xaiKey = normalizeXaiApiKey(secrets.xaiApiKey);
  if (xaiKey) process.env.XAI_API_KEY = xaiKey;
  set("XAI_CHAT_MODEL", secrets.xaiChatModel?.trim());

  const stt = secrets.xaiSttModel?.trim();
  if (stt) {
    if (stt.includes(",")) {
      process.env.XAI_STT_MODEL_LIST = stt;
      delete process.env.XAI_STT_MODEL;
    } else {
      process.env.XAI_STT_MODEL = stt;
      delete process.env.XAI_STT_MODEL_LIST;
    }
  }

  const groqKey = normalizeGroqApiKey(secrets.groqApiKey);
  if (groqKey) process.env.GROQ_API_KEY = groqKey;
  set("GROQ_MODEL", secrets.groqModel?.trim());
  set("GROQ_WHISPER_MODEL_LIST", secrets.whisperModel?.trim());
  set("NEXT_PUBLIC_SUPABASE_URL", secrets.supabaseUrl?.trim());
  set("NEXT_PUBLIC_SUPABASE_ANON_KEY", secrets.supabaseAnonKey?.trim());
}

export function mergeSecretsPatch(current: AppSecrets, patch: SecretsPatch): AppSecrets {
  const next: AppSecrets = { ...current };
  (Object.keys(patch) as (keyof SecretsPatch)[]).forEach((key) => {
    const v = patch[key];
    if (v === undefined) return;
    if (v === null) {
      delete (next as Record<string, unknown>)[key];
      return;
    }
    let out: string = v;
    if (key === "groqApiKey") {
      const n = normalizeGroqApiKey(v);
      if (!n) {
        delete (next as Record<string, unknown>)["groqApiKey"];
        return;
      }
      out = n;
    } else if (key === "xaiApiKey") {
      const n = normalizeXaiApiKey(v);
      if (!n) {
        delete (next as Record<string, unknown>)["xaiApiKey"];
        return;
      }
      out = n;
    } else if (key === "openrouterApiKey") {
      const n = normalizeOpenRouterApiKey(v);
      if (!n) {
        delete (next as Record<string, unknown>)["openrouterApiKey"];
        return;
      }
      out = n;
    } else if (typeof v === "string") {
      out = v.trim();
    }
    (next as Record<string, string>)[key] = out;
  });
  return AppSecretsSchema.parse(next);
}

export function broadcastPublicConfig(secrets: AppSecrets) {
  const payload = {
    supabaseUrl: secrets.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: secrets.supabaseAnonKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  };
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("app:public-config-updated", payload);
  }
}

export async function getSecretsFormModel(): Promise<SecretsFormModel> {
  const s = await loadSecrets();
  const envGroq = normalizeGroqApiKey(process.env.GROQ_API_KEY);
  const envXai = normalizeXaiApiKey(process.env.XAI_API_KEY);
  const envOr = normalizeOpenRouterApiKey(process.env.OPENROUTER_API_KEY);
  return {
    openrouterApiKey: "",
    openrouterChatModel:
      s.openrouterChatModel ||
      process.env.OPENROUTER_CHAT_MODEL ||
      "google/gemini-2.5-flash",
    openrouterSttModel:
      s.openrouterSttModel?.trim() ||
      process.env.OPENROUTER_STT_MODEL?.trim() ||
      process.env.OPENROUTER_STT_MODEL_LIST?.split(",")[0]?.trim() ||
      "openai/whisper-large-v3-turbo",
    xaiApiKey: "",
    xaiChatModel: s.xaiChatModel || process.env.XAI_CHAT_MODEL || "grok-3",
    xaiSttModel:
      s.xaiSttModel?.trim() ||
      process.env.XAI_STT_MODEL?.trim() ||
      process.env.XAI_STT_MODEL_LIST?.split(",")[0]?.trim() ||
      "grok-stt",
    groqApiKey: "",
    groqModel: s.groqModel || process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    whisperModel: s.whisperModel || process.env.GROQ_WHISPER_MODEL_LIST || "whisper-large-v3-turbo",
    supabaseUrl: s.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    supabaseAnonKey: "",
    metaWaAccessToken: "",
    metaWaPhoneNumberId: s.metaWaPhoneNumberId || "",
    metaWaBusinessAccountId: s.metaWaBusinessAccountId || "",
    metaWaVerifyToken: "",
    configured: {
      openrouterApiKey: !!(normalizeOpenRouterApiKey(s.openrouterApiKey) || envOr),
      xaiApiKey: !!(normalizeXaiApiKey(s.xaiApiKey) || envXai),
      groqApiKey: !!(normalizeGroqApiKey(s.groqApiKey) || envGroq),
      supabaseAnonKey: !!(s.supabaseAnonKey?.trim() || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      metaWaAccessToken: !!s.metaWaAccessToken?.trim(),
      metaWaVerifyToken: !!s.metaWaVerifyToken?.trim(),
    },
  };
}
