import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import type { ChatReplyRoute } from "../ipc-contract";

type Root = { byAccount: Record<string, Record<string, ChatReplyRoute>> };

const empty: Root = { byAccount: {} };

function filePath(): string {
  return path.join(app.getPath("userData"), "chat-reply-routes.json");
}

let cache: Root = empty;
let loaded = false;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await readFile(filePath(), "utf8");
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === "object" && j !== null && "byAccount" in j) {
      const by = (j as { byAccount: unknown }).byAccount;
      if (by && typeof by === "object") cache = { byAccount: by as Root["byAccount"] };
    }
  } catch {
    cache = { byAccount: {} };
  }
}

export async function getChatReplyRoute(accountId: string, chatId: string): Promise<ChatReplyRoute | undefined> {
  await ensureLoaded();
  const a = accountId.trim() || "default";
  return cache.byAccount[a]?.[chatId];
}

export async function setChatReplyRoute(
  accountId: string,
  chatId: string,
  route: ChatReplyRoute,
): Promise<void> {
  await ensureLoaded();
  const a = accountId.trim() || "default";
  const cid = chatId.trim();
  if (!cid) return;
  if (!cache.byAccount[a]) cache.byAccount[a] = {};
  cache.byAccount[a][cid] = route;
  await writeFile(filePath(), JSON.stringify(cache), "utf8");
}

export async function getAllChatReplyRoutesForAccount(accountId: string): Promise<Record<string, ChatReplyRoute>> {
  await ensureLoaded();
  const a = accountId.trim() || "default";
  return { ...(cache.byAccount[a] ?? {}) };
}
