import Groq from "groq-sdk";
import OpenAI from "openai";
import { toFile } from "openai";
import type { AppSecrets } from "../../shared/secrets";
import { verifyGroqApiKey, normalizeGroqApiKey } from "../lib/groq-key";
import { verifyOpenRouterApiKey, normalizeOpenRouterApiKey } from "../lib/openrouter-key";
import { verifyXaiApiKey, normalizeXaiApiKey } from "../lib/xai-key";
import { isFfmpegAvailable } from "./voice-audio-normalize";
import {
  createOpenRouterClient,
  openRouterChatOnce,
  openRouterTranscribeBuffer,
} from "./openrouter-client";
import { loadSecrets, mergeSecretsPatch, applySecretsToProcessEnv } from "./secrets-store";
import type { SecretsPatch } from "../../shared/secrets";

const XAI_BASE_URL = "https://api.x.ai/v1";

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

function buildMinimalWav16kMono(seconds = 0.2): Buffer {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * seconds);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

function parseModelList(raw: string | undefined, fallback: string): string[] {
  const parts = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [fallback];
}

function push(checks: ApiKeyCheckResult[], row: ApiKeyCheckResult): void {
  checks.push(row);
}

async function testOpenRouterChat(key: string, model: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const client = createOpenRouterClient(key);
    const text = await openRouterChatOnce(
      client,
      model,
      [{ role: "user", content: "Reply with exactly: OK" }],
      8,
      0,
    );
    return { ok: Boolean(text), detail: text ? `Model responded: "${text.slice(0, 40)}"` : "Empty chat response" };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function testOpenRouterStt(
  key: string,
  models: string[],
): Promise<{ ok: boolean; detail: string; model?: string }> {
  const wav = buildMinimalWav16kMono();
  const errors: string[] = [];
  for (const model of models) {
    const text = await openRouterTranscribeBuffer(key, wav, model, "wav");
    if (text !== null) {
      return {
        ok: true,
        model,
        detail: text
          ? `STT OK — sample: "${text.slice(0, 48)}"`
          : "STT endpoint OK (silence test — no speech expected)",
      };
    }
    errors.push(`${model}: request failed`);
  }
  return { ok: false, detail: errors.slice(0, 2).join(" · ") || "STT failed" };
}

async function testXaiChat(key: string, model: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const client = new OpenAI({ apiKey: key, baseURL: XAI_BASE_URL });
    const res = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      max_tokens: 8,
      temperature: 0,
    });
    const text = res.choices[0]?.message?.content?.trim();
    return { ok: Boolean(text), detail: text ? `Model responded: "${text.slice(0, 40)}"` : "Empty chat response" };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function testXaiStt(key: string, models: string[]): Promise<{ ok: boolean; detail: string; model?: string }> {
  const wav = buildMinimalWav16kMono();
  const client = new OpenAI({ apiKey: key, baseURL: XAI_BASE_URL });
  const audioFile = await toFile(wav, "desk-stt-test.wav", { type: "audio/wav" });
  const errors: string[] = [];
  for (const model of models) {
    try {
      const result = await client.audio.transcriptions.create({ file: audioFile, model });
      const text = result.text?.trim() ?? "";
      return {
        ok: true,
        model,
        detail: text
          ? `STT OK — sample: "${text.slice(0, 48)}"`
          : "STT endpoint OK (silence test — no speech expected)",
      };
    } catch (e) {
      errors.push(`${model}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { ok: false, detail: errors.slice(0, 2).join(" · ") || "STT failed" };
}

async function testGroqChat(key: string, model: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const groq = new Groq({ apiKey: key });
    const res = await groq.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      max_tokens: 8,
      temperature: 0,
    });
    const text = res.choices[0]?.message?.content?.trim();
    return { ok: Boolean(text), detail: text ? `Model responded: "${text.slice(0, 40)}"` : "Empty chat response" };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

async function testGroqWhisper(key: string, models: string[]): Promise<{ ok: boolean; detail: string; model?: string }> {
  const wav = buildMinimalWav16kMono();
  const groq = new Groq({ apiKey: key });
  const audioFile = await toFile(wav, "desk-stt-test.wav", { type: "audio/wav" });
  const errors: string[] = [];
  for (const model of models) {
    try {
      const result = await groq.audio.transcriptions.create({ file: audioFile, model });
      const text = result.text?.trim() ?? "";
      return {
        ok: true,
        model,
        detail: text
          ? `Whisper OK — sample: "${text.slice(0, 48)}"`
          : "Whisper endpoint OK (silence test)",
      };
    } catch (e) {
      errors.push(`${model}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { ok: false, detail: errors.slice(0, 2).join(" · ") || "Whisper failed" };
}

export async function runApiKeysHealthCheck(patch?: SecretsPatch): Promise<ApiKeysTestResponse> {
  const cur = await loadSecrets();
  const secrets: AppSecrets = patch ? mergeSecretsPatch(cur, patch) : cur;
  applySecretsToProcessEnv(secrets, patch);

  const checks: ApiKeyCheckResult[] = [];

  const ffmpegOk = await isFfmpegAvailable();
  push(checks, {
    id: "ffmpeg",
    label: "ffmpeg (voice normalize)",
    ok: ffmpegOk,
    detail: ffmpegOk
      ? "Installed — voice notes convert to WAV before STT"
      : "Not on PATH — install ffmpeg for reliable voice transcription (winget install Gyan.FFmpeg)",
    required: false,
  });

  const orKey = normalizeOpenRouterApiKey(secrets.openrouterApiKey);
  const orChatModel = secrets.openrouterChatModel?.trim() || "google/gemini-2.5-flash";
  const orSttModels = parseModelList(secrets.openrouterSttModel, "openai/whisper-large-v3-turbo");

  if (orKey) {
    const keyCheck = await verifyOpenRouterApiKey(orKey);
    push(checks, {
      id: "openrouter_key",
      label: "OpenRouter API key",
      ok: keyCheck.ok,
      detail: keyCheck.ok ? "Key accepted by openrouter.ai" : `HTTP ${keyCheck.status}: ${keyCheck.detail}`,
      required: true,
    });

    if (keyCheck.ok) {
      const chat = await testOpenRouterChat(orKey, orChatModel);
      push(checks, {
        id: "openrouter_chat",
        label: `OpenRouter chat · ${orChatModel}`,
        ok: chat.ok,
        detail: chat.detail,
        required: true,
      });

      const stt = await testOpenRouterStt(orKey, orSttModels);
      push(checks, {
        id: "openrouter_stt",
        label: `OpenRouter voice STT · ${stt.model ?? orSttModels[0]}`,
        ok: stt.ok,
        detail: stt.detail,
        required: true,
      });
    }
  } else {
    push(checks, {
      id: "openrouter_key",
      label: "OpenRouter API key",
      ok: false,
      detail: "Required — get one at openrouter.ai/keys (one key for chat + voice)",
      required: true,
    });
  }

  const xaiKey = normalizeXaiApiKey(secrets.xaiApiKey);
  if (xaiKey) {
    const xaiChatModel = secrets.xaiChatModel?.trim() || "grok-3";
    const xaiSttModels = parseModelList(secrets.xaiSttModel, "grok-stt");
    const keyCheck = await verifyXaiApiKey(xaiKey);
    push(checks, {
      id: "xai_key",
      label: "xAI API key (legacy)",
      ok: keyCheck.ok,
      detail: keyCheck.ok ? "Key accepted — used only if OpenRouter key is removed" : `HTTP ${keyCheck.status}: ${keyCheck.detail}`,
      required: false,
    });
    if (keyCheck.ok) {
      const chat = await testXaiChat(xaiKey, xaiChatModel);
      push(checks, {
        id: "xai_chat",
        label: `Grok chat · ${xaiChatModel}`,
        ok: chat.ok,
        detail: chat.detail,
        required: false,
      });
      const stt = await testXaiStt(xaiKey, xaiSttModels);
      push(checks, {
        id: "xai_stt",
        label: `Grok voice STT · ${stt.model ?? xaiSttModels[0]}`,
        ok: stt.ok,
        detail: stt.detail,
        required: false,
      });
    }
  }

  const groqKey = normalizeGroqApiKey(secrets.groqApiKey);
  if (groqKey) {
    const groqChatModel = secrets.groqModel?.trim() || "llama-3.3-70b-versatile";
    const groqWhisperModels = parseModelList(secrets.whisperModel, "whisper-large-v3-turbo");
    const keyCheck = await verifyGroqApiKey(groqKey);
    push(checks, {
      id: "groq_key",
      label: "Groq API key (legacy)",
      ok: keyCheck.ok,
      detail: keyCheck.ok ? "Key accepted — backup only" : `HTTP ${keyCheck.status}: ${keyCheck.detail}`,
      required: false,
    });
    if (keyCheck.ok) {
      const chat = await testGroqChat(groqKey, groqChatModel);
      push(checks, {
        id: "groq_chat",
        label: `Groq chat · ${groqChatModel}`,
        ok: chat.ok,
        detail: chat.detail,
        required: false,
      });
      const whisper = await testGroqWhisper(groqKey, groqWhisperModels);
      push(checks, {
        id: "groq_whisper",
        label: `Groq Whisper · ${whisper.model ?? groqWhisperModels[0]}`,
        ok: whisper.ok,
        detail: whisper.detail,
        required: false,
      });
    }
  }

  const requiredFails = checks.filter((c) => c.required && !c.ok);
  const ok = requiredFails.length === 0;
  const summary = ok
    ? "All required checks passed — voice notes and AI replies should work."
    : `${requiredFails.length} required check(s) failed — fix these before using voice or AI.`;

  return { ok, checks, summary };
}
