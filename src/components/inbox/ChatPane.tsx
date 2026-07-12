"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AIReplyResponse, AppCapabilities, ReplyMode, Tone, WaInboundPayload, WaVoiceQueueItem } from "../../../electron/ipc-contract";
import { isVoiceNoteMessage } from "../../../shared/wa-voice-note";
import { HelpIconModal, HintIconButton } from "./HelpIconModal";
import { VoiceNoteBubble } from "./VoiceNoteBubble";

function selectedSuggestBody(s: AIReplyResponse, variantIdx: number): string {
  if (s.variants && s.variants.length >= 2) {
    return (s.variants[variantIdx]?.text ?? s.text).trim();
  }
  return s.text.trim();
}


export function ChatPane({
  accountId,
  chatId,
  chatTitle,
  messages,
  isElectron,
  replyMode,
  onSyncThread,
  syncingThread,
  voiceQueueItems = [],
  t,
}: {
  accountId: string;
  chatId: string | null;
  chatTitle?: string | null;
  messages: WaInboundPayload[];
  isElectron: boolean;
  replyMode: ReplyMode;
  onSyncThread?: () => void;
  syncingThread?: boolean;
  voiceQueueItems?: WaVoiceQueueItem[];
  t: (key: string) => string;
}) {
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [composer, setComposer] = useState("");
  const [tone, setTone] = useState<Tone>("friendly");
  const [suggestion, setSuggestion] = useState<AIReplyResponse | null>(null);
  const [suggestionForMessageId, setSuggestionForMessageId] = useState<string | null>(null);
  const [suggestionHeardText, setSuggestionHeardText] = useState<string | null>(null);
  const [refineOpen, setRefineOpen] = useState(false);
  const [suggestVariantIdx, setSuggestVariantIdx] = useState(0);
  const [refineNotes, setRefineNotes] = useState("");
  const [caps, setCaps] = useState<AppCapabilities | null>(null);
  const [mediaPrompt, setMediaPrompt] = useState("");
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaErr, setMediaErr] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<{
    base64: string;
    mimeType: string;
    style: "image" | "sticker";
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [mediaPanelOpen, setMediaPanelOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [modeHintOpen, setModeHintOpen] = useState<null | "draft" | "selective" | "paused">(null);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const prevCombinedErrorRef = useRef<string | null>(null);
  const threadScrollRef = useRef<HTMLDivElement>(null);
  const suggestionAnchorRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordMimeRef = useRef<string>("audio/webm");
  const voiceTargetRef = useRef<{ accountId: string; chatId: string } | null>(null);

  const thread = useMemo(() => {
    if (!chatId) return [];
    return messages.filter((m) => m.chatId === chatId).sort((a, b) => a.timestamp - b.timestamp);
  }, [messages, chatId]);

  const voiceQueueForChat = useMemo(() => {
    if (!chatId) return [];
    return voiceQueueItems.filter((i) => i.chatId === chatId);
  }, [voiceQueueItems, chatId]);

  const voiceQueueLabel = useMemo(() => {
    if (voiceQueueForChat.length === 0) return null;
    const active = voiceQueueForChat.filter((i) => i.status === "active").length;
    const queued = voiceQueueForChat.filter((i) => i.status === "queued").length;
    const parts: string[] = [];
    if (active > 0) parts.push(`${active} ${t("chat.voiceQueueActive")}`);
    if (queued > 0) parts.push(`${queued} ${t("chat.voiceQueuePending")}`);
    return parts.join(" · ");
  }, [voiceQueueForChat, t]);

  const voiceQueueMessageIds = useMemo(
    () => new Set(voiceQueueForChat.map((i) => i.messageId)),
    [voiceQueueForChat],
  );

  useEffect(() => {
    setSendError(null);
    setPendingMedia(null);
    setMediaErr(null);
    setComposer("");
    setSuggestion(null);
    setSuggestionForMessageId(null);
    setSuggestionHeardText(null);
    setRefineOpen(false);
    setSuggestVariantIdx(0);
    setRefineNotes("");
    setMediaPrompt("");
    setBusy(false);
    setMediaPanelOpen(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
    recordChunksRef.current = [];
    setRecording(false);
    voiceTargetRef.current = null;
  }, [chatId]);

  useEffect(() => {
    if (!isElectron || !window.desktop) {
      setCaps(null);
      return;
    }
    void window.desktop.app.getCapabilities().then(setCaps);
  }, [isElectron]);

  useEffect(() => {
    setSuggestVariantIdx(0);
    setRefineNotes("");
  }, [suggestion]);

  useEffect(() => {
    if (!suggestion && !busy) return;
    const el = suggestionAnchorRef.current;
    if (!el) return;
    const timer = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [suggestion, suggestionForMessageId, busy]);

  const combinedError = sendError ?? mediaErr ?? null;

  useEffect(() => {
    if (!combinedError) {
      prevCombinedErrorRef.current = null;
      setErrorModalOpen(false);
      return;
    }
    if (prevCombinedErrorRef.current !== combinedError) {
      prevCombinedErrorRef.current = combinedError;
      setErrorModalOpen(true);
    }
  }, [combinedError]);

  async function getRecentForAi(
    anchorMessageId: string,
    anchor?: WaInboundPayload,
  ): Promise<{
    turns: { role: "user" | "assistant"; content: string }[];
    lastCustomerText?: string;
    voiceSttMissing?: boolean;
    error?: string;
  }> {
    if (!isElectron || !window.desktop || !chatId) return { turns: [] };
    const cachedTranscript = anchor?.transcript?.trim();
    const loaded = await window.desktop.wa.fetchAiThread(accountId, chatId, anchorMessageId, {
      cachedTranscript: cachedTranscript || undefined,
      anchorTimestampMs: anchor?.timestamp,
    });
    if (!loaded.ok) {
      return { turns: [], error: loaded.error };
    }
    return {
      turns: loaded.messages.filter((m) => m.content.trim().length > 0),
      lastCustomerText: loaded.lastCustomerText,
      voiceSttMissing: loaded.voiceSttMissing,
    };
  }

  async function runSuggestForMessage(messageId: string, clearPanel: boolean) {
    if (!isElectron || !window.desktop || !chatId) return;
    const anchor = thread.find((m) => m.id === messageId);
    if (!anchor || anchor.isFromMe) return;
    if (clearPanel) {
      setSuggestion(null);
      setSuggestionHeardText(null);
    }
    setSuggestionForMessageId(messageId);
    setBusy(true);
    setSendError(null);
    try {
      const ctx = await getRecentForAi(messageId, anchor);
      if (ctx.error) {
        setSendError(ctx.error);
        setSuggestion(null);
        setSuggestionHeardText(null);
        return;
      }
      if (ctx.turns.length === 0 || !ctx.lastCustomerText?.trim()) {
        setSendError(t("chat.suggestNoContext"));
        setSuggestion(null);
        return;
      }
      setSuggestionHeardText(ctx.lastCustomerText.trim());
      const training = await window.desktop.training.load();
      const trainingText = await window.desktop.training.toPrompt(training);
      const res = await window.desktop.ai.generateReply({
        accountId,
        chatId,
        tone,
        messages: ctx.turns,
        training: trainingText,
        multiSuggest: true,
        chatSurface: chatId.endsWith("@g.us") ? "group" : "direct",
        voiceSttMissing: ctx.voiceSttMissing,
        lastCustomerText: ctx.lastCustomerText,
      });
      setSuggestion(res);
    } finally {
      setBusy(false);
    }
  }

  async function runRefine() {
    if (!isElectron || !window.desktop || !chatId || !suggestion || !suggestionForMessageId) return;
    const instruction = refineNotes.trim();
    if (!instruction) return;
    const seed = selectedSuggestBody(suggestion, suggestVariantIdx);
    if (!seed) return;
    setBusy(true);
    try {
      const ctx = await getRecentForAi(suggestionForMessageId, thread.find((m) => m.id === suggestionForMessageId));
      const training = await window.desktop.training.load();
      const trainingText = await window.desktop.training.toPrompt(training);
      const res = await window.desktop.ai.generateReply({
        accountId,
        chatId,
        tone,
        messages: ctx.turns,
        training: trainingText,
        multiSuggest: false,
        seedReply: seed,
        refinement: instruction,
        chatSurface: chatId.endsWith("@g.us") ? "group" : "direct",
        lastCustomerText: ctx.lastCustomerText,
        voiceSttMissing: ctx.voiceSttMissing,
      });
      setSuggestion(res);
      setRefineNotes("");
    } finally {
      setBusy(false);
    }
  }

  const premiumUnlocked = caps?.premiumMedia === true;

  const scrollThread = useCallback((dir: 1 | -1) => {
    const el = threadScrollRef.current;
    if (!el) return;
    const step = Math.min(380, Math.max(120, Math.floor(el.clientHeight * 0.82)));
    el.scrollBy({ top: step * dir, behavior: "smooth" });
  }, []);

  async function stopRecorderAndSend(blob: Blob, mime: string) {
    if (!isElectron || !window.desktop) return;
    const tgt = voiceTargetRef.current;
    if (!tgt?.chatId) return;
    setSendError(null);
    const reader = new FileReader();
    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onerror = () => reject(new Error("read failed"));
      reader.onload = () => {
        const s = String(reader.result ?? "");
        const i = s.indexOf(",");
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      reader.readAsDataURL(blob);
    });
    const res = await window.desktop.wa.sendMediaB64({
      accountId: tgt.accountId,
      chatId: tgt.chatId,
      base64,
      mimeType: mime || blob.type || "audio/webm",
      asSticker: false,
      sendAsVoice: true,
    });
    if (!res.ok) setSendError(res.error ?? t("chat.voiceSendFailed"));
  }

  async function toggleVoiceRecording() {
    if (!isElectron || !window.desktop || !chatId) return;
    setSendError(null);
    if (recording && mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        setRecording(false);
      }
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setSendError(t("chat.micUnsupported"));
      return;
    }
    voiceTargetRef.current = { accountId, chatId: chatId! };
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordChunksRef.current = [];
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];
      const mime = candidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? "audio/webm";
      recordMimeRef.current = mime;
      const mr = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      mr.onerror = () => {
        setRecording(false);
        setSendError(t("chat.recordError"));
        stream.getTracks().forEach((tr) => tr.stop());
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setRecording(false);
        mediaRecorderRef.current = null;
        const blob = new Blob(recordChunksRef.current, { type: recordMimeRef.current });
        recordChunksRef.current = [];
        if (blob.size < 80) return;
        await stopRecorderAndSend(blob, recordMimeRef.current);
      };
      mr.start(200);
      setRecording(true);
    } catch {
      setSendError(t("chat.micDenied"));
    }
  }

  async function runGenerateMedia(style: "image" | "sticker") {
    if (!isElectron || !window.desktop || !chatId || !mediaPrompt.trim()) return;
    setMediaErr(null);
    setPendingMedia(null);
    setMediaBusy(true);
    try {
      const r = await window.desktop.ai.generateXaiImage({ prompt: mediaPrompt, style });
      if (r.ok) setPendingMedia({ base64: r.base64, mimeType: r.mimeType, style });
      else setMediaErr(r.error);
    } finally {
      setMediaBusy(false);
    }
  }

  async function sendPendingMediaToChat() {
    if (!isElectron || !window.desktop || !chatId || !pendingMedia) return;
    setMediaErr(null);
    setMediaBusy(true);
    try {
      const r = await window.desktop.wa.sendMediaB64({
        accountId,
        chatId,
        base64: pendingMedia.base64,
        mimeType: pendingMedia.mimeType,
        asSticker: pendingMedia.style === "sticker",
      });
      if (r.ok) {
        setPendingMedia(null);
        setMediaPrompt("");
        setMediaPanelOpen(false);
      } else {
        setMediaErr(r.error ?? t("premium.sendFailed"));
      }
    } finally {
      setMediaBusy(false);
    }
  }

  async function onSendManual() {
    if (!isElectron || !window.desktop || !chatId || !composer.trim()) return;
    setSendError(null);
    const res = await window.desktop.wa.sendText(accountId, chatId, composer.trim());
    if (res.ok) {
      setComposer("");
      setSendError(null);
    } else {
      setSendError(res.error ?? "Could not send message.");
    }
  }

  function renderSuggestionPanel() {
    if (!suggestion) return null;
    return (
      <div
        ref={suggestionAnchorRef}
        className="flex justify-start"
      >
        <div className="relative max-h-[min(36vh,320px)] w-full max-w-[88%] overflow-y-auto rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-950/40 to-black/50 px-3 py-2.5 shadow-lg shadow-violet-950/30">
          <button
            type="button"
            onClick={() => {
              setSuggestion(null);
              setSuggestionForMessageId(null);
              setSuggestionHeardText(null);
            }}
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg text-lg leading-none text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
            aria-label={t("chat.closeSuggest")}
          >
            ×
          </button>
          <div className="pr-8 text-[11px] font-medium text-violet-200/80">
            {t("chat.suggest")} · {suggestion.provider}
            {suggestion.model ? ` · ${suggestion.model}` : ""}
          </div>
          {suggestionHeardText ? (
            <div className="mt-1.5 rounded-lg border border-emerald-500/25 bg-emerald-950/25 px-2 py-1.5 text-[11px] leading-snug text-emerald-100/95">
              <span className="font-semibold text-emerald-200/90">{t("chat.suggestHeard")}</span> {suggestionHeardText}
            </div>
          ) : null}
          {suggestion.variants && suggestion.variants.length >= 2 ? (
            <>
              <div className="mt-1.5 text-[10px] leading-snug text-zinc-500">{t("chat.multiSuggestHint")}</div>
              <div className="mt-1.5 text-[11px] font-medium text-zinc-400">{t("chat.pickReply")}</div>
              <div className="mt-1 flex flex-col gap-1">
                {suggestion.variants.map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSuggestVariantIdx(i)}
                    className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                      suggestVariantIdx === i
                        ? "border-emerald-500/50 bg-emerald-500/10 text-white"
                        : "border-white/[0.08] bg-black/20 text-zinc-300 hover:border-white/15 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="font-semibold text-zinc-100">{v.label}</div>
                    <div className="mt-0.5 line-clamp-2 text-[10px] text-zinc-500">{v.text}</div>
                  </button>
                ))}
              </div>
              <div className="mt-1.5 whitespace-pre-wrap text-sm text-white">
                {suggestion.variants[suggestVariantIdx]?.text ?? suggestion.text}
              </div>
            </>
          ) : (
            <div className="mt-1 whitespace-pre-wrap text-sm text-white">{suggestion.text}</div>
          )}
          <div className="mt-2 rounded-lg border border-violet-500/25 bg-violet-950/25 px-2.5 py-2">
            <button
              type="button"
              onClick={() => setRefineOpen((o) => !o)}
              className="flex w-full items-center justify-between text-left text-[10px] font-medium text-violet-200/95"
            >
              <span>{t("chat.refineHint")}</span>
              <span className="text-zinc-500">{refineOpen ? "▾" : "▸"}</span>
            </button>
            {refineOpen ? (
              <>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {(
                [
                  ["chat.quickShorter", "chat.quickShorterPrompt"],
                  ["chat.quickFormal", "chat.quickFormalPrompt"],
                  ["chat.quickUrduMix", "chat.quickUrduMixPrompt"],
                  ["chat.quickWarmer", "chat.quickWarmerPrompt"],
                ] as const
              ).map(([labelKey, promptKey]) => (
                <button
                  key={promptKey}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setRefineNotes((n) => {
                      const frag = t(promptKey);
                      const cur = n.trim();
                      return cur ? `${cur}\n${frag}` : frag;
                    })
                  }
                  className="rounded-md border border-violet-500/35 bg-black/35 px-1.5 py-0.5 text-[10px] font-medium text-violet-100 transition hover:bg-violet-500/15 disabled:opacity-40"
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
            <textarea
              value={refineNotes}
              onChange={(e) => setRefineNotes(e.target.value)}
              rows={2}
              placeholder={t("chat.refinePlaceholder")}
              className="mt-1 w-full resize-y rounded-lg border border-white/[0.08] bg-black/45 px-2 py-1 text-[11px] text-white outline-none ring-violet-500/20 placeholder:text-zinc-600 focus:ring-2"
            />
            <button
              type="button"
              onClick={() => void runRefine()}
              disabled={!chatId || !isElectron || busy || !refineNotes.trim()}
              className="mt-1.5 rounded-lg bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-violet-500 disabled:opacity-40"
            >
              {busy ? t("chat.thinking") : t("chat.refineCraft")}
            </button>
              </>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (!suggestionForMessageId) return;
                void runSuggestForMessage(suggestionForMessageId, false);
              }}
              disabled={!chatId || !isElectron || busy || !suggestionForMessageId}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/[0.06] disabled:opacity-40"
            >
              {busy ? t("chat.thinking") : t("chat.regenerate")}
            </button>
            <button
              type="button"
              onClick={() => {
                const piece = selectedSuggestBody(suggestion, suggestVariantIdx);
                setComposer((c) => (c.trim() ? `${c.trim()}\n\n${piece}` : piece));
                setSendError(null);
              }}
              className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-500/15"
            >
              {t("chat.appendComposer")}
            </button>
            <button
              type="button"
              onClick={() => {
                setComposer(selectedSuggestBody(suggestion, suggestVariantIdx));
                setSendError(null);
              }}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white hover:bg-white/[0.06]"
            >
              {t("chat.insert")}
            </button>
            <button
              type="button"
              onClick={() => {
                setSuggestion(null);
                setSuggestionForMessageId(null);
                setSuggestionHeardText(null);
              }}
              className="rounded-lg px-2.5 py-1 text-[11px] text-zinc-400 hover:text-white"
            >
              {t("chat.dismiss")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] bg-black/20 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">
            {chatTitle ?? chatId ?? t("chat.select")}
          </div>
          {chatId && chatTitle && chatTitle !== chatId ? (
            <div className="truncate text-[11px] text-zinc-500">{chatId.replace(/@c\.us|@g\.us/gi, "")}</div>
          ) : (
            <div className="text-xs text-zinc-500">WhatsApp</div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {chatId && onSyncThread && (
            <button
              type="button"
              onClick={() => onSyncThread()}
              disabled={!isElectron || syncingThread}
              className="rounded-xl border border-white/[0.08] px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.06] disabled:opacity-40"
              title={t("chat.syncThread")}
              aria-label={t("chat.syncThread")}
            >
              {syncingThread ? t("chat.syncingThread") : "↻"}
            </button>
          )}
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as Tone)}
            className="rounded-xl border border-white/[0.08] bg-black/40 px-2 py-1.5 text-xs text-white outline-none"
            aria-label={t("chat.tone")}
          >
            <option value="professional">{t("chat.toneProfessional")}</option>
            <option value="friendly">{t("chat.toneFriendly")}</option>
            <option value="casual">{t("chat.toneCasual")}</option>
          </select>
        </div>
      </header>

      {voiceQueueLabel && (
        <div className="flex items-center gap-2 border-b border-emerald-500/15 bg-emerald-500/[0.06] px-4 py-2 text-xs text-emerald-200/90">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden />
          <span className="font-medium">{t("chat.voiceQueueTitle")}</span>
          <span className="text-emerald-200/70">{voiceQueueLabel}</span>
        </div>
      )}

      {(replyMode === "draft" || replyMode === "selective" || replyMode === "paused") && (
        <div className="flex items-center justify-end gap-2 border-b border-white/[0.05] bg-black/20 px-3 py-1.5">
          {replyMode === "draft" && (
            <HintIconButton
              glyph="info"
              accent="emerald"
              aria-label={t("chat.hintDraftAria")}
              title={t("chat.hintDraftAria")}
              onClick={() => setModeHintOpen("draft")}
            />
          )}
          {replyMode === "selective" && (
            <HintIconButton
              glyph="info"
              accent="cyan"
              aria-label={t("chat.hintSelectiveAria")}
              title={t("chat.hintSelectiveAria")}
              onClick={() => setModeHintOpen("selective")}
            />
          )}
          {replyMode === "paused" && (
            <HintIconButton
              glyph="info"
              accent="amber"
              aria-label={t("chat.hintPausedAria")}
              title={t("chat.hintPausedAria")}
              onClick={() => setModeHintOpen("paused")}
            />
          )}
        </div>
      )}

      <HelpIconModal
        open={modeHintOpen === "draft"}
        onClose={() => setModeHintOpen(null)}
        variant="info"
        title={t("chat.hintModalTitleDraft")}
        paragraphs={[t("chat.draftBanner"), t("chat.draftPhoneHint")]}
        closeLabel={t("chat.hintModalClose")}
      />
      <HelpIconModal
        open={modeHintOpen === "selective"}
        onClose={() => setModeHintOpen(null)}
        variant="info"
        title={t("chat.hintModalTitleSelective")}
        paragraphs={[t("chat.selectiveBanner")]}
        closeLabel={t("chat.hintModalClose")}
      />
      <HelpIconModal
        open={modeHintOpen === "paused"}
        onClose={() => setModeHintOpen(null)}
        variant="info"
        title={t("chat.hintModalTitlePaused")}
        paragraphs={[t("reply.paused"), t("reply.pausedDetail")]}
        closeLabel={t("chat.hintModalClose")}
      />
      <HelpIconModal
        open={errorModalOpen && Boolean(combinedError)}
        onClose={() => setErrorModalOpen(false)}
        variant="error"
        title={t("chat.hintModalTitleError")}
        paragraphs={[combinedError ?? ""]}
        closeLabel={t("chat.hintModalClose")}
      />

      <div className="relative min-h-0 flex-1">
        <div
          ref={threadScrollRef}
          className="h-full overflow-y-auto overscroll-contain px-4 py-3"
        >
          {!chatId && <div className="text-sm text-zinc-500">{t("chat.select")}</div>}
          {chatId && thread.length === 0 && <div className="text-sm text-zinc-500">{t("chat.emptyThread")}</div>}
          <div className="flex flex-col gap-2">
            {thread.map((m) => {
              const isVoice = isVoiceNoteMessage({ type: m.type, hasMedia: m.hasMedia });
              const textBody = m.body?.trim();
              const hasTranscript = Boolean(m.transcript?.trim());
              const inVoiceQueue = voiceQueueMessageIds.has(m.id);
              const isTranscribing = inVoiceQueue || (syncingThread && isVoice && !hasTranscript);
              const isAnchor = suggestionForMessageId === m.id;
              const showSuggestionHere = Boolean(suggestion && isAnchor);
              const showThinkingHere = Boolean(busy && isAnchor && !suggestion);
              return (
                <div
                  key={m.id}
                  className={`flex w-full flex-col gap-1.5 ${m.isFromMe ? "items-end" : "items-start"}`}
                >
                  <div className={`flex w-full ${m.isFromMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        m.isFromMe
                          ? "bg-gradient-to-br from-emerald-400 to-teal-600 text-black shadow-md shadow-emerald-900/30"
                          : "border border-white/[0.06] bg-white/[0.04] text-zinc-100"
                      }`}
                    >
                      {isVoice ? (
                        <VoiceNoteBubble
                          messageId={m.id}
                          accountId={accountId}
                          chatId={m.chatId}
                          isFromMe={m.isFromMe}
                          durationSec={m.voiceDurationSec}
                          transcript={m.transcript}
                          transcribing={isTranscribing}
                          isElectron={isElectron}
                          isPlayingGlobal={playingMessageId === m.id}
                          onPlayingChange={setPlayingMessageId}
                          t={t}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap">
                          {hasTranscript
                            ? m.transcript
                            : textBody
                              ? textBody
                              : m.hasMedia
                                ? "Media message"
                                : ""}
                        </div>
                      )}
                    </div>
                  </div>
                  {!m.isFromMe && isElectron && chatId && (
                    <button
                      type="button"
                      onClick={() => void runSuggestForMessage(m.id, true)}
                      disabled={busy}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-40 ${
                        isAnchor
                          ? "border-violet-400/45 bg-violet-500/15 text-violet-100"
                          : "border-white/[0.1] bg-white/[0.04] text-zinc-300 hover:border-violet-400/35 hover:bg-violet-500/10 hover:text-violet-100"
                      }`}
                    >
                      {busy && isAnchor ? t("chat.transcribingVoice") : t("chat.suggestReply")}
                    </button>
                  )}
                  {showThinkingHere && (
                    <div className="rounded-xl border border-violet-500/25 bg-violet-950/20 px-3 py-2 text-xs text-violet-200/90">
                      {t("chat.thinking")}
                    </div>
                  )}
                  {showSuggestionHere ? renderSuggestionPanel() : null}
                </div>
              );
            })}
          </div>
        </div>
        {chatId && thread.length > 0 && (
          <div className="pointer-events-none absolute right-2 top-1/2 z-[2] flex -translate-y-1/2 flex-col gap-1.5">
            <button
              type="button"
              onClick={() => scrollThread(-1)}
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/55 text-xs text-zinc-200 shadow-md backdrop-blur-sm transition hover:border-emerald-500/40 hover:text-white"
              aria-label={t("chat.scrollUp")}
              title={t("chat.scrollUp")}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => scrollThread(1)}
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/55 text-xs text-zinc-200 shadow-md backdrop-blur-sm transition hover:border-emerald-500/40 hover:text-white"
              aria-label={t("chat.scrollDown")}
              title={t("chat.scrollDown")}
            >
              ↓
            </button>
          </div>
        )}
      </div>

      {isElectron && chatId && (
        <div className="border-t border-white/[0.06] bg-black/25">
          <div className="flex items-center justify-end gap-2 px-3 py-1.5">
            <button
              type="button"
              onClick={() => setMediaPanelOpen((o) => !o)}
              aria-expanded={mediaPanelOpen}
              aria-label={t("premium.toggleMediaAria")}
              title={t("premium.toggleMediaAria")}
              className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-amber-100 shadow-sm transition ${
                mediaPanelOpen
                  ? "border-amber-400/45 bg-gradient-to-br from-amber-500/35 to-fuchsia-600/25 shadow-amber-500/15"
                  : "border-amber-500/25 bg-gradient-to-br from-amber-500/15 to-fuchsia-600/10 hover:border-amber-400/40 hover:from-amber-500/25 hover:to-fuchsia-600/20"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="8.5" cy="10" r="1.35" />
                <path d="M21 15l-5-5-4 4-2-2-5 5" />
              </svg>
              {pendingMedia && (
                <span
                  className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-[#070a0e] bg-emerald-400"
                  aria-hidden
                />
              )}
            </button>
          </div>

          {mediaPanelOpen && (
            <div className="border-t border-amber-500/20 bg-amber-950/15 px-4 pb-3 pt-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-xs font-semibold tracking-wide text-amber-200/95">{t("premium.badge")}</span>
                    {caps && !premiumUnlocked && (
                      <span className="text-[10px] leading-snug text-zinc-500">{t("premium.lockedHint")}</span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-zinc-500">{t("premium.mediaHint")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMediaPanelOpen(false)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
                  aria-label={t("premium.closePanel")}
                >
                  ×
                </button>
              </div>
              <textarea
                value={mediaPrompt}
                onChange={(e) => setMediaPrompt(e.target.value)}
                rows={2}
                placeholder={t("premium.promptPlaceholder")}
                disabled={!premiumUnlocked || mediaBusy}
                className="mt-2 w-full resize-y rounded-lg border border-white/[0.08] bg-black/40 px-2.5 py-1.5 text-xs text-white outline-none ring-amber-500/15 placeholder:text-zinc-600 focus:ring-2 disabled:opacity-45"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void runGenerateMedia("image")}
                  disabled={!premiumUnlocked || !mediaPrompt.trim() || mediaBusy}
                  className="rounded-lg border border-amber-500/35 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/25 disabled:opacity-40"
                >
                  {mediaBusy ? t("chat.thinking") : t("premium.generateImage")}
                </button>
                <button
                  type="button"
                  onClick={() => void runGenerateMedia("sticker")}
                  disabled={!premiumUnlocked || !mediaPrompt.trim() || mediaBusy}
                  className="rounded-lg border border-fuchsia-500/35 bg-fuchsia-500/15 px-3 py-1.5 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/25 disabled:opacity-40"
                >
                  {mediaBusy ? t("chat.thinking") : t("premium.generateSticker")}
                </button>
              </div>
              {pendingMedia && (
                <div className="mt-3 rounded-xl border border-white/[0.08] bg-black/35 p-2">
                  <img
                    src={`data:${pendingMedia.mimeType};base64,${pendingMedia.base64}`}
                    alt=""
                    className="mx-auto max-h-44 w-auto rounded-lg"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void sendPendingMediaToChat()}
                      disabled={mediaBusy}
                      className="rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1.5 text-xs font-bold text-black disabled:opacity-40"
                    >
                      {mediaBusy ? t("chat.thinking") : t("premium.sendToChat")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingMedia(null);
                        setMediaErr(null);
                      }}
                      className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.06]"
                    >
                      {t("premium.discardPreview")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <footer className="border-t border-white/[0.06] bg-black/25 p-3">
        <div className="flex gap-2">
          {combinedError ? (
            <HintIconButton
              glyph="alert"
              accent="rose"
              aria-label={t("chat.hintErrorAria")}
              title={t("chat.hintErrorAria")}
              showBadge={!errorModalOpen}
              onClick={() => setErrorModalOpen(true)}
            />
          ) : null}
          {isElectron && chatId && (
            <button
              type="button"
              onClick={() => void toggleVoiceRecording()}
              title={recording ? t("chat.recordVoiceStop") : t("chat.recordVoice")}
              aria-label={recording ? t("chat.recordVoiceStop") : t("chat.recordVoice")}
              className={`flex h-11 w-10 shrink-0 flex-col items-center justify-center rounded-xl border text-[10px] font-semibold leading-tight transition ${
                recording
                  ? "border-rose-500/50 bg-rose-500/20 text-rose-100 animate-pulse"
                  : "border-white/[0.1] bg-white/[0.06] text-zinc-300 hover:border-emerald-500/35 hover:text-white"
              }`}
            >
              <span className="text-base leading-none">{recording ? "■" : "●"}</span>
              <span className="mt-0.5 max-w-[2.25rem] truncate text-[9px]">{recording ? t("chat.stop") : t("chat.mic")}</span>
            </button>
          )}
          <textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            rows={2}
            placeholder={t("chat.manualPlaceholder")}
            className="min-h-[44px] flex-1 resize-none rounded-xl border border-white/[0.08] bg-black/40 px-3 py-2 text-sm text-white outline-none ring-emerald-500/20 focus:ring-2"
          />
          <button
            type="button"
            onClick={onSendManual}
            disabled={!chatId || !isElectron || !composer.trim()}
            className="self-end rounded-xl bg-white px-4 py-2 text-sm font-bold text-black shadow-md transition hover:bg-zinc-200 disabled:opacity-40"
          >
            {t("chat.send")}
          </button>
        </div>
      </footer>
    </div>
  );
}
