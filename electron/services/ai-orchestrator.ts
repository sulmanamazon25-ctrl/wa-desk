import Groq from "groq-sdk";
import OpenAI from "openai";
import { toFile } from "openai";
import type { AIReplyRequest, AIReplyResponse, AIReplyVariant, Tone } from "../ipc-contract";
import { normalizeGroqApiKey } from "../lib/groq-key";
import { normalizeXaiApiKey } from "../lib/xai-key";
import { loadSecrets } from "./secrets-store";
import { convertAudioToWav16k } from "./voice-audio-normalize";
import {
  createOpenRouterClient,
  openRouterChatOnce,
  openRouterTranscribeBuffer,
  parseOpenRouterChatModels,
  parseOpenRouterSttModels,
  resolveOpenRouterApiKey,
} from "./openrouter-client";

const XAI_BASE_URL = "https://api.x.ai/v1";

async function resolveXaiApiKey(): Promise<string | undefined> {
  const disk = await loadSecrets();
  const fromDisk = normalizeXaiApiKey(disk.xaiApiKey);
  if (fromDisk) {
    process.env.XAI_API_KEY = fromDisk;
    return fromDisk;
  }
  return normalizeXaiApiKey(process.env.XAI_API_KEY);
}

async function resolveGroqApiKey(): Promise<string | undefined> {
  const disk = await loadSecrets();
  const fromDisk = normalizeGroqApiKey(disk.groqApiKey);
  if (fromDisk) {
    process.env.GROQ_API_KEY = fromDisk;
    return fromDisk;
  }
  return normalizeGroqApiKey(process.env.GROQ_API_KEY);
}

const DEFAULT_XAI_CHAT_MODELS = ["grok-3", "grok-2-1212", "grok-2-latest"] as const;

const DEFAULT_GROQ_CHAT_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-70b-versatile",
  "llama-3.1-8b-instant",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
] as const;

const DEFAULT_GROQ_WHISPER_MODELS = ["whisper-large-v3-turbo", "whisper-large-v3"] as const;

const DEFAULT_XAI_STT_MODELS = ["grok-stt"] as const;

/** Optional hints from WhatsApp `MessageMedia` for correct Whisper / Grok STT upload typing. */
export type VoiceSttMeta = { mimetype?: string; filename?: string };

function pickVoiceUpload(meta?: VoiceSttMeta): { basename: string; mime?: string } {
  const rawFn = (meta?.filename ?? "").trim().replace(/^.*[/\\]/, "");
  if (rawFn && /\.[a-z0-9]{2,8}$/i.test(rawFn)) {
    return { basename: rawFn.slice(0, 120), mime: meta?.mimetype };
  }
  const mt = (meta?.mimetype ?? "").toLowerCase();
  if (mt.includes("webm")) return { basename: "voice.webm", mime: meta?.mimetype };
  if (mt.includes("mpeg") || mt.includes("mp3")) return { basename: "voice.mp3", mime: meta?.mimetype };
  if (mt.includes("mp4") || mt.includes("m4a") || mt.includes("aac")) return { basename: "voice.m4a", mime: meta?.mimetype };
  if (mt.includes("opus")) return { basename: "voice.opus", mime: meta?.mimetype };
  if (mt.includes("ogg")) return { basename: "voice.ogg", mime: meta?.mimetype || "audio/ogg" };
  return { basename: "voice.ogg", mime: meta?.mimetype || "audio/ogg" };
}

function parseModelList(raw: string | undefined, fallback: readonly string[]): string[] {
  if (!raw?.trim()) return [...fallback];
  const parts = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [...fallback];
}

function dedupeModels(primary: string | undefined, rest: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (m: string) => {
    const k = m.trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(k);
  };
  if (primary?.trim()) add(primary.trim());
  for (const m of rest) add(m);
  return out;
}

/** Last 1–2 inbound user lines → cheap language hint for the system prompt. */
export function deriveLanguageHintForReply(
  messages: { role: "user" | "assistant" | "system"; content: string }[],
): string | undefined {
  const userLines = messages.filter((m) => m.role === "user").slice(-2);
  const sample = userLines
    .map((m) => m.content.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!sample) return undefined;
  const arabicScript = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  if (arabicScript.test(sample)) {
    return "Latest customer lines use Arabic script (Urdu or Arabic); match that script and natural spelling.";
  }
  if (/[\u0900-\u097F]/.test(sample)) {
    return "Latest customer lines use Devanagari (e.g. Hindi); reply in that script when they did.";
  }
  const stripped = sample.replace(/\s+/g, "");
  if (!stripped) return undefined;
  let nonAscii = 0;
  for (let i = 0; i < stripped.length; i++) {
    if (stripped.charCodeAt(i) > 127) nonAscii++;
  }
  if (nonAscii / stripped.length < 0.06) {
    return "Latest customer lines are mostly Latin letters (English and/or Roman Urdu); keep the same mix and informal spelling.";
  }
  return undefined;
}

function toneInstruction(tone: Tone): string {
  switch (tone) {
    case "professional":
      return "Tone: owner — professional, specific, brief. Facts over filler.";
    case "casual":
      return "Tone: owner — relaxed and specific; match slang, zero performative padding.";
    case "friendly":
    default:
      return "Tone: owner — warm but still specific and short; end clean — no nagging, no extra lines.";
  }
}

function strictOutputBlock(): string {
  return [
    "FULL THREAD = READ FOR CONTEXT ONLY: Use every prior turn to understand who/what/when — but your reply must NOT recap the conversation, summarize 'so far', or narrate what you understood unless they explicitly asked for a recap.",
    "STRICT REPLY (non‑negotiable): Output ONLY sentences that directly satisfy the customer's current intent from their latest message in thread context. No extras: no 'thanks for reaching out', no 'hope you're well', no unrelated tips, no 'by the way', no closing sales lines, no second topic they didn't raise. If a line doesn't earn its place toward their ask, omit it — full strict.",
  ].join("\n");
}

function onlyReplyToAskBlock(): string {
  return [
    "INTENT FIRST: Infer what they actually want from their latest line + full thread (price? time? address? yes/no? complaint? order update?) — answer THAT directly. Do not answer a generic 'support' script when a concrete reply is possible.",
    "TOP RULE — ONLY THE MESSAGE: Answer exactly what they asked (or the one clear next step). Be specific: numbers, time, price, yes/no, name. SHORT and EFFECTIVE: fewest words that fully do the job. Do NOT pad with filler, side topics, 'by the way', soft intros, or 'help help' energy.",
    "Anti-robot: no template rhythm, no stacked polite lines, no lecture. One-line customer message → usually one or two short reply lines, not a paragraph unless they asked for detail.",
  ].join("\n");
}

function antiRoboticBlock(): string {
  return [
    "WHATSAPP: SHORT + EFFECTIVE — default 1–3 tight lines (4 only if they asked for a list/steps). Lead with the useful fact; no buildup.",
    "No 'help help' mode: never use help-offers or assistance language as a substitute for the real answer. If you know the answer, say it; don't wrap it in 'I'm happy to help you with…' first.",
    "No 'faltu' glue: no small talk, mood, philosophy, or extra sentences that don't answer their line.",
    "NEVER pushy closers: no 'kuch aur bat…', 'aur discuss?', 'koi aur topic?', 'anything else on your mind?', 'if you want to talk about something else' — when done, STOP.",
    "No random trailing questions ('ab aap kya chahte ho?', 'aur bataiye?') unless one missing fact blocks the answer — then one short question only.",
    "No routine 'how can I help' / 'madad?' / 'anything else?' unless they clearly asked for help/readiness (see next).",
    "HELP / READY (exception only): they explicitly asked for help, options, or readiness — then at most ONE short natural readiness beat + answer; still no duplicate help.",
    "Never repeat the same idea twice in one message. Do not mirror the same template you used in your previous assistant turns (same opener/closer/catchphrase) — vary structure.",
    "No generic chatbot openers/closers unless HELP/READY applies: avoid 'I'm here to help', 'How can I help', 'I'd be happy to assist', 'Feel free to reach out', 'Please let me know if you need anything else', 'Just let me know' stacked EN+UR.",
    "Don't echo their whole question — tiny ack ok, then answer.",
    "Don't copy-paste the same phrase you already used in the thread.",
    "No meta ('As your assistant…', 'Certainly!') unless they asked for help — then one short human beat max.",
  ].join("\n");
}

function voiceSttMissingBlock(): string {
  return [
    "LATEST INBOUND was spoken audio, but the exact words are NOT in the thread (no transcript line).",
    "You MUST still write 1–2 short natural lines using ONLY earlier messages for topic and language.",
    "ABSOLUTE BAN (any language, including Roman Urdu): mentioning or implying voice, audio, recording, listening, hearing, sound, playing, failed download, transcription/caption, or asking them to type/text/write/repeat/send again instead of speaking.",
    "Do not blame or mention WhatsApp, attachments, files, or 'could not access' the message medium.",
    "Also ban: 'can't', 'cannot', 'unable', 'sorry I', apologies about understanding audio.",
    "If prior context is thin, one neutral short line is fine (e.g. a brief ack in the chat language) — still zero audio/voice vocabulary. Do NOT write 'main', 'mujhe', 'meri' + 'read/sun/access' + failure in one sentence (any script).",
  ].join("\n");
}

function finalOutboundLock(): string {
  return [
    "FINAL — CHECK BEFORE YOU OUTPUT (highest priority):",
    "1) ONLY the user's specific need: reply to their latest message in full-thread context. Do not auto-add help, thanks, greetings, signatures, 'hope this helps', disclaimers, or any sentence they did not implicitly ask for.",
    "2) NO LONG PARAGRAPHS: default is a few short lines (like real WhatsApp). Never write an essay, multiple big blocks, or bullet essays unless they explicitly asked for a long explanation or a list.",
    "3) NO DUPLICATION: inside one reply, never say the same point twice in different words. Across the thread, read your own past assistant messages — do NOT reuse the same opening line, same closing line, or same catchphrase you already sent; change structure and wording so it does not feel copy-pasted.",
    "4) If you catch yourself adding generic filler, delete it and send only the factual / actionable part.",
  ].join("\n");
}

function latestCustomerIntentBlock(lastCustomerText: string): string {
  const line = lastCustomerText.trim().slice(0, 1200);
  if (!line) {
    return [
      "LATEST CUSTOMER INTENT: Use only the final customer lines in the thread below as the primary question.",
      "Older lines are background — do not answer a different topic from earlier in the thread.",
      "NEVER repeat questions from your own previous assistant messages (e.g. do not re-ask about a topic you already asked if the customer sent something new).",
    ].join(" ");
  }
  return [
    "LATEST CUSTOMER INTENT (answer THIS first — highest priority):",
    `"${line}"`,
    "Older thread lines are background only. Do not swap topics or answer a previous unrelated question.",
    "Do NOT echo or re-ask about words/topics that appear only in YOUR past assistant replies — reply to what the CUSTOMER said in the line above.",
    "If your earlier replies already asked about something and the customer sent a new message, answer the NEW message — do not loop the same question again.",
  ].join("\n");
}

function chatScopeBlock(chatId: string): string {
  const id = chatId.trim().slice(0, 80);
  return [
    `CONVERSATION SCOPE: You are replying in exactly ONE WhatsApp thread (id: ${id}).`,
    "Use ONLY the message turns provided below from this thread. Ignore any other customer, chat, or inbox you might know about.",
    "If business FAQ/training below conflicts with what this customer actually asked in this thread, the thread wins.",
  ].join(" ");
}

function buildSystemPrompt(req: AIReplyRequest): string {
  const parts = [
    "You are the BUSINESS OWNER on WhatsApp — not a chatbot. Your text must feel like a quick human thumb, not a script.",
    chatScopeBlock(req.chatId),
    "GLOBAL — NEVER say you could not read, hear, decode, or access the customer's message (voice or text). NEVER ask them to type again, send text instead, or resend because of limits. If something is unclear, ask a normal business follow-up without mentioning audio, voice notes, transcription, or WhatsApp technology.",
    "Read the ENTIRE thread below. Infer intent from the latest customer message in context (what outcome they want), then reply in the fewest effective words — not a lecture. Mirror their energy: length, formality, punctuation, emoji (light if they use light; none if none).",
    "The thread may mix plain text with lines like 'Customer sent a sticker' or transcribed voice — use all lines together to infer topic, language, and tone; do not reply with only bracket placeholders.",
    "When a line is real transcribed speech (full sentences), treat it as what they literally said and answer that content. If their latest turn is ONLY a voice placeholder with no transcribed words, infer from earlier thread only: 1–2 short natural lines in the SAME language as the chat. NEVER say you cannot hear/read/listen, never ask them to type/text instead of voice, never mention download/transcription failures — that reads robotic and rude.",
    "Reply in the SAME language as their latest message (including Urdu/Hindi/English mix if they mix).",
    "Sound natural: short sentences, contractions where normal, no 'As an AI', no numbered policy dumps unless they asked for steps.",
    strictOutputBlock(),
    onlyReplyToAskBlock(),
    antiRoboticBlock(),
    "If business context below conflicts with what this customer asked in THIS thread, follow the thread. If business context conflicts with a risky claim, stay honest: clarify briefly instead of inventing prices, legal promises, or fake bookings.",
    toneInstruction(req.tone),
  ];
  if (req.lastCustomerText?.trim()) {
    parts.push(latestCustomerIntentBlock(req.lastCustomerText));
  }
  if (req.training?.trim()) {
    parts.push("Your business knowledge (follow faithfully; if one critical fact is missing, ask a single short question — otherwise do not fish for more chat):\n" + req.training.trim());
  }
  if (req.languageHint?.trim()) {
    parts.push("Language hint: " + req.languageHint.trim());
  }
  if (req.chatSurface === "group") {
    parts.push(
      "This is a GROUP WhatsApp: several people may appear as the customer side. Write ONE reply from you (the owner) that fits the flow — casual and human, not a broadcast. You can speak to the room or to whoever just spoke, whichever matches the thread; avoid stiff 'Dear all' / corporate mass-message vibes unless the chat already talks that way.",
    );
  }
  if (req.voiceSttMissing) {
    parts.push(voiceSttMissingBlock());
  }
  parts.push(finalOutboundLock());
  return parts.join("\n\n");
}

function isRefinementRequest(req: AIReplyRequest): boolean {
  return Boolean(req.seedReply?.trim() && req.refinement?.trim());
}

function buildRefinementSystemSuffix(): string {
  return [
    "REFINEMENT MODE (owner tool): The owner is editing THEIR draft WhatsApp reply — not quoting the customer.",
    "The next user message has (1) the current draft and (2) what they want added, removed, or changed.",
    "Output ONLY the final message text ready to send: FULL STRICT — only words the owner needs to send; no extra lines, no topic drift, no essay paragraphs unless the owner asked for length — no quotes, no preamble, no 'Sure —', 'Certainly!', no JSON, no markdown fences — unless the owner's note explicitly asks for a polite opener; still no duplicate help lines and no trailing 'kuch aur bat / anything else' unless the owner asked for that.",
    "Keep the same primary language as the draft unless they explicitly ask to switch.",
    "Follow their instructions closely; weave new facts in naturally. Do not invent prices, legal promises, or bookings they did not provide.",
  ].join("\n");
}

function buildMultiSuggestInstruction(): string {
  return [
    "MULTI-REPLY MODE (manual suggest only): Output ONLY one JSON object — no markdown fences, no commentary before or after.",
    'Schema: {"variants":[{"label":"2–5 words in the customer’s language","text":"full WhatsApp reply ready to send"},{"label":"…","text":"…"}]}',
    "Return 2 to 4 variants. Each `text` is FULL STRICT: read full thread for intent only — output must be only what that turn needs, zero extra sentences, max a few short lines per variant (no essay paragraphs). Short, effective, specific — no filler, no 'help help'. Variants use DIFFERENT wording and different structure — no shared opener/closer, no duplicate help patterns, no near-copy variants.",
    "If LATEST CUSTOMER INTENT is set above, every variant MUST answer that exact customer line — not topics from your own previous assistant messages in the thread.",
    "Never generate variants that only rephrase the same question you (assistant) already asked — give useful replies to what the customer actually said.",
    "If the customer mixes several topics, give one strong reply per distinct topic (or clearly separated angles). If there is only one topic, still give 2–4 variants with clearly different angles (short vs slightly warmer, question vs statement) — not the same sentence with synonyms swapped.",
    "If the thread includes voice transcripts (real sentences), every variant must respond to that wording/topic like you heard it — not a generic 'got your voice note' unless there is truly no transcribed content, only an audio placeholder.",
    "Every `text` must be a complete message in the same language as their latest message; match emoji level to the thread. Each variant = only what that thread turn needs — zero filler.",
    "Unless their latest line clearly asks for help / readiness / options, do NOT end variants with invitations to keep talking, 'anything else', 'how can I help', or 'kuch aur bat' — default to plain useful replies that STOP. If they DID ask for help, at most one variant may lean slightly 'ready to assist' but still no pushy 'tell me more topics' closers.",
  ].join("\n");
}

function parseReplyVariants(raw: string): AIReplyVariant[] | null {
  const normalizeItem = (item: unknown, index: number): AIReplyVariant | null => {
    if (!item || typeof item !== "object") return null;
    const o = item as { label?: unknown; text?: unknown };
    const text = typeof o.text === "string" ? o.text.trim() : "";
    if (!text) return null;
    const labelRaw = typeof o.label === "string" ? o.label.trim() : "";
    const label =
      labelRaw.length > 0 ? labelRaw.slice(0, 48) : `Option ${index + 1}`;
    return { label, text };
  };

  const tryParse = (s: string): AIReplyVariant[] | null => {
    try {
      const j = JSON.parse(s) as { variants?: unknown };
      if (!j || typeof j !== "object" || !Array.isArray(j.variants)) return null;
      const out: AIReplyVariant[] = [];
      for (let i = 0; i < j.variants.length; i++) {
        const v = normalizeItem(j.variants[i], out.length);
        if (v) out.push(v);
      }
      return out.length >= 2 ? out.slice(0, 4) : null;
    } catch {
      return null;
    }
  };

  let s = raw.trim();
  let out = tryParse(s);
  if (out) return out;
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(s);
  if (fence) {
    out = tryParse(fence[1].trim());
    if (out) return out;
  }
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    out = tryParse(s.slice(start, end + 1));
    if (out) return out;
  }
  return null;
}

function isAuthError(status: number | undefined): boolean {
  return status === 401 || status === 403;
}

function isLikelyAuthFailure(err: unknown): boolean {
  if (isAuthError(errorStatus(err))) return true;
  const raw = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    raw.includes("invalid api key") ||
    raw.includes("invalid_api_key") ||
    raw.includes("incorrect api key")
  );
}

function errorStatus(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number") {
    return (err as { status: number }).status;
  }
  return undefined;
}

function extractApiDetail(raw: string): string {
  const oneLine = raw.replace(/\s+/g, " ").trim();
  const quoted = /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(oneLine);
  if (quoted) return quoted[1].replace(/\\"/g, '"').slice(0, 160);
  const afterCode = /^\d{3}\s+(.+)/.exec(oneLine);
  if (afterCode) return afterCode[1].slice(0, 160);
  return oneLine.length > 160 ? oneLine.slice(0, 157) + "…" : oneLine;
}

function compactProviderError(label: string, model: string, err: unknown): string {
  const st = errorStatus(err);
  const raw = err instanceof Error ? err.message : String(err);
  if (isLikelyAuthFailure(err)) {
    return `${label}: invalid API key — open API keys in the app, save a key from the provider console, then try again.`;
  }
  if (st === 429) {
    return `${label}: rate limit — wait a bit or check your provider dashboard.`;
  }
  const detail = extractApiDetail(raw);
  return `${label} (${model}): ${detail}`;
}

async function xaiChatOnce(
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

async function groqChatOnce(
  groq: Groq,
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  maxTokens: number,
  temperature: number,
): Promise<string | null> {
  const completion = await groq.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });
  return completion.choices[0]?.message?.content?.trim() || null;
}

function replyFromRaw(
  raw: string,
  req: AIReplyRequest,
  provider: AIReplyResponse["provider"],
  model: string,
): AIReplyResponse {
  if (isRefinementRequest(req)) {
    return { text: raw, provider, model };
  }
  if (req.multiSuggest) {
    const variants = parseReplyVariants(raw);
    if (variants && variants.length >= 2) {
      return { text: variants[0].text, variants, provider, model };
    }
  }
  return { text: raw, provider, model };
}

export async function generateReply(req: AIReplyRequest): Promise<AIReplyResponse> {
  const hint = req.languageHint?.trim() || deriveLanguageHintForReply(req.messages);
  const promptReq = hint ? ({ ...req, languageHint: hint } satisfies AIReplyRequest) : req;
  const refine = isRefinementRequest(req);
  const maxTokens = refine ? 1024 : req.multiSuggest ? 1536 : 480;
  const temperature = refine ? 0.62 : req.multiSuggest ? 0.74 : 0.74;
  const system =
    buildSystemPrompt(promptReq) +
    (!refine && req.multiSuggest ? "\n\n" + buildMultiSuggestInstruction() : "") +
    (refine ? "\n\n" + buildRefinementSystemSuffix() : "");
  const tailUser: { role: "user"; content: string } | null = refine
    ? {
        role: "user",
        content:
          "Current draft (yours to improve):\n" +
          req.seedReply!.trim() +
          "\n\nWhat to add or change:\n" +
          req.refinement!.trim(),
      }
    : null;
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: system },
    ...req.messages.map((m) => ({ role: m.role, content: m.content })),
    ...(tailUser ? [tailUser] : []),
  ];

  const orKey = await resolveOpenRouterApiKey();
  if (orKey) {
    const disk = await loadSecrets();
    const primary =
      disk.openrouterChatModel?.trim() ||
      process.env.OPENROUTER_CHAT_MODEL?.trim() ||
      "google/gemini-2.5-flash";
    const orModels = parseOpenRouterChatModels(primary);
    const client = createOpenRouterClient(orKey);
    const errs: string[] = [];
    for (const model of orModels) {
      try {
        const text = await openRouterChatOnce(client, model, messages, maxTokens, temperature);
        if (text) return replyFromRaw(text, req, "openrouter", model);
      } catch (e) {
        errs.push(compactProviderError("OpenRouter", model, e));
        if (isLikelyAuthFailure(e)) break;
      }
    }
    const tail = [...new Set(errs)].slice(0, 4).join(" · ");
    return {
      text:
        "OpenRouter could not complete this reply. " +
        (tail || "Unknown error") +
        " — Check your OpenRouter key and chat model under API keys.",
      provider: "openrouter",
    };
  }

  const xaiKey = await resolveXaiApiKey();
  if (xaiKey) {
    const disk = await loadSecrets();
    const primary = disk.xaiChatModel?.trim() || process.env.XAI_CHAT_MODEL?.trim() || "grok-3";
    const xaiModels = dedupeModels(primary, [...DEFAULT_XAI_CHAT_MODELS]);
    const client = new OpenAI({ apiKey: xaiKey, baseURL: XAI_BASE_URL });
    const errs: string[] = [];
    for (const model of xaiModels) {
      try {
        const text = await xaiChatOnce(client, model, messages, maxTokens, temperature);
        if (text) return replyFromRaw(text, req, "xai", model);
      } catch (e) {
        errs.push(compactProviderError("Grok", model, e));
        if (isLikelyAuthFailure(e)) break;
      }
    }
    const tail = [...new Set(errs)].slice(0, 4).join(" · ");
    return {
      text: "Grok could not complete this reply. " + (tail || "Unknown error") + " — Check x.ai API keys and model name.",
      provider: "xai",
    };
  }

  const groqKey = await resolveGroqApiKey();
  const envGroqList = process.env.GROQ_MODEL_LIST;
  const primaryGroq = process.env.GROQ_MODEL;
  const groqModels = dedupeModels(primaryGroq, parseModelList(envGroqList, [...DEFAULT_GROQ_CHAT_MODELS]));

  if (!groqKey) {
    return {
      text: "Add your OpenRouter API key under API keys — https://openrouter.ai/keys — one key runs chat and voice. Optional: xAI or Groq as legacy backup.",
      provider: "groq",
    };
  }

  const groq = new Groq({ apiKey: groqKey });
  const groqErrors: string[] = [];
  for (const model of groqModels) {
    try {
      const text = await groqChatOnce(groq, model, messages, maxTokens, temperature);
      if (text) return replyFromRaw(text, req, "groq", model);
    } catch (e) {
      groqErrors.push(compactProviderError("Groq", model, e));
      if (isLikelyAuthFailure(e)) break;
    }
  }

  const tail = [...new Set(groqErrors)].slice(0, 4).join(" · ");
  return {
    text: "Groq could not complete this reply. " + (tail || "Unknown error") + " — Fix the API key or try another model in API keys.",
    provider: "groq",
  };
}

/** When unset: xAI STT first if only xAI key exists; else Groq Whisper first (better on some Opus blobs). Override with WWEBJS_VOICE_STT_ORDER. */
async function effectiveVoiceSttOrder(): Promise<"groq-first" | "xai-first"> {
  const forced = (process.env.WWEBJS_VOICE_STT_ORDER ?? "").trim().toLowerCase();
  if (forced === "xai-first") return "xai-first";
  if (forced === "groq-first") return "groq-first";
  const groqKey = await resolveGroqApiKey();
  const xaiKey = await resolveXaiApiKey();
  if (xaiKey && !groqKey) return "xai-first";
  return "groq-first";
}

function groqUploadVariants(primary: { basename: string; mime?: string }): { basename: string; mime?: string }[] {
  const seen = new Set<string>();
  const out: { basename: string; mime?: string }[] = [];
  const add = (b: { basename: string; mime?: string }) => {
    const k = `${b.basename}|${b.mime ?? ""}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push(b);
  };
  add(primary);
  add({ basename: "voice.ogg", mime: "audio/ogg" });
  add({ basename: "voice.opus", mime: "audio/opus" });
  add({ basename: "recording.oga", mime: "audio/ogg" });
  return out;
}

async function transcribeWithOpenRouter(buffer: Buffer, meta?: VoiceSttMeta): Promise<string | null> {
  const orKey = await resolveOpenRouterApiKey();
  if (!orKey) return null;
  const disk = await loadSecrets();
  const primary =
    disk.openrouterSttModel?.trim() ||
    process.env.OPENROUTER_STT_MODEL?.trim() ||
    "openai/whisper-large-v3-turbo";
  const listEnv = process.env.OPENROUTER_STT_MODEL_LIST;
  const models = parseOpenRouterSttModels(primary, listEnv);
  const fmt = (meta?.mimetype ?? "").includes("ogg") ? "ogg" : "wav";
  const audioFormat = fmt === "ogg" ? "ogg" : "wav";
  for (const model of models) {
    const text = await openRouterTranscribeBuffer(orKey, buffer, model, audioFormat);
    if (text) return text;
  }
  return null;
}

async function transcribeWithGroqWhisper(
  buffer: Buffer,
  meta: VoiceSttMeta | undefined,
  primaryPick: { basename: string; mime?: string },
): Promise<string | null> {
  const groqKey = await resolveGroqApiKey();
  if (!groqKey) return null;
  const groqWhisperModels = parseModelList(process.env.GROQ_WHISPER_MODEL_LIST, [...DEFAULT_GROQ_WHISPER_MODELS]);
  const groq = new Groq({ apiKey: groqKey });
  const variants = groqUploadVariants(primaryPick);
  const errors: string[] = [];
  for (const { basename, mime } of variants) {
    const fileOpts = mime ? { type: mime } : undefined;
    for (const model of groqWhisperModels) {
      try {
        const audioFile = await toFile(buffer, basename, fileOpts);
        const result = await groq.audio.transcriptions.create({
          file: audioFile,
          model,
        });
        const text = result.text?.trim();
        if (text) return text;
      } catch (e) {
        errors.push(`${model}/${basename}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  if (process.env.WWEBJS_DEV_LOG === "1" && errors.length) {
    console.warn("[desk] Groq Whisper exhausted:", errors.slice(0, 4).join(" · "));
  }
  return null;
}

async function transcribeWithXaiStt(buffer: Buffer, meta?: VoiceSttMeta): Promise<string | null> {
  const xaiKey = await resolveXaiApiKey();
  if (!xaiKey) return null;
  const primary = process.env.XAI_STT_MODEL?.trim();
  const xaiSttModels = dedupeModels(primary, parseModelList(process.env.XAI_STT_MODEL_LIST, [...DEFAULT_XAI_STT_MODELS]));
  const client = new OpenAI({ apiKey: xaiKey, baseURL: XAI_BASE_URL });
  const { basename, mime } = pickVoiceUpload(meta);
  const fileOpts = mime ? { type: mime } : undefined;
  for (const model of xaiSttModels) {
    try {
      const audioFile = await toFile(buffer, basename, fileOpts);
      const result = await client.audio.transcriptions.create({
        file: audioFile,
        model,
      });
      const text = result.text?.trim();
      if (text) return text;
    } catch (e) {
      if (process.env.WWEBJS_DEV_LOG === "1") {
        console.warn(`[desk] xAI STT model=${model} file=${basename}:`, e instanceof Error ? e.message : e);
      }
    }
  }
  return null;
}

export async function transcribeVoiceOggBuffer(buffer: Buffer, meta?: VoiceSttMeta): Promise<string> {
  if (!buffer?.length) {
    throw new Error("Empty audio buffer — cannot transcribe.");
  }

  let sttBuffer = buffer;
  let sttMeta = meta;
  const wav = await convertAudioToWav16k(buffer, meta);
  if (wav?.length) {
    sttBuffer = wav;
    sttMeta = { mimetype: "audio/wav", filename: "voice.wav" };
    if (process.env.WWEBJS_DEV_LOG === "1") {
      console.log(`[desk] voice STT using ffmpeg wav (${wav.length} bytes, was ${buffer.length})`);
    }
  } else if (process.env.WWEBJS_DEV_LOG === "1") {
    console.log(`[desk] voice STT raw buffer ${buffer.length} bytes mime=${meta?.mimetype ?? "?"}`);
  }

  const primaryPick = pickVoiceUpload(sttMeta);

  const orKey = await resolveOpenRouterApiKey();
  if (orKey) {
    const text = await transcribeWithOpenRouter(sttBuffer, sttMeta);
    if (text) return text;
  }

  const order = await effectiveVoiceSttOrder();

  let text: string | null = null;
  if (order === "xai-first") {
    text = await transcribeWithXaiStt(sttBuffer, sttMeta);
    if (!text) text = await transcribeWithGroqWhisper(sttBuffer, sttMeta, primaryPick);
  } else {
    text = await transcribeWithGroqWhisper(sttBuffer, sttMeta, primaryPick);
    if (!text) text = await transcribeWithXaiStt(sttBuffer, sttMeta);
  }

  if (text) return text;

  const groqKey = await resolveGroqApiKey();
  const xaiKey = await resolveXaiApiKey();
  if (!orKey && !groqKey && !xaiKey) {
    throw new Error(
      "Voice notes need an OpenRouter API key (recommended) or legacy xAI/Groq keys — add under Setup → API keys, Save, then Test.",
    );
  }
  throw new Error(
    "Voice transcription failed after OpenRouter STT + legacy fallbacks. Check API keys → OpenRouter STT model (e.g. openai/whisper-large-v3-turbo). Set WWEBJS_DEV_LOG=1 for details.",
  );
}
