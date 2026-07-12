import { promises as fs } from "node:fs";
import path from "node:path";
import { app } from "electron";
import type { AiThreadTurn } from "../ipc-contract";
import { isVoiceNoteMessage } from "../../shared/wa-voice-note";

export type ChatMemoryTurnSource = "text" | "voice-transcript" | "media-placeholder";

export type ChatMemoryTurn = {
  role: "user" | "assistant";
  content: string;
  messageId?: string;
  timestamp: number;
  source?: ChatMemoryTurnSource;
};

type ChatMemoryFile = {
  version: 1;
  chats: Record<string, ChatMemoryTurn[]>;
};

function normalizeAccountId(accountId: string): string {
  const t = accountId.trim();
  return t || "default";
}

function memoryFilePath(accountId: string): string {
  const id = normalizeAccountId(accountId);
  return path.join(app.getPath("userData"), "chat-memory", `${id}.json`);
}

function chatMemoryMaxTurns(): number {
  const n = Number(process.env.WWEBJS_CHAT_MEMORY_MAX_TURNS);
  if (Number.isFinite(n) && n >= 20 && n <= 500) return Math.floor(n);
  return 80;
}

const fileCache = new Map<string, ChatMemoryFile>();

async function loadFile(accountId: string): Promise<ChatMemoryFile> {
  const key = normalizeAccountId(accountId);
  const cached = fileCache.get(key);
  if (cached) return cached;

  const fp = memoryFilePath(key);
  try {
    const raw = await fs.readFile(fp, "utf8");
    const parsed = JSON.parse(raw) as ChatMemoryFile;
    if (parsed?.version === 1 && parsed.chats && typeof parsed.chats === "object") {
      fileCache.set(key, parsed);
      return parsed;
    }
  } catch {
    /* new file */
  }
  const empty: ChatMemoryFile = { version: 1, chats: {} };
  fileCache.set(key, empty);
  return empty;
}

async function saveFile(accountId: string, data: ChatMemoryFile): Promise<void> {
  const key = normalizeAccountId(accountId);
  fileCache.set(key, data);
  const fp = memoryFilePath(key);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, JSON.stringify(data, null, 2), "utf8");
}

function trimTurns(turns: ChatMemoryTurn[], max: number): ChatMemoryTurn[] {
  if (turns.length <= max) return turns;
  return turns.slice(-max);
}

function turnContentKey(t: ChatMemoryTurn): string {
  return `${t.role}|${t.messageId ?? ""}|${t.content.trim()}`;
}

export async function appendTurn(
  accountId: string,
  chatId: string,
  turn: ChatMemoryTurn,
): Promise<void> {
  const acc = normalizeAccountId(accountId);
  const cid = chatId.trim();
  if (!cid || !turn.content.trim()) return;

  const data = await loadFile(acc);
  const turns = [...(data.chats[cid] ?? [])];
  const max = chatMemoryMaxTurns();

  if (turn.messageId) {
    const idx = turns.findIndex((t) => t.messageId === turn.messageId && t.role === turn.role);
    if (idx >= 0) {
      turns[idx] = { ...turns[idx], ...turn, content: turn.content.trim() };
      data.chats[cid] = trimTurns(turns, max);
      await saveFile(acc, data);
      return;
    }
  }

  const last = turns[turns.length - 1];
  if (last && turnContentKey(last) === turnContentKey(turn)) return;

  turns.push({
    ...turn,
    content: turn.content.trim(),
    timestamp: turn.timestamp || Date.now(),
  });
  data.chats[cid] = trimTurns(turns, max);
  await saveFile(acc, data);
}

export async function updateTurnByMessageId(
  accountId: string,
  chatId: string,
  messageId: string,
  patch: { content: string; source?: ChatMemoryTurnSource },
): Promise<void> {
  const acc = normalizeAccountId(accountId);
  const cid = chatId.trim();
  const mid = messageId.trim();
  if (!cid || !mid || !patch.content.trim()) return;

  const data = await loadFile(acc);
  const turns = [...(data.chats[cid] ?? [])];
  const idx = turns.findIndex((t) => t.messageId === mid && t.role === "user");
  if (idx < 0) {
    await appendTurn(acc, cid, {
      role: "user",
      content: patch.content.trim(),
      messageId: mid,
      timestamp: Date.now(),
      source: patch.source ?? "voice-transcript",
    });
    return;
  }
  turns[idx] = {
    ...turns[idx],
    content: patch.content.trim(),
    source: patch.source ?? turns[idx].source ?? "voice-transcript",
  };
  data.chats[cid] = turns;
  await saveFile(acc, data);
}

export async function getTurns(
  accountId: string,
  chatId: string,
  opts?: { limit?: number },
): Promise<ChatMemoryTurn[]> {
  const acc = normalizeAccountId(accountId);
  const cid = chatId.trim();
  if (!cid) return [];
  const data = await loadFile(acc);
  const turns = data.chats[cid] ?? [];
  const limit = opts?.limit;
  if (limit != null && limit > 0) return turns.slice(-limit);
  return [...turns];
}

export async function getAiThreadTurns(
  accountId: string,
  chatId: string,
  opts?: { limit?: number },
): Promise<AiThreadTurn[]> {
  const turns = await getTurns(accountId, chatId, opts);
  return turns
    .filter((t) => t.content.trim())
    .map((t) => ({ role: t.role, content: t.content.trim() }));
}

function rowContent(row: {
  body: string;
  transcript?: string;
  isFromMe: boolean;
  hasMedia?: boolean;
  type?: string;
}): string | null {
  const text = (row.transcript ?? row.body).trim();
  if (text) return text;
  if (isVoiceNoteMessage({ type: row.type, hasMedia: row.hasMedia ?? true })) {
    const side = row.isFromMe ? "You" : "Customer";
    return `${side} sent a voice message.`;
  }
  return null;
}

export async function getTranscriptForMessage(
  accountId: string,
  chatId: string,
  messageId: string,
): Promise<string | null> {
  const turns = await getTurns(accountId, chatId);
  const hit = turns.find(
    (t) => t.messageId === messageId && t.role === "user" && t.source === "voice-transcript",
  );
  const text = hit?.content?.trim();
  return text || null;
}

export async function seedFromHistory(
  accountId: string,
  chatId: string,
  rows: Array<{
    id: string;
    body: string;
    transcript?: string;
    timestamp: number;
    isFromMe: boolean;
    hasMedia?: boolean;
    type?: string;
  }>,
): Promise<void> {
  const acc = normalizeAccountId(accountId);
  const cid = chatId.trim();
  if (!cid || rows.length === 0) return;

  const data = await loadFile(acc);
  const byMsgId = new Map<string, ChatMemoryTurn>();
  for (const t of data.chats[cid] ?? []) {
    if (t.messageId) byMsgId.set(t.messageId, t);
  }

  const sorted = [...rows].sort((a, b) => a.timestamp - b.timestamp);
  for (const row of sorted) {
    const text = rowContent(row);
    if (!text) continue;
    const turn: ChatMemoryTurn = {
      role: row.isFromMe ? "assistant" : "user",
      content: text,
      messageId: row.id,
      timestamp: row.timestamp,
      source: row.transcript ? "voice-transcript" : row.body.trim() ? "text" : "media-placeholder",
    };
    const prev = byMsgId.get(row.id);
    if (!prev || row.transcript?.trim() || text.length >= prev.content.length) {
      byMsgId.set(row.id, turn);
    }
  }

  data.chats[cid] = trimTurns(
    [...byMsgId.values()].sort((a, b) => a.timestamp - b.timestamp),
    chatMemoryMaxTurns(),
  );
  await saveFile(acc, data);
}

export async function clearAccount(accountId: string): Promise<void> {
  const acc = normalizeAccountId(accountId);
  fileCache.delete(acc);
  try {
    await fs.unlink(memoryFilePath(acc));
  } catch {
    /* missing ok */
  }
}

export async function clearChat(accountId: string, chatId: string): Promise<void> {
  const acc = normalizeAccountId(accountId);
  const cid = chatId.trim();
  if (!cid) return;
  const data = await loadFile(acc);
  delete data.chats[cid];
  await saveFile(acc, data);
}
