/**
 * WhatsApp inbound + simulation. Optional economy env (no effect until set):
 * WWEBJS_TYPING_DELAY_MIN_MS / WWEBJS_TYPING_DELAY_MAX_MS — uniform ms before typing state (both; clamp 200–120000).
 * WWEBJS_TYPING_DELAY_MULT — multiplier for default first delay if min/max unset (0.25–4).
 * WWEBJS_TYPING_POST_MIN_MS / WWEBJS_TYPING_POST_MAX_MS — uniform ms after sendStateTyping before send (both; same clamp).
 * WWEBJS_TYPING_POST_JITTER_MAX_MS — extra 0..N ms jitter on default post-state delay only (0–5000; default 400).
 * WWEBJS_VOICE_STT_MAX_BYTES — skip STT above this size (clamp 4096–52428800 bytes).
 * WWEBJS_VOICE_STT_MAX_SECONDS — skip STT when length/2000 exceeds this crude estimate (1–900 s).
 * WWEBJS_VOICE_STT_ORDER — optional override: groq-first | xai-first. If unset: xAI STT runs first when only an xAI key is saved; otherwise Groq Whisper first.
 * WWEBJS_REMOTE_VOICE_AI_URL — optional base URL of the standalone voice-ai-assistant service
 *   (e.g. http://127.0.0.1:8787). When set, Auto mode uses POST /upload-audio for voice (STT+reply);
 *   Draft mode uses it for the debounced draft suggestion. Paused mode never calls the remote service.
 * WWEBJS_REMOTE_VOICE_AI_TIMEOUT_MS — optional fetch timeout for that service (10000–600000; default 180000).
 */

import { rm } from "node:fs/promises";
import path from "node:path";
import { BrowserWindow, app } from "electron";
import qrcode from "qrcode-terminal";
import { Client, LocalAuth, Message, MessageMedia, MessageTypes } from "whatsapp-web.js";
import type { Chat } from "whatsapp-web.js";
import type { ChatReplyRoute, ReplyMode, WaChatsSyncPayload, WaChatRow, WaDraftReplyPayload, WaFetchAiThreadResult, WaFetchVoiceAudioResult, WaInboundPayload, WaMessageUpdatePayload, WaPairingCodePayload, WaQrPayload, WaStartRequest, WaStatusPayload, WaVoiceQueuePayload } from "../ipc-contract";
import { formatWaChatId } from "../../shared/format-wa-id";
import { isVoiceNoteMessage } from "../../shared/wa-voice-note";
import { generateReply, transcribeVoiceOggBuffer, type VoiceSttMeta } from "./ai-orchestrator";
import { syncLinkedComposeDraft } from "../lib/wwebjs-compose-sync";
import { chromeNotFoundMessage, resolveChromeExecutablePath } from "../lib/puppeteer-chrome-path";
import * as chatReplyRoutes from "./chat-reply-routes-store";
import { bundleToPromptText, loadTraining } from "./training-store";
import {
  buildRemoteVoiceContext,
  getRemoteVoiceAiBaseUrl,
  mapRemoteProviderForUi,
  postRemoteVoiceAiUpload,
} from "./remote-voice-ai-client";
import * as chatMemory from "./chat-memory-store";

type ClientBundle = {
  client: Client;
  replyMode: ReplyMode;
  /** False until user explicitly picks a reply mode after connect — inbox stays human-only until then. */
  automationArmed: boolean;
  sessionReadyAt: number;
};

function broadcast(channel: string, payload: unknown) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

function userDataDir(): string {
  return app.getPath("userData");
}

/** How many WhatsApp messages to load for AI context (whatsapp-web.js loads earlier chunks as needed). */
function aiHistoryFetchLimit(): number {
  const n = Number(process.env.WWEBJS_AI_FETCH_LIMIT);
  if (Number.isFinite(n) && n >= 10 && n <= 200) return Math.floor(n);
  return 80;
}

/** Turns sent to the chat model per reply (focused window — not full UI history). */
function aiReplyTurnLimit(): number {
  const n = Number(process.env.WWEBJS_AI_REPLY_TURNS);
  if (Number.isFinite(n) && n >= 4 && n <= 40) return Math.floor(n);
  return 14;
}

/** Max customer voice notes to STT inside the reply context window. */
function voiceSttReplyWindow(): number {
  const n = Number(process.env.WWEBJS_VOICE_STT_REPLY_WINDOW);
  if (Number.isFinite(n) && n >= 0 && n <= 8) return Math.floor(n);
  return 2;
}

function draftDebounceMs(): number {
  const n = Number(process.env.WWEBJS_DRAFT_DEBOUNCE_MS);
  if (Number.isFinite(n) && n >= 1500 && n <= 45000) return Math.floor(n);
  return 6000;
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function parseEnvClampIntLoHi(name: string, lo: number, hi: number): number | null {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return null;
  return clampInt(Math.floor(n), lo, hi);
}

function parseEnvMult(name: string, lo: number, hi: number): number | null {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return null;
  return Math.min(hi, Math.max(lo, n));
}

function typingDelayPrimaryMs(replyTextLen: number): number {
  const mn = parseEnvClampIntLoHi("WWEBJS_TYPING_DELAY_MIN_MS", 200, 120_000);
  const mx = parseEnvClampIntLoHi("WWEBJS_TYPING_DELAY_MAX_MS", 200, 120_000);
  if (mn != null && mx != null) {
    const lo = Math.min(mn, mx);
    const hi = Math.max(mn, mx);
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }
  const mult = parseEnvMult("WWEBJS_TYPING_DELAY_MULT", 0.25, 4);
  let base = 400 + Math.min(1800, replyTextLen * 8);
  if (mult != null) base = clampInt(Math.round(base * mult), 200, 120_000);
  return base + Math.floor(Math.random() * 500);
}

function typingDelayPostStateMs(replyText: string): number {
  const mn = parseEnvClampIntLoHi("WWEBJS_TYPING_POST_MIN_MS", 200, 120_000);
  const mx = parseEnvClampIntLoHi("WWEBJS_TYPING_POST_MAX_MS", 200, 120_000);
  if (mn != null && mx != null) {
    const lo = Math.min(mn, mx);
    const hi = Math.max(mn, mx);
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }
  const len = replyText.length;
  const base = Math.min(2500, Math.max(400, len * 12));
  const jitterMax = parseEnvClampIntLoHi("WWEBJS_TYPING_POST_JITTER_MAX_MS", 0, 5000) ?? 400;
  return base + Math.floor(Math.random() * (jitterMax + 1));
}

/** ~32 kbps-ish upper-ish bound on seconds from byte size — conservative economy skip only. */
function voiceBufferRoughSeconds(buf: Buffer): number {
  return buf.length / 2000;
}

function voiceSttMaxBytesEnv(): number | null {
  const n = Number(process.env.WWEBJS_VOICE_STT_MAX_BYTES);
  if (!Number.isFinite(n) || n <= 0) return null;
  return clampInt(Math.floor(n), 4096, 52_428_800);
}

function voiceSttMaxSecondsEnv(): number | null {
  const n = Number(process.env.WWEBJS_VOICE_STT_MAX_SECONDS);
  if (!Number.isFinite(n)) return null;
  return clampInt(n, 1, 900);
}

type VoiceSttInboundResult = "ok" | "none" | "cap-bytes" | "cap-time" | "fail";

async function transcribeInboundVoiceBuf(
  buf: Buffer,
  meta?: VoiceSttMeta,
): Promise<{ text?: string; stt: VoiceSttInboundResult; error?: string }> {
  const maxB = voiceSttMaxBytesEnv();
  if (maxB != null && buf.length > maxB) {
    if (process.env.WWEBJS_DEV_LOG === "1") {
      console.log(`[desk] voice STT skipped: cap-bytes (${buf.length} > ${maxB})`);
    }
    return { stt: "cap-bytes", error: `Voice larger than cap (${buf.length} bytes).` };
  }
  const maxS = voiceSttMaxSecondsEnv();
  if (maxS != null && voiceBufferRoughSeconds(buf) > maxS) {
    if (process.env.WWEBJS_DEV_LOG === "1") {
      console.log(`[desk] voice STT skipped: cap-time (est>s ${maxS})`);
    }
    return { stt: "cap-time", error: `Voice longer than cap (~${maxS}s estimate).` };
  }
  try {
    const text = (await transcribeVoiceOggBuffer(buf, meta)).trim();
    return text ? { text, stt: "ok" } : { stt: "fail", error: "Transcription returned empty." };
  } catch (e) {
    return { stt: "fail", error: e instanceof Error ? e.message : String(e) };
  }
}

async function transcribeVoiceBufForAiThread(
  buf: Buffer,
  meta?: VoiceSttMeta,
): Promise<{ text?: string; skip: boolean }> {
  const maxB = voiceSttMaxBytesEnv();
  if (maxB != null && buf.length > maxB) return { skip: true };
  const maxS = voiceSttMaxSecondsEnv();
  if (maxS != null && voiceBufferRoughSeconds(buf) > maxS) return { skip: true };
  try {
    const text = (await transcribeVoiceOggBuffer(buf, meta)).trim();
    return text ? { text, skip: false } : { skip: false };
  } catch {
    return { skip: false };
  }
}

function deskDevLoggingEnabled(): boolean {
  return process.env.WWEBJS_DEV_LOG === "1" || process.env.NODE_ENV === "development";
}

function latencyBucketMs(ms: number): string {
  if (ms < 2000) return "<2s";
  if (ms < 5000) return "2-5s";
  if (ms < 10000) return "5-10s";
  return "10s+";
}

function chatIdSuffixForLog(chatId: string): string {
  const p = chatId.split("@")[0] ?? "";
  return p.length <= 8 ? p : p.slice(-8);
}

function messageFilename(m: Message): string | undefined {
  const raw = (m as unknown as { rawData?: { filename?: string } }).rawData;
  return typeof raw?.filename === "string" ? raw.filename : undefined;
}

function isWaVoice(m: Message): boolean {
  return isVoiceNoteMessage({
    type: String(m.type),
    hasMedia: m.hasMedia,
    filename: messageFilename(m),
  });
}

function waMsgIdMatch(m: Message, other?: Message): boolean {
  if (!other) return false;
  const a = m.id?.id;
  const b = other.id?.id;
  if (a && b && a === b) return true;
  const as = m.id?._serialized;
  const bs = other.id?._serialized;
  return !!(as && bs && as === bs);
}

function hasVoiceTranscriptText(t: string | undefined): boolean {
  return isUsefulVoiceTranscript(t);
}

function aiSuggestTurnLimit(): number {
  const n = Number(process.env.WWEBJS_AI_SUGGEST_TURNS);
  if (Number.isFinite(n) && n >= 2 && n <= 12) return Math.floor(n);
  return 6;
}

function trimTurnsForAnchoredSuggest(
  turns: { role: "user" | "assistant"; content: string }[],
  anchorText: string,
): { role: "user" | "assistant"; content: string }[] {
  const anchor = anchorText.trim();
  if (!anchor) return turns.slice(-aiSuggestTurnLimit());

  let anchorIdx = -1;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role !== "user") continue;
    const c = turns[i].content.trim();
    if (!c || isCustomerPlaceholderContent(c)) continue;
    anchorIdx = i;
    break;
  }
  if (anchorIdx < 0) anchorIdx = turns.length - 1;

  const start = Math.max(0, anchorIdx - (aiSuggestTurnLimit() - 1));
  const slice = turns.slice(start, anchorIdx + 1);
  if (slice.length === 0) return [{ role: "user", content: anchor }];

  const out = [...slice];
  const last = out[out.length - 1];
  if (last.role === "user") {
    out[out.length - 1] = { role: "user", content: anchor };
  } else {
    out.push({ role: "user", content: anchor });
  }
  return out;
}

function isCustomerPlaceholderContent(content: string): boolean {
  const t = content.trim();
  if (!t) return true;
  return /^(customer|you) sent a (voice message|voice note|media message|image|video|sticker|document|audio file|location)/i.test(
    t,
  );
}

function mediaPlaceholder(m: Message): string {
  const side = m.fromMe ? "You" : "Customer";
  if (isWaVoice(m)) {
    return `${side} sent a voice message.`;
  }
  switch (m.type) {
    case MessageTypes.IMAGE:
    case MessageTypes.ALBUM:
      return `${side} sent an image.`;
    case MessageTypes.VIDEO:
      return `${side} sent a video.`;
    case MessageTypes.STICKER:
      return `${side} sent a sticker.`;
    case MessageTypes.DOCUMENT:
      return `${side} sent a document.`;
    case MessageTypes.AUDIO:
      return `${side} sent an audio file.`;
    case MessageTypes.LOCATION:
      return `${side} sent a location.`;
    default:
      return `${side} sent a media message.`;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** WhatsApp sometimes serves media only after REUPLOADING / short delay — retry download before STT (patient; late reply is OK). */
const VOICE_MEDIA_RETRY_MS = [0, 1600, 3200, 5000, 7500, 11_000, 15_000] as const;

/** Extra retries for manual Suggest / sync (user is waiting — worth the wait). */
const VOICE_MEDIA_RETRY_SUGGEST_MS = [0, 1600, 3200, 5000, 7500, 11_000, 15_000, 20_000, 28_000, 38_000] as const;

/** One extra pause + full retry pass if STT empty (avoids triple full scan). */
const VOICE_STT_ROUND2_PAUSE_MS = 3800;
const VOICE_STT_ROUND3_PAUSE_MS = 6500;

async function tryDownloadVoiceMediaFromMessage(
  msg: Message,
  opts?: { extended?: boolean },
): Promise<{ buf: Buffer; meta: VoiceSttMeta } | null> {
  const schedule = opts?.extended ? VOICE_MEDIA_RETRY_SUGGEST_MS : VOICE_MEDIA_RETRY_MS;
  for (const waitMs of schedule) {
    if (waitMs > 0) await sleep(waitMs);
    try {
      let m = msg;
      if (!m.hasMedia) {
        try {
          const r = await m.reload();
          if (r) m = r;
        } catch {
          /* ignore */
        }
      }
      if (!m.hasMedia) continue;
      const media = await m.downloadMedia();
      if (!media?.data) continue;
      const buf = Buffer.from(media.data, "base64");
      if (buf.length === 0) continue;
      if (deskDevLoggingEnabled()) {
        console.log(
          `[desk] voice download ok wait=${waitMs}ms bytes=${buf.length} mime=${media.mimetype ?? "?"} extended=${Boolean(opts?.extended)}`,
        );
      }
      return {
        buf,
        meta: { mimetype: media.mimetype, filename: media.filename ?? undefined },
      };
    } catch {
      /* next attempt */
    }
  }
  return null;
}

/** Download + STT; optional second pass after a pause so media/STT can settle. */
async function inboundVoiceTranscriptWithPatience(msg: Message): Promise<{
  text?: string;
  stt: VoiceSttInboundResult;
}> {
  const runOnce = async (): Promise<{ text?: string; stt: VoiceSttInboundResult }> => {
    const dl = await tryDownloadVoiceMediaFromMessage(msg);
    if (!dl) return { stt: "fail" };
    const r = await transcribeInboundVoiceBuf(dl.buf, dl.meta);
    if (r.text?.trim()) return { text: r.text.trim(), stt: "ok" };
    if (r.stt === "cap-bytes" || r.stt === "cap-time") return { stt: r.stt };
    return { stt: r.stt };
  };

  const first = await runOnce();
  if (first.text?.trim()) return first;
  if (first.stt === "cap-bytes" || first.stt === "cap-time") return first;

  await sleep(VOICE_STT_ROUND2_PAUSE_MS);
  const second = await runOnce();
  if (second.text?.trim()) return second;
  return { stt: second.stt === "fail" && first.stt !== "fail" ? first.stt : second.stt };
}

/** Suggest / sync: normal patience + extended download + reload + third STT pass. */
async function inboundVoiceTranscriptWithExtraPatience(msg: Message): Promise<{
  text?: string;
  stt: VoiceSttInboundResult;
  error?: string;
}> {
  const first = await inboundVoiceTranscriptWithPatience(msg);
  if (hasTranscriptText(first.text)) return first;

  await sleep(VOICE_STT_ROUND3_PAUSE_MS);
  let m = msg;
  try {
    const reloaded = await m.reload();
    if (reloaded) m = reloaded;
  } catch {
    /* ignore */
  }

  const dl = await tryDownloadVoiceMediaFromMessage(m, { extended: true });
  if (!dl) {
    return { stt: "fail", error: "Voice audio not available from WhatsApp yet — try ↻ sync and wait a few seconds." };
  }
  const r = await transcribeInboundVoiceBuf(dl.buf, dl.meta);
  if (r.text?.trim() && hasTranscriptText(r.text)) {
    return { text: r.text.trim(), stt: "ok" };
  }
  return {
    stt: r.stt === "fail" ? first.stt : r.stt,
    error: r.error,
  };
}

function hasTranscriptText(t: string | undefined): boolean {
  return isUsefulVoiceTranscript(t);
}

function sttFailureUserMessage(stt: VoiceSttInboundResult, detail?: string): string {
  if (stt === "cap-bytes") {
    return "Voice note is too large to transcribe. Ask the customer to send a shorter voice note or type the message.";
  }
  if (stt === "cap-time") {
    return "Voice note is too long to transcribe with current limits.";
  }
  const base =
    "Could not transcribe this voice note. Check OpenRouter API key under Setup → API keys, tap ↻ sync, wait ~10s, then try Suggest reply again.";
  if (detail?.trim()) return `${base} (${detail.trim()})`;
  return base;
}

function roughSentences(t: string): string[] {
  const s = t.replace(/\r\n/g, "\n").trim();
  if (!s) return [];
  return s
    .split(/\n+/)
    .flatMap((para) => para.split(/(?<=[.!?…])\s+/))
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * True when STT text is plausibly real speech (not silence / noise tokens).
 * If we treat garbage as "has transcript", the model skips `voiceSttMissing` and often apologizes for voice.
 */
function isUsefulVoiceTranscript(t: string | undefined): boolean {
  const s = (t ?? "").trim();
  if (s.length < 2) return false;
  const low = s.toLowerCase();
  if (/^(thanks?|thank you|ok\.?|okay\.?|\.{1,4}|[\u201c\u201d"']+)$/i.test(low)) return false;
  if (/\b(inaudible|unclear|silence|no speech|\[music\]|\[noise\]|\[laughter\])\b/i.test(low)) return false;
  /** Letters across Latin + Arabic scripts (Urdu/Arabic) + Devanagari */
  const letters = s.replace(/[^\p{L}\p{N}]/gu, "");
  return letters.length >= 2;
}

/** Strong apology / capability-deny patterns — scrub even when transcript exists (model sometimes piles on). */
function sentenceHasVoiceApologyStrong(s: string): boolean {
  const l = s.toLowerCase();
  const hits = [
    "can't read",
    "cannot read",
    "can't listen",
    "cannot listen",
    "can't hear",
    "cannot hear",
    "unable to read",
    "unable to listen",
    "unable to hear",
    "unable to access",
    "can't access",
    "cannot access",
    "please type",
    "could you type",
    "type what",
    "send as text",
    "text instead",
    "read your voice",
    "listen to your",
    "listen to the",
    "hear your",
    "read ni",
    "read nahi",
    "parh ni",
    "parh nahi",
    "nahi parh",
    "nahin parh",
    "sun ni",
    "sun nai",
    "nahi sun",
    "nahin sun",
    "nahi sun sak",
    "sun sakta",
    "sun sakti",
    "read ni kar",
    "read nahi kar",
    "parh ni sak",
    "samajh nahi a",
    "samajh nai a",
    "voice note",
    "voice message",
  ];
  for (const h of hits) if (l.includes(h)) return true;
  if (/\b(voices?|audio)\b/.test(l) && /\b(listen|hear|read|access|play|download|transcri)\b/.test(l)) return true;
  return false;
}

/** Extra patterns when STT failed or was useless — aggressive strip. */
function sentenceHasVoiceApologyAggressive(s: string): boolean {
  if (sentenceHasVoiceApologyStrong(s)) return true;
  const l = s.toLowerCase();
  const hits = [
    "unable to read",
    "unable to transcribe",
    "type out",
    "write it down",
    "text message",
    "audio message",
    "didn't download",
    "did not download",
    "couldn't download",
    "could not download",
    "transcription",
    "transcribe",
    "i'm not able to listen",
    "not able to listen",
    "type karo",
    "text karo",
    "likh do",
    "likh de",
    "awaz sun",
    "voice abhi",
    "download nahi",
    "dubara bhej",
    "clear download",
    "resend",
    "send again",
    "mai ne nahi",
    "main ne nahi",
    "nahi dekh",
    "nahi dekh sak",
    "decode",
    "process your audio",
    "process the audio",
  ];
  for (const h of hits) if (l.includes(h)) return true;
  return false;
}

/** Drop lines that sound like “can’t hear / type instead / download failed” — never send those to the customer. */
function scrubVoiceMetaFromReply(text: string, voiceInbound: boolean, hadUsefulTranscript: boolean): string {
  if (!voiceInbound) return text.trim();
  const t = text.trim();
  if (!t) return hadUsefulTranscript ? t : fallbackVoiceNoTranscriptReply();

  const pickBad = (s: string) =>
    hadUsefulTranscript ? sentenceHasVoiceApologyStrong(s) : sentenceHasVoiceApologyAggressive(s);

  const kept = roughSentences(t).filter((s) => !pickBad(s));
  let joined = kept.join(" ").trim();

  const wholeBad = (s: string) =>
    hadUsefulTranscript ? sentenceHasVoiceApologyStrong(s) : sentenceHasVoiceApologyAggressive(s);

    if (joined.length < 3 || wholeBad(joined)) {
      return hadUsefulTranscript
        ? joined.length >= 3
          ? joined
          : t.trim()
        : fallbackVoiceNoTranscriptReply();
    }
  return joined;
}

function fallbackVoiceNoTranscriptReply(): string {
  return "Theek — agar last point repeat kar dein to next step bata deta hoon.";
}

async function resolveChatDisplayTitle(chat: Chat, contactMap?: Map<string, string>): Promise<string> {
  const chatId = chat.id._serialized;
  if (chat.isGroup) {
    const name = chat.name?.trim();
    if (name) return name;
    return formatWaChatId(chatId);
  }
  const mapped = contactMap?.get(chatId);
  if (mapped) return mapped;
  try {
    const contact = await chat.getContact();
    const saved = contact.name?.trim();
    if (saved) return saved;
    const push = contact.pushname?.trim();
    if (push) return push;
    const short = contact.shortName?.trim();
    if (short) return short;
    const fromMap = contactMap?.get(contact.id._serialized);
    if (fromMap) return fromMap;
  } catch {
    /* contact lookup can fail for some chats */
  }
  const chatName = chat.name?.trim();
  if (chatName) return chatName;
  return formatWaChatId(chatId);
}

async function buildContactNameMap(client: Client): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const contacts = await client.getContacts();
    for (const c of contacts) {
      const display =
        c.name?.trim() ||
        c.shortName?.trim() ||
        c.pushname?.trim() ||
        "";
      if (!display) continue;
      const serial = c.id._serialized;
      if (serial) map.set(serial, display);
      const num = (c.number ?? "").replace(/\D/g, "");
      if (num) {
        map.set(`${num}@c.us`, display);
        map.set(`${num}@lid`, display);
      }
    }
  } catch {
    /* address book may be unavailable briefly after connect */
  }
  return map;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s — try again or wipe local session.`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export class WhatsAppManager {
  private readonly sessions = new Map<string, ClientBundle>();
  /** Per `accountId:chatId` — draft mode waits for a burst of inbound messages to settle. */
  private readonly draftDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  /** Priority background STT for inbound voice notes (bounded parallelism). */
  private readonly voiceInboundPending: Array<{
    accountId: string;
    messageId: string;
    chatId: string;
    run: () => Promise<void>;
  }> = [];
  private readonly voiceInboundActiveJobs: Array<{
    accountId: string;
    messageId: string;
    chatId: string;
  }> = [];
  private voiceInboundActive = 0;
  private readonly voiceInboundMaxParallel = 3;

  /** Session map keys are trimmed at connect; normalize all lookups the same way. */
  private normalizeAccountId(accountId: string): string {
    const t = accountId.trim();
    return t || "default";
  }

  isReady(accountId: string): boolean {
    const s = this.sessions.get(this.normalizeAccountId(accountId));
    return !!s?.client.info;
  }

  setReplyMode(accountId: string, mode: ReplyMode, arm = false) {
    const id = this.normalizeAccountId(accountId);
    const s = this.sessions.get(id);
    if (!s) return;
    s.replyMode = mode;
    if (arm) {
      s.automationArmed = true;
      if (!s.sessionReadyAt) s.sessionReadyAt = Date.now();
    }
    if (mode === "paused") {
      this.clearDraftTimersForAccount(id);
    }
  }

  async getChatReplyRoutes(accountId: string): Promise<Record<string, ChatReplyRoute>> {
    return chatReplyRoutes.getAllChatReplyRoutesForAccount(this.normalizeAccountId(accountId));
  }

  async saveChatReplyRoute(accountId: string, chatId: string, route: ChatReplyRoute): Promise<void> {
    await chatReplyRoutes.setChatReplyRoute(this.normalizeAccountId(accountId), chatId, route);
  }

  /** Clears linked WhatsApp Web compose for this chat (e.g. when switching away in the app). */
  async clearLinkedComposeDraft(accountId: string, chatId: string): Promise<{ ok: boolean }> {
    const id = this.normalizeAccountId(accountId);
    const s = this.sessions.get(id);
    const page = s?.client.pupPage;
    if (!page) return { ok: false };
    await syncLinkedComposeDraft(page, chatId.trim(), "", { allowEmptyBody: true });
    return { ok: true };
  }

  private async teardownSession(accountId: string): Promise<void> {
    const id = this.normalizeAccountId(accountId);
    const s = this.sessions.get(id);
    if (!s) return;
    this.clearDraftTimersForAccount(id);
    try {
      await s.client.destroy();
    } catch {
      /* ignore */
    }
    this.sessions.delete(id);
  }

  async start(req: WaStartRequest): Promise<{ ok: boolean; error?: string }> {
    const accountId = this.normalizeAccountId(req.accountId);
    if (!accountId) {
      return { ok: false, error: "accountId required" };
    }

    const existing = this.sessions.get(accountId);
    if (existing) {
      if (existing.client.info) {
        return { ok: true };
      }
      await this.teardownSession(accountId);
    }

    const dataPath = path.join(userDataDir(), "wwebjs", accountId);

    const digits =
      req.mode === "phone" ? (req.phoneDigits ?? "").replace(/\D/g, "") : "";
    if (req.mode === "phone" && digits.length < 8) {
      return {
        ok: false,
        error: "Phone pairing needs full international number (digits only, no +), e.g. 923001234567.",
      };
    }

    const chromeExecutable = resolveChromeExecutablePath();
    if (!chromeExecutable) {
      return { ok: false, error: chromeNotFoundMessage() };
    }

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: accountId, dataPath }),
      puppeteer: {
        headless: true,
        executablePath: chromeExecutable,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-software-rasterizer",
        ],
      },
      ...(req.mode === "phone" && digits
        ? {
            pairWithPhoneNumber: {
              phoneNumber: digits,
              showNotification: true,
              intervalMs: 180000,
            },
          }
        : {}),
    });

    const bundle: ClientBundle = {
      client,
      replyMode: "paused",
      automationArmed: false,
      sessionReadyAt: 0,
    };
    this.sessions.set(accountId, bundle);

    const emitStatus = (state: WaStatusPayload["state"], detail?: string) => {
      broadcast("wa:status", { accountId, state, detail } satisfies WaStatusPayload);
    };

    client.on("qr", (qr) => {
      qrcode.generate(qr, { small: true });
      emitStatus("qr");
      broadcast("wa:qr", { accountId, qr } satisfies WaQrPayload);
    });

    client.on("code", (code: string) => {
      emitStatus("pairing");
      broadcast("wa:pairing-code", { accountId, code } satisfies WaPairingCodePayload);
    });

    client.on("authenticated", () => emitStatus("authenticated"));
    client.on("auth_failure", (m) => emitStatus("error", String(m)));
    client.on("disconnected", (r) => emitStatus("disconnected", String(r)));

    client.on("ready", () => {
      const b = this.sessions.get(accountId);
      if (b) {
        b.sessionReadyAt = Date.now();
        b.replyMode = "paused";
        b.automationArmed = false;
        this.clearDraftTimersForAccount(accountId);
      }
      emitStatus("ready");
      void this.syncChatList(accountId);
    });

    client.on("message", async (msg: Message) => {
      if (!msg.fromMe) await this.handleInbound(accountId, msg);
    });

    client.on("message_create", async (msg: Message) => {
      if (msg.fromMe) await this.broadcastSentMessage(accountId, msg);
    });

    try {
      emitStatus("initializing");
      const initTimeoutMs = parseEnvClampIntLoHi("WWEBJS_INIT_TIMEOUT_MS", 30_000, 300_000) ?? 120_000;
      await withTimeout(client.initialize(), initTimeoutMs, "WhatsApp connect");
      return { ok: true };
    } catch (e) {
      await this.teardownSession(accountId);
      emitStatus("error", e instanceof Error ? e.message : String(e));
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async syncChatList(accountId: string): Promise<{ ok: boolean; error?: string; count?: number }> {
    const id = this.normalizeAccountId(accountId);
    const bundle = this.sessions.get(id);
    if (!bundle?.client) {
      return { ok: false, error: "No session for this account." };
    }
    if (!bundle.client.info) {
      await sleep(800);
    }
    if (!bundle.client.info) {
      return { ok: false, error: "Client not ready yet — try Refresh in a moment." };
    }
    const MAX = 500;
    try {
      const chats = await bundle.client.getChats();
      const contactMap = await buildContactNameMap(bundle.client);
      const sorted = [...chats].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
      const slice = sorted.slice(0, MAX);
      const titles = await mapWithConcurrency(slice, 8, (chat) => resolveChatDisplayTitle(chat, contactMap));
      const rows: WaChatRow[] = slice.map((chat, idx) => {
        const chatId = chat.id._serialized;
        const lm = chat.lastMessage;
        let preview = "…";
        let lastAt = (chat.timestamp ?? 0) * 1000;
        if (lm) {
          const body = lm.body?.trim() ?? "";
          preview = body || (lm.hasMedia ? "Media" : "…");
          lastAt = (lm.timestamp ?? chat.timestamp ?? 0) * 1000;
        }
        return {
          chatId,
          title: titles[idx] ?? formatWaChatId(chatId),
          preview,
          lastAt,
          unread: typeof chat.unreadCount === "number" ? chat.unreadCount : 0,
          isGroup: chat.isGroup,
        };
      });
      broadcast("wa:chats-sync", {
        accountId: id,
        chats: rows,
        totalFetched: chats.length,
      } satisfies WaChatsSyncPayload);
      return { ok: true, count: rows.length };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async logout(accountId: string): Promise<void> {
    const id = this.normalizeAccountId(accountId);
    const s = this.sessions.get(id);
    if (!s) return;
    this.clearDraftTimersForAccount(id);
    try {
      await s.client.logout();
    } catch {
      /* ignore */
    }
    try {
      await s.client.destroy();
    } catch {
      /* ignore */
    }
    this.sessions.delete(id);
    await chatMemory.clearAccount(id);
    broadcast("wa:status", { accountId: id, state: "disconnected" } satisfies WaStatusPayload);
  }

  async sendText(accountId: string, chatId: string, body: string): Promise<{ ok: boolean; error?: string }> {
    const id = this.normalizeAccountId(accountId);
    const s = this.sessions.get(id);
    if (!s?.client.info) return { ok: false, error: "WhatsApp not connected." };
    const cid = chatId.trim();
    if (!cid) return { ok: false, error: "No chat selected." };
    try {
      const chat = await s.client.getChatById(cid);
      const sent = await chat.sendMessage(body.trim());
      await this.broadcastSentMessage(accountId, sent, body.trim());
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async sendMediaBase64(
    accountId: string,
    chatId: string,
    base64: string,
    mimeType: string,
    opts: { asSticker?: boolean; caption?: string; sendAsVoice?: boolean },
  ): Promise<{ ok: boolean; error?: string }> {
    const id = this.normalizeAccountId(accountId);
    const s = this.sessions.get(id);
    if (!s?.client.info) return { ok: false, error: "WhatsApp not connected." };
    const cid = chatId.trim();
    if (!cid) return { ok: false, error: "No chat selected." };
    const raw = base64.replace(/\s/g, "");
    if (!raw) return { ok: false, error: "Empty media." };
    const mime = (mimeType || "image/png").trim() || "image/png";
    try {
      const chat = await s.client.getChatById(cid);
      if (opts.sendAsVoice) {
        const ext =
          mime.includes("webm") || mime.includes("opus")
            ? "voice.webm"
            : mime.includes("ogg")
              ? "voice.ogg"
              : mime.includes("mpeg") || mime.includes("mp3")
                ? "voice.mp3"
                : "voice.bin";
        const media = new MessageMedia(mime, raw, ext);
        await chat.sendMessage(media, { sendAudioAsVoice: true });
        return { ok: true };
      }
      const media = new MessageMedia(mime, raw, opts.asSticker ? "sticker.png" : "grok-image.png");
      if (opts.asSticker) {
        await chat.sendMessage(media, {
          sendMediaAsSticker: true,
          stickerName: "Grok",
          stickerAuthor: "AI Desk",
        });
      } else {
        await chat.sendMessage(media, {
          caption: opts.caption?.trim() || undefined,
        });
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private async broadcastSentMessage(
    accountId: string,
    sent: Message,
    bodyOverride?: string,
  ): Promise<void> {
    try {
      const chat = await sent.getChat();
      const body = (bodyOverride ?? sent.body ?? "").trim();
      broadcast("wa:message", {
        accountId,
        id: sent.id.id,
        chatId: chat.id._serialized,
        from: "me",
        body,
        timestamp: sent.timestamp * 1000,
        isFromMe: true,
        hasMedia: sent.hasMedia,
        type: String(sent.type),
      } satisfies WaInboundPayload);
      await this.recordOutboundToMemory(
        accountId,
        chat.id._serialized,
        sent.id.id,
        body,
        sent.timestamp * 1000,
      );
    } catch {
      /* UI sync is best-effort */
    }
  }

  private async handleInbound(accountId: string, msg: Message) {
    if (msg.fromMe) return;

    const chat = await msg.getChat();
    const contact = await msg.getContact();

    const bundle = this.sessions.get(this.normalizeAccountId(accountId));
    if (!bundle) return;

    const accountNorm = this.normalizeAccountId(accountId);
    const voiceInbound = isWaVoice(msg);

    broadcast("wa:message", this.buildInboundShell(accountId, msg, chat, contact));
    void this.recordInboundToMemory(accountId, chat.id._serialized, msg);

    if (voiceInbound) {
      this.enqueueVoiceInbound(
        { accountId, messageId: msg.id.id, chatId: chat.id._serialized },
        () => this.processVoiceInbound(accountNorm, accountId, msg, chat, contact, bundle),
      );
      return;
    }

    if (!bundle.automationArmed) return;

    const kind = await this.resolveInboundReplyKind(accountNorm, chat.id._serialized, bundle);
    if (kind === "paused") return;

    await this.processTextInboundAutomation(accountNorm, accountId, msg, chat, contact, bundle, kind);
  }

  private buildInboundShell(
    accountId: string,
    msg: Message,
    chat: Chat,
    contact: Awaited<ReturnType<Message["getContact"]>>,
  ): WaInboundPayload {
    return {
      accountId,
      id: msg.id.id,
      chatId: chat.id._serialized,
      from: contact.number ?? msg.from,
      body: msg.body ?? "",
      timestamp: msg.timestamp * 1000,
      isFromMe: msg.fromMe,
      hasMedia: msg.hasMedia,
      type: String(msg.type),
    };
  }

  private broadcastMessageUpdate(payload: WaMessageUpdatePayload): void {
    broadcast("wa:message-update", payload);
  }

  private broadcastVoiceQueue(accountId: string): void {
    const id = this.normalizeAccountId(accountId);
    const items: WaVoiceQueuePayload["items"] = [
      ...this.voiceInboundActiveJobs
        .filter((j) => this.normalizeAccountId(j.accountId) === id)
        .map((j) => ({ messageId: j.messageId, chatId: j.chatId, status: "active" as const })),
      ...this.voiceInboundPending
        .filter((j) => this.normalizeAccountId(j.accountId) === id)
        .map((j) => ({ messageId: j.messageId, chatId: j.chatId, status: "queued" as const })),
    ];
    broadcast("wa:voice-queue", {
      accountId: id,
      pending: items.filter((i) => i.status === "queued").length,
      active: items.filter((i) => i.status === "active").length,
      items,
    } satisfies WaVoiceQueuePayload);
  }

  private enqueueVoiceInbound(
    meta: { accountId: string; messageId: string; chatId: string },
    task: () => Promise<void>,
  ): void {
    this.voiceInboundPending.push({ ...meta, run: task });
    this.broadcastVoiceQueue(meta.accountId);
    void this.drainVoiceInboundQueue();
  }

  private drainVoiceInboundQueue(): void {
    while (this.voiceInboundActive < this.voiceInboundMaxParallel && this.voiceInboundPending.length > 0) {
      const job = this.voiceInboundPending.shift();
      if (!job) break;
      this.voiceInboundActive++;
      this.voiceInboundActiveJobs.push({
        accountId: job.accountId,
        messageId: job.messageId,
        chatId: job.chatId,
      });
      this.broadcastVoiceQueue(job.accountId);
      void job
        .run()
        .finally(() => {
          this.voiceInboundActive--;
          const idx = this.voiceInboundActiveJobs.findIndex(
            (j) => j.messageId === job.messageId && j.chatId === job.chatId,
          );
          if (idx >= 0) this.voiceInboundActiveJobs.splice(idx, 1);
          this.broadcastVoiceQueue(job.accountId);
          this.drainVoiceInboundQueue();
        });
    }
  }

  private async transcribeInboundVoiceMessage(
    accountId: string,
    accountNorm: string,
    chatId: string,
    msg: Message,
  ): Promise<{
    transcript?: string;
    voiceDurationSec?: number;
    stt: VoiceSttInboundResult;
    error?: string;
  }> {
    const vr = await this.resolveVoiceTranscriptForMessage(accountNorm, chatId, msg.id.id, msg);
    let voiceDurationSec: number | undefined;
    const dl = await tryDownloadVoiceMediaFromMessage(msg);
    if (dl) voiceDurationSec = Math.max(1, Math.round(voiceBufferRoughSeconds(dl.buf)));

    const transcript = vr.text?.trim();
    if (transcript || voiceDurationSec) {
      this.broadcastMessageUpdate({
        accountId,
        id: msg.id.id,
        chatId,
        transcript,
        voiceDurationSec,
      });
      if (transcript) {
        await chatMemory.updateTurnByMessageId(accountNorm, chatId, msg.id.id, {
          content: transcript,
          source: "voice-transcript",
        });
      }
    }

    if (deskDevLoggingEnabled()) {
      console.log(
        `[desk] inbound-voice-stt chat=…${chatIdSuffixForLog(chatId)} id=…${msg.id.id.slice(-8)} stt=${vr.stt} bytes=${dl?.buf.length ?? 0} text=${(transcript ?? "").slice(0, 96)}`,
      );
    }

    return { transcript, voiceDurationSec, stt: vr.stt, error: vr.error };
  }

  private async processVoiceInbound(
    accountNorm: string,
    accountId: string,
    msg: Message,
    chat: Chat,
    _contact: Awaited<ReturnType<Message["getContact"]>>,
    bundle: ClientBundle,
  ): Promise<void> {
    const chatId = chat.id._serialized;
    const chatSurface = chat.isGroup ? "group" : "direct";

    const kind = bundle.automationArmed
      ? await this.resolveInboundReplyKind(accountNorm, chatId, bundle)
      : ("paused" as const);

    const sttResult = await this.transcribeInboundVoiceMessage(accountId, accountNorm, chatId, msg);
    let transcript = sttResult.transcript;
    let sttInbound: VoiceSttInboundResult = sttResult.stt;
    let prefetchedRemoteReply: string | undefined;
    let prefetchedRemoteProvider: "xai" | "groq" | "openai" | "voice-ai" | undefined;

    const remoteBase = getRemoteVoiceAiBaseUrl();
    if (kind === "auto" && remoteBase && !transcript) {
      const dl = await tryDownloadVoiceMediaFromMessage(msg, { extended: true });
      if (dl) {
        try {
          const trainingDoc = await loadTraining();
          const training = bundleToPromptText(trainingDoc);
          const ctx = await this.buildChatReplyContext(accountNorm, chatId, {
            lastInbound: msg,
            lastVoiceTranscript: undefined,
          });
          const ctxStr = buildRemoteVoiceContext(training, ctx.turns, chatSurface);
          const orig =
            dl.meta.filename?.trim() ||
            messageFilename(msg) ||
            `voice-${msg.id.id}.ogg`;
          const remote = await postRemoteVoiceAiUpload(remoteBase, {
            buffer: dl.buf,
            originalName: orig,
            mimetype: dl.meta.mimetype || "audio/ogg",
            context: ctxStr,
          });
          transcript = remote.transcription?.trim() || transcript;
          prefetchedRemoteReply = remote.reply?.trim() || undefined;
          prefetchedRemoteProvider = mapRemoteProviderForUi(remote.chatProvider, remote.sttProvider);
          if (transcript) {
            sttInbound = "ok";
            this.broadcastMessageUpdate({
              accountId,
              id: msg.id.id,
              chatId,
              transcript,
              voiceDurationSec: sttResult.voiceDurationSec,
            });
            await chatMemory.updateTurnByMessageId(accountNorm, chatId, msg.id.id, {
              content: transcript,
              source: "voice-transcript",
            });
          }
        } catch (e) {
          if (deskDevLoggingEnabled()) {
            console.error("[desk] remote voice-ai (auto) failed:", e);
          }
        }
      }
    }

    if (!bundle.automationArmed || kind === "paused") return;

    const trainingDoc = await loadTraining();
    const training = bundleToPromptText(trainingDoc);
    const ctx = await this.buildChatReplyContext(accountNorm, chatId, {
      lastInbound: msg,
      lastVoiceTranscript: transcript,
    });

    if (kind === "draft") {
      this.scheduleDraftReplyFlush(accountNorm, chatId);
      return;
    }

    const devLog = deskDevLoggingEnabled();
    const pipelineT0 = devLog ? Date.now() : 0;
    const hadTranscript = hasVoiceTranscriptText(transcript);
    let replyText: string;
    let replyProviderLabel: string;

    if (prefetchedRemoteReply?.trim()) {
      replyText = scrubVoiceMetaFromReply(prefetchedRemoteReply, true, hadTranscript);
      replyProviderLabel = prefetchedRemoteProvider ?? "voice-ai";
    } else {
      const reply = await generateReply({
        accountId: accountNorm,
        chatId,
        tone: "friendly",
        messages: ctx.turns,
        training,
        chatSurface,
        voiceSttMissing: !hadTranscript,
        lastCustomerText: ctx.lastCustomerText,
      });
      replyText = scrubVoiceMetaFromReply(reply.text, true, hadTranscript);
      replyProviderLabel = reply.provider;
    }

    const delayMs = typingDelayPrimaryMs(replyText.length);
    await sleep(delayMs);
    await chat.sendStateTyping();
    await sleep(typingDelayPostStateMs(replyText));
    const sent = await msg.reply(replyText);
    await this.broadcastSentMessage(accountId, sent, replyText);

    if (devLog && pipelineT0) {
      const totalMs = Date.now() - pipelineT0;
      const stt =
        sttInbound === "ok"
          ? "ok"
          : sttInbound === "cap-bytes" || sttInbound === "cap-time"
            ? "skip-cap"
            : "fail";
      console.log(
        `[desk] auto-reply chat=…${chatIdSuffixForLog(chatId)} latency=${latencyBucketMs(totalMs)} totalMs=${totalMs} stt=${stt} provider=${replyProviderLabel}`,
      );
    }
  }

  private async processTextInboundAutomation(
    accountNorm: string,
    accountId: string,
    msg: Message,
    chat: Chat,
    _contact: Awaited<ReturnType<Message["getContact"]>>,
    _bundle: ClientBundle,
    kind: "draft" | "auto",
  ): Promise<void> {
    const chatId = chat.id._serialized;
    const chatSurface = chat.isGroup ? "group" : "direct";
    const trainingDoc = await loadTraining();
    const training = bundleToPromptText(trainingDoc);
    const ctx = await this.buildChatReplyContext(accountNorm, chatId, {
      lastInbound: msg,
      lastVoiceTranscript: undefined,
    });

    if (kind === "draft") {
      this.scheduleDraftReplyFlush(accountNorm, chatId);
      return;
    }

    const devLog = deskDevLoggingEnabled();
    const pipelineT0 = devLog ? Date.now() : 0;

    const reply = await generateReply({
      accountId: accountNorm,
      chatId,
      tone: "friendly",
      messages: ctx.turns,
      training,
      chatSurface,
      voiceSttMissing: false,
      lastCustomerText: ctx.lastCustomerText,
    });
    const replyText = scrubVoiceMetaFromReply(reply.text, false, true);

    const delayMs = typingDelayPrimaryMs(replyText.length);
    await sleep(delayMs);
    await chat.sendStateTyping();
    await sleep(typingDelayPostStateMs(replyText));
    const sent = await msg.reply(replyText);
    await this.broadcastSentMessage(accountId, sent, replyText);

    if (devLog && pipelineT0) {
      const totalMs = Date.now() - pipelineT0;
      console.log(
        `[desk] auto-reply chat=…${chatIdSuffixForLog(chatId)} latency=${latencyBucketMs(totalMs)} totalMs=${totalMs} stt=na provider=${reply.provider}`,
      );
    }
  }

  private async resolveInboundReplyKind(
    accountNorm: string,
    chatId: string,
    bundle: ClientBundle,
  ): Promise<"paused" | "draft" | "auto"> {
    const m = bundle.replyMode;
    if (m === "paused") return "paused";
    if (m === "auto") return "auto";
    if (m === "draft") return "draft";
    const r = await chatReplyRoutes.getChatReplyRoute(accountNorm, chatId);
    if (!r || r === "off") return "paused";
    if (r === "draft") return "draft";
    return "auto";
  }

  private clearDraftTimersForAccount(accountNorm: string): void {
    const prefix = `${accountNorm}:`;
    for (const [k, t] of [...this.draftDebounceTimers]) {
      if (k.startsWith(prefix)) {
        clearTimeout(t);
        this.draftDebounceTimers.delete(k);
      }
    }
  }

  private scheduleDraftReplyFlush(accountNorm: string, chatId: string): void {
    const dk = `${accountNorm}:${chatId}`;
    const prev = this.draftDebounceTimers.get(dk);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      this.draftDebounceTimers.delete(dk);
      void this.flushDraftReplyForChat(dk);
    }, draftDebounceMs());
    this.draftDebounceTimers.set(dk, t);
  }

  private async flushDraftReplyForChat(dk: string): Promise<void> {
    const colon = dk.indexOf(":");
    if (colon < 0) return;
    const accountNorm = dk.slice(0, colon);
    const chatId = dk.slice(colon + 1);
    const bundle = this.sessions.get(accountNorm);
    if (!bundle) return;
    if ((await this.resolveInboundReplyKind(accountNorm, chatId, bundle)) !== "draft") return;
    const client = bundle.client;
    if (!client.info) return;

    let chat: Awaited<ReturnType<Client["getChatById"]>>;
    try {
      chat = await client.getChatById(chatId);
    } catch {
      return;
    }

    let target: Message | undefined;
    try {
      const history = await chat.fetchMessages({ limit: aiReplyTurnLimit() * 2 });
      const sorted = history.sort((a, b) => a.timestamp - b.timestamp);
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (!sorted[i].fromMe) {
          target = sorted[i];
          break;
        }
      }
    } catch {
      return;
    }
    if (!target) return;

    let transcript: string | undefined;
    if (isWaVoice(target)) {
      const vr = await inboundVoiceTranscriptWithPatience(target);
      transcript = vr.text;
    }

    const trainingDoc = await loadTraining();
    const training = bundleToPromptText(trainingDoc);
    const ctx = await this.buildChatReplyContext(accountNorm, chatId, {
      lastInbound: target,
      lastVoiceTranscript: transcript,
    });
    const chatSurface = chat.isGroup ? "group" : "direct";
    const voice = isWaVoice(target);
    const hadTranscript = hasVoiceTranscriptText(transcript);

    const remoteBase = getRemoteVoiceAiBaseUrl();
    if (remoteBase && voice) {
      const dl = await tryDownloadVoiceMediaFromMessage(target);
      if (dl) {
        try {
          const ctxStr = buildRemoteVoiceContext(training, ctx.turns, chatSurface);
          const orig =
            dl.meta.filename?.trim() ||
            messageFilename(target) ||
            `voice-${target.id.id}.ogg`;
          const remote = await postRemoteVoiceAiUpload(remoteBase, {
            buffer: dl.buf,
            originalName: orig,
            mimetype: dl.meta.mimetype || "audio/ogg",
            context: ctxStr,
          });
          const mergedUsefulTr = hasVoiceTranscriptText(remote.transcription) || hadTranscript;
          const remoteReply = scrubVoiceMetaFromReply(
            (remote.reply || "").trim(),
            true,
            mergedUsefulTr,
          );
          if (remoteReply.trim()) {
            broadcast(
              "wa:draft-reply",
              {
                accountId: accountNorm,
                chatId,
                inboundMessageId: target.id.id,
                suggestedText: remoteReply,
                provider: mapRemoteProviderForUi(remote.chatProvider, remote.sttProvider),
              } satisfies WaDraftReplyPayload,
            );
            void syncLinkedComposeDraft(client.pupPage, chatId, remoteReply);
            return;
          }
        } catch (e) {
          if (deskDevLoggingEnabled()) {
            console.error("[desk] remote voice-ai (draft) failed, using local model:", e);
          }
        }
      }
    }

    const reply = await generateReply({
      accountId: accountNorm,
      chatId,
      tone: "friendly",
      messages: ctx.turns,
      training,
      chatSurface,
      voiceSttMissing: voice && !hadTranscript,
      lastCustomerText: ctx.lastCustomerText,
    });

    const replyText = scrubVoiceMetaFromReply(reply.text, voice, hadTranscript);

    broadcast(
      "wa:draft-reply",
      {
        accountId: accountNorm,
        chatId,
        inboundMessageId: target.id.id,
        suggestedText: replyText,
        provider: reply.provider,
      } satisfies WaDraftReplyPayload,
    );
    void syncLinkedComposeDraft(client.pupPage, chatId, replyText);
  }

  async fetchRecentThreadForAi(
    accountId: string,
    chatId: string,
    anchorMessageId?: string,
    opts?: { cachedTranscript?: string; anchorTimestampMs?: number },
  ): Promise<WaFetchAiThreadResult> {
    const id = this.normalizeAccountId(accountId);
    const s = this.sessions.get(id);
    if (!s?.client?.info) {
      return { ok: false, error: "WhatsApp not connected." };
    }
    const cid = chatId.trim();
    if (!cid) return { ok: false, error: "chatId required." };
    try {
      const anchor = anchorMessageId?.trim();
      if (anchor) {
        const ctx = await this.buildAnchoredChatReplyContext(id, cid, anchor, accountId, {
          cachedTranscript: opts?.cachedTranscript,
          anchorTimestampMs: opts?.anchorTimestampMs,
        });
        if (ctx.anchorNotFound) {
          return {
            ok: false,
            error: "Message not found in WhatsApp — tap ↻ sync on this chat, then try again.",
          };
        }
        if (ctx.sttError) {
          return { ok: false, sttFailed: true, error: ctx.sttError };
        }
        if (ctx.voiceSttMissing) {
          return {
            ok: false,
            sttFailed: true,
            error: sttFailureUserMessage("fail"),
          };
        }
        if (!ctx.lastCustomerText.trim()) {
          return {
            ok: false,
            error: "No customer text on this message — sync the chat or pick another message.",
          };
        }
        return {
          ok: true,
          messages: ctx.turns,
          lastCustomerText: ctx.lastCustomerText,
          voiceSttMissing: false,
          anchorTranscript: ctx.anchorTranscript,
        };
      }
      const ctx = await this.buildChatReplyContext(id, cid);
      return { ok: true, messages: ctx.turns, lastCustomerText: ctx.lastCustomerText || undefined };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /** How many voice notes we try to transcribe when building AI context (per request). */
  private voiceTranscribeBudget(): number {
    const n = Number(process.env.WWEBJS_VOICE_TRANSCRIBE_FOR_AI_LIMIT);
    if (Number.isFinite(n) && n >= 0 && n <= 20) return Math.floor(n);
    return 8;
  }

  /**
   * Newest inbound-only voice indices — merged into STT so manual "Suggest" is not
   * starved when the thread has many of your own voice notes.
   */
  private recentCustomerVoiceTranscribeCap(): number {
    const n = Number(process.env.WWEBJS_VOICE_TRANSCRIBE_RECENT_CUSTOMER);
    if (Number.isFinite(n) && n >= 1 && n <= 25) return Math.floor(n);
    return 12;
  }

  /**
   * Turn WhatsApp messages into user/assistant lines for the chat model.
   * Text + captions are kept as-is; recent voice notes are transcribed (STT) when possible
   * so the model sees real words, not only "[voice note]".
   */
  private async messagesToAiTurnsWithVoiceTranscripts(
    sorted: Message[],
    opts?: { lastInbound?: Message; lastVoiceTranscript?: string; replyWindowOnly?: boolean },
  ): Promise<{ role: "user" | "assistant"; content: string }[]> {
    const out: { role: "user" | "assistant"; content: string }[] = [];
    const budget = opts?.replyWindowOnly ? voiceSttReplyWindow() : this.voiceTranscribeBudget();
    const voiceIdx: number[] = [];
    sorted.forEach((m, i) => {
      if (isWaVoice(m)) voiceIdx.push(i);
    });
    const pick =
      budget <= 0 ? [] : voiceIdx.length <= budget ? voiceIdx : voiceIdx.slice(-budget);

    const recentCustomerVoice: number[] = [];
    const cap = opts?.replyWindowOnly ? voiceSttReplyWindow() : this.recentCustomerVoiceTranscribeCap();
    for (let i = sorted.length - 1; i >= 0; i--) {
      const m = sorted[i];
      if (m.fromMe) continue;
      if (!isWaVoice(m)) continue;
      recentCustomerVoice.push(i);
      if (recentCustomerVoice.length >= cap) break;
    }

    const transcribeSet = new Set<number>([...pick, ...recentCustomerVoice]);

    const lastInbound = opts?.lastInbound;
    const preTr = opts?.lastVoiceTranscript?.trim();

    const sttByIndex = new Map<number, string>();
    const parallelIdx = [...transcribeSet].filter((i) => {
      const m = sorted[i];
      if (!m || !isWaVoice(m)) return false;
      if (lastInbound && waMsgIdMatch(m, lastInbound) && !!preTr) return false;
      return true;
    });
    await Promise.all(
      parallelIdx.map(async (i) => {
        const m0 = sorted[i];
        try {
          if (!isWaVoice(m0)) return;
          const dl = await tryDownloadVoiceMediaFromMessage(m0);
          if (!dl) return;
          const got = await transcribeVoiceBufForAiThread(dl.buf, dl.meta);
          if (!got.skip && got.text?.trim()) sttByIndex.set(i, got.text.trim());
        } catch {
          /* download / STT failed */
        }
      }),
    );

    for (let i = 0; i < sorted.length; i++) {
      const m = sorted[i];
      let text = m.body?.trim() ?? "";
      const voice = isWaVoice(m);

      if (voice && lastInbound && waMsgIdMatch(m, lastInbound) && preTr) {
        text = text ? `${text}\n\n${preTr}` : preTr;
      } else if (voice && transcribeSet.has(i)) {
        const tr = sttByIndex.get(i)?.trim();
        if (tr) text = text ? `${text}\n\n${tr}` : tr;
        else if (!text) text = mediaPlaceholder(m);
      } else if (!text && m.hasMedia) {
        text = mediaPlaceholder(m);
      } else if (voice && !text) {
        text = mediaPlaceholder(m);
      }

      if (!text) continue;
      out.push({
        role: m.fromMe ? "assistant" : "user",
        content: text,
      });
    }
    return out;
  }

  private ensureVoiceTranscriptInAiTurns(
    messages: { role: "user" | "assistant"; content: string }[],
    transcript?: string,
  ): { role: "user" | "assistant"; content: string }[] {
    const tr = transcript?.trim();
    if (!tr) return messages;
    const out = [...messages];
    for (let i = out.length - 1; i >= 0; i--) {
      if (out[i].role !== "user") continue;
      const c = out[i].content.trim();
      const isPlaceholder =
        /sent a voice message/i.test(c) ||
        /sent a voice note/i.test(c) ||
        !c ||
        c === tr;
      if (isPlaceholder) {
        out[i] = { role: "user", content: tr };
      } else if (!c.includes(tr)) {
        out[i] = { role: "user", content: `${c}\n\n${tr}`.trim() };
      }
      break;
    }
    return out;
  }

  private async recordInboundToMemory(
    accountId: string,
    chatId: string,
    msg: Message,
    transcript?: string,
  ): Promise<void> {
    const acc = this.normalizeAccountId(accountId);
    const voice = isWaVoice(msg);
    const text = transcript?.trim() || msg.body?.trim();
    if (!text && !voice) return;
    const content = text || mediaPlaceholder(msg);
    await chatMemory.appendTurn(acc, chatId, {
      role: "user",
      content,
      messageId: msg.id.id,
      timestamp: msg.timestamp * 1000,
      source: transcript?.trim() ? "voice-transcript" : voice ? "media-placeholder" : "text",
    });
  }

  private async recordOutboundToMemory(
    accountId: string,
    chatId: string,
    messageId: string,
    body: string,
    timestampMs: number,
  ): Promise<void> {
    const text = body.trim();
    if (!text) return;
    await chatMemory.appendTurn(this.normalizeAccountId(accountId), chatId, {
      role: "assistant",
      content: text,
      messageId,
      timestamp: timestampMs,
      source: "text",
    });
  }

  private lastCustomerTextFromTurns(turns: { role: "user" | "assistant"; content: string }[]): string {
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].role === "user" && turns[i].content.trim()) {
        const c = turns[i].content.trim();
        if (isCustomerPlaceholderContent(c)) continue;
        return c;
      }
    }
    return "";
  }

  private async resolveVoiceTranscriptForMessage(
    acc: string,
    cid: string,
    mid: string,
    anchor: Message,
    opts?: { cachedTranscript?: string },
  ): Promise<{ text?: string; error?: string; stt: VoiceSttInboundResult }> {
    const cached = opts?.cachedTranscript?.trim();
    if (cached && hasTranscriptText(cached)) {
      return { text: cached, stt: "ok" };
    }

    const stored = await chatMemory.getTranscriptForMessage(acc, cid, mid);
    if (stored && hasTranscriptText(stored)) {
      return { text: stored, stt: "ok" };
    }

    if (!isWaVoice(anchor)) {
      const body = anchor.body?.trim();
      return body ? { text: body, stt: "ok" } : { stt: "none", error: "Empty text message." };
    }

    let vr = await inboundVoiceTranscriptWithExtraPatience(anchor);
    if (hasTranscriptText(vr.text)) {
      return { text: vr.text!.trim(), stt: "ok" };
    }

    const remoteBase = getRemoteVoiceAiBaseUrl();
    if (remoteBase) {
      const dl = await tryDownloadVoiceMediaFromMessage(anchor, { extended: true });
      if (dl) {
        try {
          const orig =
            dl.meta.filename?.trim() ||
            messageFilename(anchor) ||
            `voice-${mid}.ogg`;
          const remote = await postRemoteVoiceAiUpload(remoteBase, {
            buffer: dl.buf,
            originalName: orig,
            mimetype: dl.meta.mimetype || "audio/ogg",
            context: "",
          });
          const tr = remote.transcription?.trim();
          if (hasTranscriptText(tr)) {
            return { text: tr, stt: "ok" };
          }
        } catch (e) {
          if (deskDevLoggingEnabled()) {
            console.warn("[desk] remote voice STT fallback failed:", e instanceof Error ? e.message : e);
          }
        }
      }
    }

    return {
      stt: vr.stt,
      error: sttFailureUserMessage(vr.stt, vr.error),
    };
  }

  private async buildAnchoredChatReplyContext(
    accountId: string,
    chatId: string,
    anchorMessageId: string,
    accountIdBroadcast: string,
    opts?: { cachedTranscript?: string; anchorTimestampMs?: number },
  ): Promise<{
    turns: { role: "user" | "assistant"; content: string }[];
    lastCustomerText: string;
    voiceSttMissing: boolean;
    anchorTranscript?: string;
    anchorNotFound?: boolean;
    sttError?: string;
  }> {
    const acc = this.normalizeAccountId(accountId);
    const cid = chatId.trim();
    const mid = anchorMessageId.trim();
    const turnLimit = aiReplyTurnLimit();
    const s = this.sessions.get(acc);
    if (!s?.client?.info || !mid) {
      return { turns: [], lastCustomerText: "", voiceSttMissing: true };
    }

    const chat = await s.client.getChatById(cid);
    const fetchN = Math.max(turnLimit * 4, 80);
    const history = (await chat.fetchMessages({ limit: fetchN })).sort((a, b) => a.timestamp - b.timestamp);
    let anchorIdx = history.findIndex((m) => m.id.id === mid || m.id._serialized === mid);
    if (anchorIdx < 0 && opts?.anchorTimestampMs) {
      const tsSec = Math.floor(opts.anchorTimestampMs / 1000);
      anchorIdx = history.findIndex(
        (m) => !m.fromMe && Math.abs(m.timestamp - tsSec) <= 2,
      );
    }
    if (anchorIdx < 0) {
      return { turns: [], lastCustomerText: "", voiceSttMissing: true, anchorNotFound: true };
    }

    const anchor = history[anchorIdx];
    if (anchor.fromMe) {
      return { turns: [], lastCustomerText: "", voiceSttMissing: false };
    }

    let voiceTr: string | undefined;
    const anchorIsVoice = isWaVoice(anchor);
    if (anchorIsVoice) {
      const vr = await this.resolveVoiceTranscriptForMessage(acc, cid, anchor.id.id, anchor, {
        cachedTranscript: opts?.cachedTranscript,
      });
      if (hasTranscriptText(vr.text)) voiceTr = vr.text!.trim();
      if (voiceTr) {
        this.broadcastMessageUpdate({
          accountId: accountIdBroadcast,
          id: anchor.id.id,
          chatId: cid,
          transcript: voiceTr,
        });
        await chatMemory.updateTurnByMessageId(acc, cid, anchor.id.id, {
          content: voiceTr,
          source: "voice-transcript",
        });
      } else {
        await this.recordInboundToMemory(acc, cid, anchor);
        if (vr.error) {
          return {
            turns: [],
            lastCustomerText: "",
            voiceSttMissing: true,
            sttError: vr.error,
          };
        }
      }
    } else {
      await this.recordInboundToMemory(acc, cid, anchor);
    }

    const window = history.slice(0, anchorIdx + 1).slice(-aiReplyTurnLimit());
    let turns = await this.messagesToAiTurnsWithVoiceTranscripts(window, {
      lastInbound: anchor,
      lastVoiceTranscript: voiceTr,
      replyWindowOnly: true,
    });
    if (voiceTr) {
      turns = this.ensureVoiceTranscriptInAiTurns(turns, voiceTr);
    }

    const anchorText = voiceTr?.trim() || (!anchorIsVoice ? anchor.body?.trim() || "" : "");
    const voiceSttMissing = anchorIsVoice && !isUsefulVoiceTranscript(anchorText);
    const lastCustomerText = isUsefulVoiceTranscript(anchorText)
      ? anchorText
      : !anchorIsVoice
        ? anchorText
        : "";

    if (lastCustomerText) {
      turns = trimTurnsForAnchoredSuggest(turns, lastCustomerText);
    } else {
      turns = turns.slice(-aiSuggestTurnLimit());
    }

    if (deskDevLoggingEnabled()) {
      console.log(
        `[desk] anchored-context chat=…${chatIdSuffixForLog(cid)} anchor=…${mid.slice(-8)} turns=${turns.length} lastUser=${lastCustomerText.slice(0, 96)} sttMissing=${voiceSttMissing}`,
      );
    }

    return { turns, lastCustomerText, voiceSttMissing, anchorTranscript: voiceTr };
  }

  private async buildChatReplyContext(
    accountId: string,
    chatId: string,
    focus?: { lastInbound?: Message; lastVoiceTranscript?: string; anchorMessageId?: string },
  ): Promise<{ turns: { role: "user" | "assistant"; content: string }[]; lastCustomerText: string }> {
    const acc = this.normalizeAccountId(accountId);
    const cid = chatId.trim();
    const turnLimit = aiReplyTurnLimit();

    if (focus?.anchorMessageId?.trim()) {
      const anchored = await this.buildAnchoredChatReplyContext(acc, cid, focus.anchorMessageId, accountId);
      return { turns: anchored.turns, lastCustomerText: anchored.lastCustomerText };
    }

    if (focus?.lastInbound && focus.lastVoiceTranscript?.trim()) {
      await chatMemory.updateTurnByMessageId(acc, cid, focus.lastInbound.id.id, {
        content: focus.lastVoiceTranscript.trim(),
        source: "voice-transcript",
      });
    } else if (focus?.lastInbound) {
      await this.recordInboundToMemory(acc, cid, focus.lastInbound);
    }

    let turns = await chatMemory.getAiThreadTurns(acc, cid, { limit: turnLimit });

    if (turns.length === 0) {
      const s = this.sessions.get(acc);
      if (s?.client?.info) {
        try {
          const chat = await s.client.getChatById(cid);
          const fetchN = Math.max(turnLimit * 2, 24);
          const history = await chat.fetchMessages({ limit: fetchN });
          const sorted = history.sort((a, b) => a.timestamp - b.timestamp);
          const window = sorted.slice(-turnLimit);
          turns = await this.messagesToAiTurnsWithVoiceTranscripts(window, {
            lastInbound: focus?.lastInbound,
            lastVoiceTranscript: focus?.lastVoiceTranscript,
            replyWindowOnly: true,
          });
          await chatMemory.seedFromHistory(
            acc,
            cid,
            window.map((m) => ({
              id: m.id.id,
              body: m.body ?? "",
              timestamp: m.timestamp * 1000,
              isFromMe: m.fromMe,
              hasMedia: m.hasMedia,
              type: String(m.type),
            })),
          );
          if (focus?.lastVoiceTranscript?.trim() && focus.lastInbound) {
            await chatMemory.updateTurnByMessageId(acc, cid, focus.lastInbound.id.id, {
              content: focus.lastVoiceTranscript.trim(),
              source: "voice-transcript",
            });
          }
          turns = await chatMemory.getAiThreadTurns(acc, cid, { limit: turnLimit });
        } catch {
          /* fall through */
        }
      }
    }

    if (focus?.lastVoiceTranscript?.trim()) {
      turns = this.ensureVoiceTranscriptInAiTurns(turns, focus.lastVoiceTranscript);
    }

    turns = turns.slice(-turnLimit);

    if (turns.length === 0 && focus?.lastInbound) {
      const fallback = focus.lastVoiceTranscript?.trim() || focus.lastInbound.body?.trim() || "";
      if (fallback) turns = [{ role: "user", content: fallback }];
    }

    let lastCustomerText = this.lastCustomerTextFromTurns(turns);
    if (focus?.lastVoiceTranscript?.trim()) {
      lastCustomerText = focus.lastVoiceTranscript.trim();
    }

    if (deskDevLoggingEnabled()) {
      console.log(
        `[desk] context chat=…${chatIdSuffixForLog(cid)} turns=${turns.length} lastUser=${lastCustomerText.slice(0, 96)}`,
      );
    }

    return { turns, lastCustomerText };
  }

  async seedChatMemoryFromHistory(accountId: string, chatId: string): Promise<{ ok: boolean; error?: string }> {
    const hist = await this.fetchChatHistoryForUi(accountId, chatId);
    if (!hist.ok) return { ok: false, error: hist.error };
    await chatMemory.seedFromHistory(
      accountId,
      chatId,
      hist.messages.map((m) => ({
        id: m.id,
        body: m.body,
        transcript: m.transcript,
        timestamp: m.timestamp,
        isFromMe: m.isFromMe,
        hasMedia: m.hasMedia,
        type: m.type,
      })),
    );
    return { ok: true };
  }

  async fetchChatHistoryForUi(
    accountId: string,
    chatId: string,
  ): Promise<{ ok: true; messages: WaInboundPayload[] } | { ok: false; error: string }> {
    const id = this.normalizeAccountId(accountId);
    const s = this.sessions.get(id);
    if (!s?.client?.info) {
      return { ok: false, error: "WhatsApp not connected." };
    }
    const cid = chatId.trim();
    if (!cid) return { ok: false, error: "chatId required." };
    try {
      const chat = await s.client.getChatById(cid);
      const chatSerialized = chat.id._serialized;
      const limit = aiHistoryFetchLimit();
      const history = await chat.fetchMessages({ limit });
      const sorted = history.sort((a, b) => a.timestamp - b.timestamp);
      const messages: WaInboundPayload[] = sorted.map((m) => ({
        accountId: id,
        id: m.id.id,
        chatId: chatSerialized,
        from: uiMessageFrom(m),
        body: m.body ?? "",
        timestamp: m.timestamp * 1000,
        isFromMe: m.fromMe,
        hasMedia: m.hasMedia,
        type: String(m.type),
      }));

      const voiceItems = sorted
        .map((m, idx) => ({ m, idx }))
        .filter(({ m }) => isWaVoice(m))
        .slice(-16);

      await mapWithConcurrency(voiceItems, 4, async ({ m, idx }) => {
        try {
          const vr = await this.resolveVoiceTranscriptForMessage(id, cid, m.id.id, m);
          const tr = vr.text?.trim();
          const dl = await tryDownloadVoiceMediaFromMessage(m);
          const durationSec = dl
            ? Math.max(1, Math.round(voiceBufferRoughSeconds(dl.buf)))
            : undefined;
          messages[idx] = {
            ...messages[idx],
            ...(durationSec ? { voiceDurationSec: durationSec } : {}),
            ...(tr && hasTranscriptText(tr) ? { transcript: tr, body: "" } : {}),
          };
          if (tr && hasTranscriptText(tr)) {
            await chatMemory.updateTurnByMessageId(id, cid, m.id.id, {
              content: tr,
              source: "voice-transcript",
            });
          }
        } catch {
          /* STT optional for history sync */
        }
      });

      return { ok: true, messages };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async cancelPairing(accountId: string): Promise<{ ok: boolean; error?: string }> {
    const id = this.normalizeAccountId(accountId);
    const s = this.sessions.get(id);
    if (!s) return { ok: false, error: "No active session for this account." };
    try {
      await s.client.cancelPairingCode();
      return { ok: true };
    } catch {
      await this.teardownSession(id);
      broadcast("wa:status", { accountId: id, state: "disconnected" } satisfies WaStatusPayload);
      return { ok: true };
    }
  }

  /** Download voice note audio for in-app playback (message id matches UI `WaInboundPayload.id`). */
  async fetchChatVoiceAudio(
    accountId: string,
    chatId: string,
    messageId: string,
  ): Promise<WaFetchVoiceAudioResult> {
    const id = this.normalizeAccountId(accountId);
    const s = this.sessions.get(id);
    if (!s?.client?.info) return { ok: false, error: "WhatsApp not connected." };
    const cid = chatId.trim();
    const mid = messageId.trim();
    if (!cid || !mid) return { ok: false, error: "chatId and messageId required." };
    try {
      const chat = await s.client.getChatById(cid);
      const limit = Math.max(aiHistoryFetchLimit(), 250);
      const history = await chat.fetchMessages({ limit });
      const target = history.find((m) => m.id.id === mid || m.id._serialized === mid);
      if (!target) return { ok: false, error: "Message not found in recent history." };
      if (!isWaVoice(target)) return { ok: false, error: "That message is not a voice note." };
      const dl = await tryDownloadVoiceMediaFromMessage(target);
      if (!dl) return { ok: false, error: "Voice media not available yet — try again in a moment." };
      const mimeType = dl.meta.mimetype?.trim() || "audio/ogg";
      return {
        ok: true,
        base64: dl.buf.toString("base64"),
        mimeType,
        durationSec: Math.max(1, Math.round(voiceBufferRoughSeconds(dl.buf))),
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /** On-demand STT for a voice message (message id matches UI `WaInboundPayload.id`). */
  async transcribeChatVoiceMessage(
    accountId: string,
    chatId: string,
    messageId: string,
  ): Promise<{ text?: string; error?: string }> {
    const id = this.normalizeAccountId(accountId);
    const s = this.sessions.get(id);
    if (!s?.client?.info) return { error: "WhatsApp not connected." };
    const cid = chatId.trim();
    const mid = messageId.trim();
    if (!cid || !mid) return { error: "chatId and messageId required." };
    try {
      const chat = await s.client.getChatById(cid);
      const limit = Math.max(aiHistoryFetchLimit(), 250);
      const history = await chat.fetchMessages({ limit });
      const target = history.find((m) => m.id.id === mid || m.id._serialized === mid);
      if (!target) return { error: "Message not found in recent history." };
      if (!isWaVoice(target)) return { error: "That message is not a voice note." };
      const vr = await this.resolveVoiceTranscriptForMessage(id, cid, mid, target);
      if (vr.text?.trim()) {
        this.broadcastMessageUpdate({
          accountId,
          id: mid,
          chatId: cid,
          transcript: vr.text.trim(),
        });
        return { text: vr.text.trim() };
      }
      return { error: vr.error ?? sttFailureUserMessage(vr.stt) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }

  async resetLocalData(accountId: string): Promise<{ ok: boolean; error?: string }> {
    const id = this.normalizeAccountId(accountId);
    try {
      await this.logout(id);
      const dp = path.join(userDataDir(), "wwebjs", id);
      await rm(dp, { recursive: true, force: true });
      broadcast("wa:status", { accountId: id, state: "disconnected" } satisfies WaStatusPayload);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

function uiMessageFrom(m: Message): string {
  const a = m.author?.replace(/@c\.us|@g\.us|@lid\b/gi, "");
  if (a) return a;
  return (m.from || "").replace(/@c\.us|@g\.us|@lid\b/gi, "");
}
