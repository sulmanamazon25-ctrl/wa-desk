/**
 * Optional integration with the standalone `voice-ai-assistant` HTTP service
 * (Express: POST /upload-audio). When `WWEBJS_REMOTE_VOICE_AI_URL` is set, the
 * WhatsApp main process can send downloaded voice bytes there for a single
 * transcription + chat reply (same single-key stack as that service).
 *
 * Env:
 *   WWEBJS_REMOTE_VOICE_AI_URL — base URL only, e.g. http://127.0.0.1:8787 (no trailing slash required)
 *   WWEBJS_REMOTE_VOICE_AI_TIMEOUT_MS — optional fetch timeout (default 180000)
 */

import type { AiThreadTurn } from "../ipc-contract";

const DEFAULT_TIMEOUT_MS = 180_000;

export function getRemoteVoiceAiBaseUrl(): string | null {
  const raw = process.env.WWEBJS_REMOTE_VOICE_AI_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

function remoteTimeoutMs(): number {
  const n = Number(process.env.WWEBJS_REMOTE_VOICE_AI_TIMEOUT_MS);
  if (!Number.isFinite(n) || n < 10_000 || n > 600_000) return DEFAULT_TIMEOUT_MS;
  return Math.floor(n);
}

export type RemoteVoiceAiResult = {
  transcription: string;
  reply: string;
  sttProvider?: string;
  sttModel?: string;
  chatProvider?: string;
  chatModel?: string;
};

/**
 * Flatten recent AI turns into a bounded string for the HTTP service `context` field.
 * Keeps business training + thread text so the remote model matches your FAQ tone.
 */
export function buildRemoteVoiceContext(training: string, turns: AiThreadTurn[], chatSurface: "direct" | "group"): string {
  const lines = turns.map((t) => `${t.role}: ${t.content}`.replace(/\s+/g, " ").trim());
  const thread = lines.join("\n").slice(0, 12_000);
  const train = (training || "").trim().slice(0, 8000);
  const parts = [
    `WhatsApp ${chatSurface} thread (text; current message is the attached voice):`,
    thread || "(no prior text in window)",
  ];
  if (train) {
    parts.unshift(`Business / owner instructions (follow faithfully, do not invent facts):\n${train}`);
  }
  return parts.join("\n\n---\n\n").slice(0, 20_000);
}

/**
 * Map remote JSON providers to UI / IPC union used by draft dock.
 */
export function mapRemoteProviderForUi(chatProvider?: string, sttProvider?: string): "xai" | "groq" | "openai" | "voice-ai" {
  const c = (chatProvider || "").toLowerCase();
  if (c === "xai") return "xai";
  if (c === "openai") return "openai";
  if (c === "groq") return "groq";
  const s = (sttProvider || "").toLowerCase();
  if (s === "xai") return "xai";
  if (s === "openai") return "openai";
  if (s === "groq") return "groq";
  return "voice-ai";
}

export type RemoteVoiceAiUploadArgs = {
  buffer: Buffer;
  originalName: string;
  mimetype: string;
  context: string;
};

/**
 * POST multipart to `{baseUrl}/upload-audio` and parse JSON.
 * Uses Node global `fetch` (Electron / Node 20+).
 */
export async function postRemoteVoiceAiUpload(baseUrl: string, args: RemoteVoiceAiUploadArgs): Promise<RemoteVoiceAiResult> {
  const url = `${baseUrl.replace(/\/$/, "")}/upload-audio`;
  const form = new FormData();
  const blob = new Blob([new Uint8Array(args.buffer)], {
    type: args.mimetype || "application/octet-stream",
  });
  form.append("audio", blob, args.originalName || "voice.ogg");
  if (args.context.trim()) {
    form.append("context", args.context.trim());
  }

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), remoteTimeoutMs());
  try {
    const res = await fetch(url, { method: "POST", body: form, signal: ac.signal });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      const msg =
        (json && typeof json.message === "string" && json.message) ||
        (json && typeof json.error === "string" && json.error) ||
        `HTTP ${res.status}`;
      throw new Error(`remote voice-ai: ${msg}`);
    }
    if (!json || json.ok !== true) {
      const msg =
        (json && typeof json.message === "string" && json.message) ||
        (json && typeof json.error === "string" && json.error) ||
        "unexpected JSON";
      throw new Error(`remote voice-ai: ${msg}`);
    }
    const transcription = typeof json.transcription === "string" ? json.transcription.trim() : "";
    const reply = typeof json.reply === "string" ? json.reply.trim() : "";
    return {
      transcription,
      reply,
      sttProvider: typeof json.sttProvider === "string" ? json.sttProvider : undefined,
      sttModel: typeof json.sttModel === "string" ? json.sttModel : undefined,
      chatProvider: typeof json.chatProvider === "string" ? json.chatProvider : undefined,
      chatModel: typeof json.chatModel === "string" ? json.chatModel : undefined,
    };
  } finally {
    clearTimeout(t);
  }
}
