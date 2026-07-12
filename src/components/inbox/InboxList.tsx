"use client";

import { useMemo } from "react";
import type { ChatReplyRoute, ReplyMode, WaChatRow, WaInboundPayload } from "../../../electron/ipc-contract";
import { formatRelativeTime } from "@/lib/format-time";
import { formatWaChatId, threadInitials } from "@/lib/format-wa-id";

export type InboxThread = {
  chatId: string;
  title: string;
  preview: string;
  lastAt: number;
  unread: number;
  isGroup?: boolean;
};

function mergeThreads(summaries: WaChatRow[], messages: WaInboundPayload[]): InboxThread[] {
  const map = new Map<string, InboxThread>();

  for (const s of summaries) {
    map.set(s.chatId, {
      chatId: s.chatId,
      title: (s.title && s.title.trim()) || formatWaChatId(s.chatId),
      preview: s.preview,
      lastAt: s.lastAt,
      unread: typeof s.unread === "number" ? s.unread : 0,
      isGroup: s.isGroup,
    });
  }

  const lastMsgByChat = new Map<string, WaInboundPayload>();
  for (const m of messages) {
    const cur = lastMsgByChat.get(m.chatId);
    if (!cur || m.timestamp >= cur.timestamp) lastMsgByChat.set(m.chatId, m);
  }

  for (const [chatId, last] of lastMsgByChat) {
    const preview =
      (last.transcript ?? last.body).trim() || (last.hasMedia ? "Media" : "…");
    const row = map.get(chatId);
    if (!row) {
      map.set(chatId, {
        chatId,
        title: formatWaChatId(chatId),
        preview,
        lastAt: last.timestamp,
        unread: last.isFromMe ? 0 : 1,
        isGroup: chatId.endsWith("@g.us"),
      });
      continue;
    }
    if (last.timestamp >= row.lastAt) {
      map.set(chatId, {
        ...row,
        preview,
        lastAt: last.timestamp,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.lastAt - a.lastAt);
}

export function InboxList({
  summaries,
  messages,
  selectedChatId,
  onSelect,
  query,
  onQueryChange,
  unreadOnly,
  onUnreadOnlyChange,
  labels,
  onRefreshChats,
  syncingChats,
  lastSyncTotal,
  replyMode = "auto",
  chatReplyRoutes = {},
  onChatReplyRouteChange,
}: {
  summaries: WaChatRow[];
  messages: WaInboundPayload[];
  selectedChatId: string | null;
  onSelect: (chatId: string) => void;
  query: string;
  onQueryChange: (v: string) => void;
  unreadOnly: boolean;
  onUnreadOnlyChange: (v: boolean) => void;
  labels: {
    search: string;
    unread: string;
    empty: string;
    refresh: string;
    syncing: string;
    synced: string;
    selectiveHint: string;
    routeAuto: string;
    routeDraft: string;
    routeOff: string;
    routeColumn: string;
  };
  onRefreshChats?: () => void;
  syncingChats: boolean;
  lastSyncTotal: number | null;
  replyMode?: ReplyMode;
  chatReplyRoutes?: Record<string, ChatReplyRoute>;
  onChatReplyRouteChange?: (chatId: string, route: ChatReplyRoute) => void;
}) {
  const threads = useMemo(() => mergeThreads(summaries, messages), [summaries, messages]);

  const filtered = threads.filter((row) => {
    if (unreadOnly && row.unread === 0) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      row.chatId.toLowerCase().includes(q) ||
      row.title.toLowerCase().includes(q) ||
      row.preview.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/5 p-3">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={labels.search}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2"
          />
          {onRefreshChats && (
            <button
              type="button"
              title={labels.refresh}
              disabled={syncingChats}
              onClick={onRefreshChats}
              className="shrink-0 rounded-lg border border-white/10 px-2.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/[0.06] disabled:opacity-40"
            >
              {syncingChats ? labels.syncing : "↻"}
            </button>
          )}
        </div>
        {lastSyncTotal != null && lastSyncTotal > 0 && (
          <p className="mt-1.5 text-[10px] text-zinc-500">
            {threads.length} / {lastSyncTotal} {labels.synced}
          </p>
        )}
        <label className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => onUnreadOnlyChange(e.target.checked)}
            className="accent-accent"
          />
          {labels.unread}
        </label>
        {replyMode === "selective" && (
          <p className="mt-2 text-[10px] leading-snug text-cyan-200/80">{labels.selectiveHint}</p>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-zinc-500">{labels.empty}</div>
        )}
        {filtered.map((row) => {
          const route = chatReplyRoutes[row.chatId] ?? "off";
          const showRoutes = replyMode === "selective" && !!onChatReplyRouteChange;
          return (
            <div
              key={row.chatId}
              className={`flex border-b border-white/5 transition hover:bg-white/[0.03] ${
                selectedChatId === row.chatId ? "bg-white/[0.05]" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(row.chatId)}
                className="flex min-w-0 flex-1 gap-3 px-3 py-3 text-left"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-200"
                  aria-hidden
                >
                  {threadInitials(row.title)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate text-sm font-semibold text-white">{row.title}</div>
                    <span className="shrink-0 text-[10px] text-zinc-500">{formatRelativeTime(row.lastAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate text-xs text-zinc-400">{row.preview}</div>
                    {row.unread > 0 && (
                      <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-black">
                        {row.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
              {showRoutes && (
                <div className="flex shrink-0 items-center border-l border-white/[0.06] px-2">
                  <select
                    value={route}
                    title={labels.selectiveHint}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => {
                      const v = e.target.value as ChatReplyRoute;
                      onChatReplyRouteChange(row.chatId, v);
                    }}
                    className="max-w-[4.5rem] cursor-pointer rounded-md border border-white/10 bg-black/50 py-1 pl-1 pr-5 text-[10px] text-zinc-200 outline-none"
                  >
                    <option value="off">{labels.routeOff}</option>
                    <option value="draft">{labels.routeDraft}</option>
                    <option value="auto">{labels.routeAuto}</option>
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
