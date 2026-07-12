"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { DeskSidebar } from "@/components/layout/DeskSidebar";
import { DeskTopBar } from "@/components/layout/DeskTopBar";
import { WaConnectPanel } from "@/components/connect/WaConnectPanel";
import { ChatPane } from "@/components/inbox/ChatPane";
import type { DraftItem } from "@/components/inbox/DraftReviewDock";
import { DraftReviewDock, draftDockKey } from "@/components/inbox/DraftReviewDock";
import { InboxList } from "@/components/inbox/InboxList";
import { TrainingPanel } from "@/components/inbox/TrainingPanel";
import { PostConnectModal } from "@/components/onboarding/PostConnectModal";
import type { MainNavTab } from "@/components/premium/AppHeader";
import { ApiKeysView } from "@/components/setup/ApiKeysView";
import { BusinessView } from "@/components/setup/BusinessView";
import { CloudApiView } from "@/components/setup/CloudApiView";
import { useIsElectron } from "@/hooks/use-desktop";
import { useI18n } from "@/i18n/I18nContext";
import { formatWaChatId } from "@/lib/format-wa-id";
import type {
  ChatReplyRoute,
  ReplyMode,
  WaChatRow,
  WaChatsSyncPayload,
  WaInboundPayload,
  WaMessageUpdatePayload,
  WaStatusPayload,
  WaVoiceQueueItem,
} from "../../../electron/ipc-contract";
import { defaultDeskAccounts, normalizeDeskAccountsState, type DeskAccountsState, type DeskAccountSlot } from "../../../shared/desk-accounts";

type MessagesByChat = Record<string, WaInboundPayload[]>;

function flattenMessagesByChat(byChat: MessagesByChat): WaInboundPayload[] {
  return Object.values(byChat)
    .flat()
    .sort((a, b) => a.timestamp - b.timestamp);
}

function mergeChatHistoryIntoByChat(
  prev: MessagesByChat,
  chatId: string,
  fetched: WaInboundPayload[],
): MessagesByChat {
  const liveSame = prev[chatId] ?? [];
  const byId = new Map<string, WaInboundPayload>();
  for (const m of fetched) byId.set(m.id, m);
  for (const m of liveSame) {
    const existing = byId.get(m.id);
    if (!existing) {
      byId.set(m.id, m);
      continue;
    }
    byId.set(m.id, {
      ...existing,
      transcript: m.transcript ?? existing.transcript,
      voiceDurationSec: m.voiceDurationSec ?? existing.voiceDurationSec,
      body: existing.body?.trim() ? existing.body : m.body,
    });
  }
  return {
    ...prev,
    [chatId]: [...byId.values()].sort((a, b) => a.timestamp - b.timestamp),
  };
}

function upsertInboundByChat(prev: MessagesByChat, m: WaInboundPayload): MessagesByChat {
  const list = prev[m.chatId] ?? [];
  if (list.some((x) => x.id === m.id)) return prev;
  return { ...prev, [m.chatId]: [...list, m] };
}

function patchMessageByChat(prev: MessagesByChat, u: WaMessageUpdatePayload): MessagesByChat {
  const list = prev[u.chatId];
  if (!list) return prev;
  return {
    ...prev,
    [u.chatId]: list.map((m) =>
      m.id === u.id
        ? {
            ...m,
            transcript: u.transcript ?? m.transcript,
            voiceDurationSec: u.voiceDurationSec ?? m.voiceDurationSec,
            body: u.transcript?.trim() ? "" : m.body,
          }
        : m,
    ),
  };
}

export default function DashboardPage() {
  const { t } = useI18n();
  const isElectron = useIsElectron();
  const [browserPreview, setBrowserPreview] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setBrowserPreview(!window.desktop);
  }, []);
  const [mainNav, setMainNav] = React.useState<MainNavTab>("inbox");
  const [replyMode, setReplyMode] = React.useState<ReplyMode>("paused");
  const [accountId, setAccountId] = React.useState("default");
  const [deskAccounts, setDeskAccounts] = React.useState<DeskAccountsState>(() => defaultDeskAccounts());
  const [status, setStatus] = React.useState<string>("idle");
  const [waStatusByAccount, setWaStatusByAccount] = React.useState<Record<string, string>>({});
  const [messagesByChat, setMessagesByChat] = React.useState<MessagesByChat>({});
  const messages = React.useMemo(() => flattenMessagesByChat(messagesByChat), [messagesByChat]);
  const [chatSummaries, setChatSummaries] = React.useState<WaChatRow[]>([]);
  const [lastSyncTotal, setLastSyncTotal] = React.useState<number | null>(null);
  const [syncingChats, setSyncingChats] = React.useState(false);
  const [syncingThread, setSyncingThread] = React.useState(false);
  const [voiceQueueItems, setVoiceQueueItems] = React.useState<WaVoiceQueueItem[]>([]);
  const [selectedChatId, setSelectedChatId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [unreadOnly, setUnreadOnly] = React.useState(false);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const [pairingCode, setPairingCode] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<DraftItem[]>([]);
  const [postConnectOpen, setPostConnectOpen] = React.useState(false);
  const [postConnectStep, setPostConnectStep] = React.useState<1 | 2>(1);
  const [chatReplyRoutes, setChatReplyRoutes] = React.useState<Record<string, ChatReplyRoute>>({});

  const accountIdRef = React.useRef(accountId);
  const deskAccountsRef = React.useRef(deskAccounts);
  deskAccountsRef.current = deskAccounts;
  const statusPhaseByAccountRef = React.useRef<Record<string, string>>({});
  const prevSelectedChatRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    accountIdRef.current = accountId;
  }, [accountId]);

  React.useEffect(() => {
    if (!isElectron || !window.desktop) return;
    void window.desktop.deskAccounts.load().then((d) => {
      setDeskAccounts(d);
      setAccountId(d.activeId);
    });
  }, [isElectron]);

  React.useEffect(() => {
    const id = accountId.trim() || "default";
    setStatus(waStatusByAccount[id] ?? "idle");
  }, [accountId, waStatusByAccount]);

  React.useEffect(() => {
    setQrDataUrl(null);
    setPairingCode(null);
  }, [accountId]);

  React.useEffect(() => {
    setMessagesByChat({});
    setChatSummaries([]);
    setLastSyncTotal(null);
    setSelectedChatId(null);
    prevSelectedChatRef.current = null;
    setPostConnectOpen(false);
    setVoiceQueueItems([]);
  }, [accountId]);

  React.useEffect(() => {
    if (!isElectron || !window.desktop || !selectedChatId) return;
    let cancelled = false;
    const acc = accountId.trim() || "default";
    void (async () => {
      const r = await window.desktop!.wa.fetchChatHistory(acc, selectedChatId);
      if (cancelled) return;
      if (!r.ok) return;
      setMessagesByChat((prev) => mergeChatHistoryIntoByChat(prev, selectedChatId, r.messages));
      void window.desktop!.wa.seedChatMemory(acc, selectedChatId);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedChatId, accountId, isElectron]);

  React.useEffect(() => {
    if (!isElectron || !window.desktop) return;
    const acc = accountId.trim() || "default";
    void window.desktop.wa.getChatReplyRoutes(acc).then(setChatReplyRoutes);
  }, [isElectron, accountId]);

  /** Clear linked WhatsApp Web compose for the chat we are leaving so drafts do not stick across chats. */
  React.useEffect(() => {
    if (!isElectron || !window.desktop) return;
    const acc = accountId.trim() || "default";
    const prev = prevSelectedChatRef.current;
    prevSelectedChatRef.current = selectedChatId;
    if (prev && prev !== selectedChatId) {
      void window.desktop.wa.clearLinkedComposeDraft(acc, prev);
    }
  }, [selectedChatId, accountId, isElectron]);

  React.useEffect(() => {
    if (!isElectron || !window.desktop) return;

    const offQr = window.desktop.wa.onQr(async (p) => {
      if (p.accountId !== accountIdRef.current.trim()) return;
      setPairingCode(null);
      const QRCode = (await import("qrcode")).default;
      const url = await QRCode.toDataURL(p.qr, { margin: 1, width: 280 });
      setQrDataUrl(url);
    });

    const offCode = window.desktop.wa.onPairingCode((p) => {
      if (p.accountId !== accountIdRef.current.trim()) return;
      setQrDataUrl(null);
      setPairingCode(p.code);
    });

    const offStatus = window.desktop.wa.onStatus((s: WaStatusPayload) => {
      const accNorm = (s.accountId ?? "").trim() || "default";
      const line = `${s.state}${s.detail ? ` · ${s.detail}` : ""}`;
      setWaStatusByAccount((prev) => ({ ...prev, [accNorm]: line }));

      const prevPhase = statusPhaseByAccountRef.current[accNorm] ?? "";
      statusPhaseByAccountRef.current[accNorm] = s.state;

      const activeNorm = accountIdRef.current.trim() || "default";
      if (accNorm !== activeNorm) return;

      setStatus(line);

      if (s.state === "disconnected") {
        setPostConnectOpen(false);
        setMessagesByChat({});
        setChatSummaries([]);
        setLastSyncTotal(null);
        setVoiceQueueItems([]);
        return;
      }

      if (s.state === "ready" && prevPhase !== "ready") {
        setReplyMode("paused");
        setPostConnectOpen(true);
        setPostConnectStep(1);
        setMainNav("inbox");
        void refreshChats();
      }

      if (s.state === "qr") {
        setPairingCode(null);
        return;
      }
      if (s.state === "pairing") {
        setQrDataUrl(null);
        return;
      }
      if (s.state === "initializing") return;
      setQrDataUrl(null);
      setPairingCode(null);
    });

    const offMsg = window.desktop.wa.onMessage((m) => {
      if (m.accountId !== accountIdRef.current.trim()) return;
      setMessagesByChat((prev) => upsertInboundByChat(prev, m));
      setChatSummaries((prev) => {
        const idx = prev.findIndex((r) => r.chatId === m.chatId);
        const preview = (m.transcript ?? m.body).trim() || (m.hasMedia ? "Media" : "…");
        if (idx >= 0) {
          return prev.map((r, i) => {
            if (i !== idx) return r;
            const lastAt = Math.max(r.lastAt, m.timestamp);
            if (m.isFromMe) {
              return { ...r, lastAt };
            }
            const previewNext = m.timestamp >= r.lastAt ? preview : r.preview;
            return { ...r, lastAt, preview: previewNext, unread: r.unread + 1 };
          });
        }
        return [
          ...prev,
          {
            chatId: m.chatId,
            title: formatWaChatId(m.chatId),
            preview,
            lastAt: m.timestamp,
            unread: m.isFromMe ? 0 : 1,
            isGroup: m.chatId.endsWith("@g.us"),
          },
        ];
      });
      if ("Notification" in window && Notification.permission === "granted" && !m.isFromMe) {
        new Notification("WhatsApp", { body: (m.transcript ?? m.body).slice(0, 120) || "New message" });
      }
    });

    const offMsgUpdate = window.desktop.wa.onMessageUpdate((u) => {
      if (u.accountId !== accountIdRef.current.trim()) return;
      setMessagesByChat((prev) => patchMessageByChat(prev, u));
      if (u.transcript?.trim()) {
        setChatSummaries((prev) =>
          prev.map((r) =>
            r.chatId === u.chatId ? { ...r, preview: u.transcript!.trim().slice(0, 80) } : r,
          ),
        );
      }
    });

    const offVoiceQueue = window.desktop.wa.onVoiceQueue((q) => {
      if (q.accountId !== accountIdRef.current.trim()) return;
      setVoiceQueueItems(q.items);
    });

    const offDraft = window.desktop.wa.onDraftReply((d) => {
      setDrafts((prev) => {
        const k = draftDockKey(d);
        const next = prev.filter((x) => draftDockKey(x) !== k);
        next.push({ ...d, localText: d.suggestedText });
        return next;
      });
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(t("draft.notifyTitle"), { body: t("draft.notifyBody") });
      }
    });

    const offChatsSync = window.desktop.wa.onChatsSync((p: WaChatsSyncPayload) => {
      if (p.accountId !== accountIdRef.current.trim()) return;
      setChatSummaries(p.chats);
      setLastSyncTotal(p.totalFetched);
    });

    return () => {
      offQr();
      offCode();
      offStatus();
      offMsg();
      offMsgUpdate();
      offVoiceQueue();
      offDraft();
      offChatsSync();
    };
  }, [isElectron, t]);

  async function refreshThread() {
    if (!window.desktop || !selectedChatId) return;
    setSyncingThread(true);
    try {
      const acc = accountId.trim() || "default";
      const r = await window.desktop.wa.fetchChatHistory(acc, selectedChatId);
      if (r.ok) {
        setMessagesByChat((prev) => mergeChatHistoryIntoByChat(prev, selectedChatId, r.messages));
        void window.desktop.wa.seedChatMemory(acc, selectedChatId);
      }
    } finally {
      setSyncingThread(false);
    }
  }

  async function refreshChats() {
    if (!window.desktop) return;
    setSyncingChats(true);
    try {
      await window.desktop.wa.syncChats(accountId.trim() || "default");
    } finally {
      setSyncingChats(false);
    }
  }

  async function updateChatReplyRoute(chatId: string, route: ChatReplyRoute) {
    if (!window.desktop) return;
    const acc = accountId.trim() || "default";
    await window.desktop.wa.setChatReplyRoute(acc, chatId, route);
    setChatReplyRoutes((prev) => ({ ...prev, [chatId]: route }));
  }

  function updateDraftText(key: string, text: string) {
    setDrafts((prev) => prev.map((d) => (draftDockKey(d) === key ? { ...d, localText: text } : d)));
  }

  async function sendDraft(d: DraftItem) {
    if (!window.desktop) return;
    const res = await window.desktop.wa.sendText(d.accountId, d.chatId, d.localText.trim());
    if (res.ok) {
      setDrafts((prev) => prev.filter((x) => draftDockKey(x) !== draftDockKey(d)));
    }
  }

  const selectDeskAccount = React.useCallback((id: string) => {
    setAccountId(id);
    setDeskAccounts((prev) => {
      const next = normalizeDeskAccountsState({ ...prev, activeId: id });
      if (typeof window !== "undefined" && window.desktop) {
        void window.desktop.deskAccounts.save(next);
      }
      return next;
    });
  }, []);

  async function saveDeskSlots(slots: DeskAccountSlot[]) {
    if (!window.desktop) return;
    const prev = deskAccountsRef.current;
    const candidate = normalizeDeskAccountsState({ slots, activeId: prev.activeId });
    const r = await window.desktop.deskAccounts.save(candidate);
    if (!r.ok) return;
    const loaded = await window.desktop.deskAccounts.load();
    setDeskAccounts(loaded);
    setAccountId(loaded.activeId);
  }

  const selectedChatTitle = React.useMemo(() => {
    if (!selectedChatId) return null;
    const row = chatSummaries.find((r) => r.chatId === selectedChatId);
    if (row?.title?.trim()) return row.title.trim();
    return formatWaChatId(selectedChatId);
  }, [selectedChatId, chatSummaries]);

  return (
    <div className="flex h-screen min-h-0 bg-transparent">
      <DeskSidebar mainNav={mainNav} setMainNav={setMainNav} />

      <div className="flex min-w-0 flex-1 flex-col">
        <DeskTopBar
          replyMode={replyMode}
          setReplyMode={setReplyMode}
          deskSlots={deskAccounts.slots}
          activeDeskAccountId={accountId.trim() || "default"}
          onSelectDeskAccount={selectDeskAccount}
          activeSessionLine={status}
          isElectron={isElectron}
        />

        {browserPreview ? (
          <div
            role="status"
            className="shrink-0 border-b border-amber-500/25 bg-amber-500/[0.08] px-4 py-2.5 text-center text-xs leading-snug text-amber-100/95 sm:text-sm"
          >
            {t("preview.browserOnly")}{" "}
            <a href="/home" className="font-semibold text-white underline-offset-2 hover:underline">
              {t("nav.home")}
            </a>
          </div>
        ) : null}

        <main id="main-content" className="relative min-h-0 flex-1 overflow-hidden" tabIndex={-1}>
          {mainNav === "inbox" && (
            <AppShell
              list={
                <InboxList
                summaries={chatSummaries}
                messages={messages}
                selectedChatId={selectedChatId}
                onSelect={setSelectedChatId}
                query={query}
                onQueryChange={setQuery}
                unreadOnly={unreadOnly}
                onUnreadOnlyChange={setUnreadOnly}
                labels={{
                  search: t("inbox.search"),
                  unread: t("inbox.unread"),
                  empty: t("inbox.empty"),
                  refresh: t("inbox.refresh"),
                  syncing: t("inbox.syncing"),
                  synced: t("inbox.chatsSynced"),
                  selectiveHint: t("inbox.selectiveHint"),
                  routeAuto: t("inbox.routeAuto"),
                  routeDraft: t("inbox.routeDraft"),
                  routeOff: t("inbox.routeOff"),
                  routeColumn: t("inbox.routeColumn"),
                }}
                replyMode={replyMode}
                chatReplyRoutes={chatReplyRoutes}
                onChatReplyRouteChange={(cid, route) => void updateChatReplyRoute(cid, route)}
                onRefreshChats={isElectron ? () => void refreshChats() : undefined}
                syncingChats={syncingChats}
                lastSyncTotal={lastSyncTotal}
              />
            }
            detail={
              <ChatPane
                accountId={accountId.trim() || "default"}
                chatId={selectedChatId}
                chatTitle={selectedChatTitle}
                messages={messages}
                isElectron={isElectron}
                replyMode={replyMode}
                onSyncThread={isElectron ? () => void refreshThread() : undefined}
                syncingThread={syncingThread}
                voiceQueueItems={voiceQueueItems}
                t={t}
              />
            }
          />
        )}

        {mainNav === "connect" && (
          <div className="desk-page-scroll h-full overflow-y-auto px-6 py-6">
            <WaConnectPanel
              accountId={accountId}
              onAccountIdChange={selectDeskAccount}
              deskSlots={deskAccounts.slots}
              onSaveDeskSlots={(slots) => void saveDeskSlots(slots)}
              isElectron={isElectron}
              qrDataUrl={qrDataUrl}
              pairingCode={pairingCode}
              status={status}
              t={t}
            />
          </div>
        )}

        {mainNav === "keys" && (
          <div className="desk-page-scroll h-full overflow-y-auto px-6 py-6">
            <ApiKeysView isElectron={isElectron} />
          </div>
        )}

        {mainNav === "business" && (
          <div className="desk-page-scroll h-full overflow-y-auto px-6 py-6">
            <BusinessView isElectron={isElectron} />
          </div>
        )}

        {mainNav === "cloud" && (
          <div className="desk-page-scroll h-full overflow-y-auto px-6 py-6">
            <CloudApiView isElectron={isElectron} />
          </div>
        )}

        {mainNav === "training" && (
          <div className="desk-page-scroll h-full overflow-y-auto px-6 py-6">
            <TrainingPanel isElectron={isElectron} />
          </div>
        )}

        <PostConnectModal
          open={postConnectOpen}
          step={postConnectStep}
          setStep={setPostConnectStep}
          onSelectReplyMode={(m) => {
            setReplyMode(m);
            if (window.desktop) {
              void window.desktop.wa.setReplyMode(accountIdRef.current.trim() || "default", m, true);
            }
          }}
          onClose={() => setPostConnectOpen(false)}
          t={t}
        />
      </main>

      <DraftReviewDock
        drafts={drafts}
        isElectron={isElectron}
        t={t}
        onChangeText={updateDraftText}
        onSend={(d) => void sendDraft(d)}
        onDiscard={(k) => setDrafts((prev) => prev.filter((d) => draftDockKey(d) !== k))}
      />
      </div>
    </div>
  );
}
