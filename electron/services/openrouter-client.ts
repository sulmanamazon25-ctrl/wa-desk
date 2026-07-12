import OpenAI from "openai";
import { normalizeOpenRouterApiKey } from "../lib/openrouter-key";
import { loadSecrets } from "./secrets-store";

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export const DEFAULT_OPENROUTER_CHAT_MODELS = [
  "google/gemini-2.5-flash",
  "anthropic/claude-sonnet-4",
  "openai/gpt-4o-mini",
] as const;

export const DEFAULT_OPENROUTER_STT_MODELS = [
  "openai/whisper-large-v3-turbo",
  "groq/whisper-large-v3-turbo",
  "openai/whisper-large-v3",
] as const;

function openRouterAppReferer(): string {
  return process.env.OPENROUTER_HTTP_REFERER?.trim() || "https://whatsapp-ai-desk.local";
}

function openRouterAppTitle(): string {
  return process.env.OPENROUTER_APP_TITLE?.trim() || "WhatsApp AI Desk";
}

export function openRouterExtraHeaders(): Record<string, string> {
  return {
    "HTTP-Referer": openRouterAppReferer(),
    "X-Title": openRouterAppTitle(),
  };
}

export async function resolveOpenRouterApiKey(): Promise<string | undefined> {
  const disk = await loadSecrets();
  const fromDisk = normalizeOpenRouterApiKey(disk.openrouterApiKey);
  if (fromDisk) {
    process.env.OPENROUTER_API_KEY = fromDisk;
    return fromDisk;
  }
  return normalizeOpenRouterApiKey(process.env.OPENROUTER_API_KEY);
}

export function createOpenRouterClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: openRouterExtraHeaders(),
  });
}

export async function openRouterChatOnce(
  client: OpenAI,
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
  temperature: number,
): Promise<string | null> {
  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });
  return completion.choices[0]?.message?.content?.trim() || null;
}

type SttResponse = { text?: string; error?: { message?: string } };

/** Transcribe WAV (or other) buffer via OpenRouter /audio/transcriptions (base64 JSON). */
export async function openRouterTranscribeBuffer(
  apiKey: string,
  buffer: Buffer,
  model: string,
  format: "wav" | "ogg" | "mp3" | "flac" | "m4a" = "wav",
): Promise<string | null> {
  const body = {
    model,
    input_audio: {
      data: buffer.toString("base64"),
      format,
    },
  };
  const res = await fetch(`${OPENROUTER_BASE_URL}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...openRouterExtraHeaders(),
    },
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  if (!res.ok) {
    if (process.env.WWEBJS_DEV_LOG === "1") {
      console.warn(`[desk] OpenRouter STT model=${model} HTTP ${res.status}:`, raw.slice(0, 300));
    }
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as SttResponse;
    if (typeof parsed.text !== "string") return null;
    return parsed.text.trim();
  } catch {
    return null;
  }
}

export function parseOpenRouterChatModels(primary?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (m: string) => {
    const k = m.trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(k);
  };
  if (primary?.trim()) add(primary.trim());
  for (const m of DEFAULT_OPENROUTER_CHAT_MODELS) add(m);
  return out;
}

export function parseOpenRouterSttModels(primary?: string, listEnv?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (m: string) => {
    const k = m.trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(k);
  };
  if (primary?.trim()) add(primary.trim());
  if (listEnv?.trim()) {
    for (const part of listEnv.split(/[,;\s]+/)) add(part);
  }
  for (const m of DEFAULT_OPENROUTER_STT_MODELS) add(m);
  return out;
}
