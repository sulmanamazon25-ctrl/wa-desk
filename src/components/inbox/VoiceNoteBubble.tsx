"use client";

import { useCallback, useEffect, useId, useState } from "react";

function formatVoiceDuration(sec?: number): string {
  const s = Math.max(0, Math.round(sec ?? 0));
  if (s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

const WAVE_HEIGHTS = [3, 6, 4, 8, 5, 9, 4, 7, 5, 8, 4, 6, 3, 7, 5, 9, 4, 6, 8, 5];

let sharedAudio: HTMLAudioElement | null = null;
let sharedBlobUrl: string | null = null;
let sharedMessageId: string | null = null;
const playbackListeners = new Set<(id: string | null) => void>();

function stopSharedPlayback(): void {
  if (sharedAudio) {
    sharedAudio.pause();
    sharedAudio.currentTime = 0;
    sharedAudio = null;
  }
  if (sharedBlobUrl) {
    URL.revokeObjectURL(sharedBlobUrl);
    sharedBlobUrl = null;
  }
  const prev = sharedMessageId;
  sharedMessageId = null;
  if (prev) playbackListeners.forEach((fn) => fn(null));
}

function subscribePlayback(fn: (id: string | null) => void): () => void {
  playbackListeners.add(fn);
  return () => playbackListeners.delete(fn);
}

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType || "audio/ogg" });
  return URL.createObjectURL(blob);
}

export function VoiceNoteBubble({
  messageId,
  accountId,
  chatId,
  isFromMe,
  durationSec,
  transcript,
  transcribing,
  isElectron,
  isPlayingGlobal,
  onPlayingChange,
  t,
}: {
  messageId: string;
  accountId: string;
  chatId: string;
  isFromMe: boolean;
  durationSec?: number;
  transcript?: string;
  transcribing?: boolean;
  isElectron: boolean;
  isPlayingGlobal: boolean;
  onPlayingChange: (messageId: string | null) => void;
  t: (key: string) => string;
}) {
  const playBtnId = useId();
  const [loading, setLoading] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const hasTranscript = Boolean(transcript?.trim());
  const showTranscribing = transcribing && !hasTranscript;
  const isPlaying = isPlayingGlobal;

  useEffect(() => {
    return subscribePlayback((id) => {
      if (id !== messageId) {
        setElapsedSec(0);
      }
    });
  }, [messageId]);

  useEffect(() => {
    return () => {
      if (sharedMessageId === messageId) stopSharedPlayback();
    };
  }, [messageId]);

  const onTogglePlay = useCallback(async () => {
    if (!isElectron || !window.desktop) return;

    if (isPlaying && sharedMessageId === messageId) {
      stopSharedPlayback();
      onPlayingChange(null);
      setElapsedSec(0);
      return;
    }

    stopSharedPlayback();
    setPlayError(null);
    setLoading(true);
    try {
      const r = await window.desktop.wa.fetchVoiceAudio(accountId, chatId, messageId);
      if (!r.ok) {
        setPlayError(r.error);
        return;
      }
      const url = base64ToBlobUrl(r.base64, r.mimeType);
      const audio = new Audio(url);
      sharedAudio = audio;
      sharedBlobUrl = url;
      sharedMessageId = messageId;
      onPlayingChange(messageId);
      playbackListeners.forEach((fn) => fn(messageId));

      audio.ontimeupdate = () => setElapsedSec(audio.currentTime);
      audio.onended = () => {
        stopSharedPlayback();
        onPlayingChange(null);
        setElapsedSec(0);
      };
      audio.onerror = () => {
        setPlayError(t("chat.voicePlayFailed"));
        stopSharedPlayback();
        onPlayingChange(null);
      };
      await audio.play();
    } catch {
      setPlayError(t("chat.voicePlayFailed"));
      stopSharedPlayback();
      onPlayingChange(null);
    } finally {
      setLoading(false);
    }
  }, [accountId, chatId, messageId, isElectron, isPlaying, onPlayingChange, t]);

  const displayDuration = isPlaying && elapsedSec > 0 ? elapsedSec : durationSec;

  return (
    <div className="min-w-[200px]">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          id={playBtnId}
          onClick={() => void onTogglePlay()}
          disabled={!isElectron || loading}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:scale-105 disabled:opacity-50 ${
            isFromMe ? "bg-black/25 text-black hover:bg-black/35" : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
          }`}
          aria-label={isPlaying ? t("chat.voicePause") : t("chat.voicePlay")}
          title={isPlaying ? t("chat.voicePause") : t("chat.voicePlay")}
        >
          {loading ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : isPlaying ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
              <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-[2px]">
          {WAVE_HEIGHTS.map((h, i) => (
            <span
              key={i}
              className={`w-[3px] shrink-0 rounded-full transition-all ${
                isFromMe ? "bg-black/35" : "bg-emerald-400/55"
              } ${showTranscribing || isPlaying ? "animate-pulse" : ""}`}
              style={{
                height: `${h + (isPlaying ? 6 : 4)}px`,
                opacity: isPlaying && i % 3 === Math.floor(elapsedSec) % 3 ? 1 : 0.75,
              }}
            />
          ))}
        </div>
        <span
          className={`shrink-0 text-[11px] tabular-nums ${
            isFromMe ? "text-black/70" : "text-zinc-400"
          }`}
        >
          {formatVoiceDuration(displayDuration)}
        </span>
      </div>
      {playError && (
        <p className={`mt-1 text-[11px] ${isFromMe ? "text-black/65" : "text-rose-400/90"}`}>{playError}</p>
      )}
      {showTranscribing && (
        <p className={`mt-1.5 text-[11px] italic ${isFromMe ? "text-black/60" : "text-zinc-500"}`}>
          {t("chat.transcribing")}
        </p>
      )}
      {hasTranscript && (
        <p
          className={`mt-1.5 text-xs leading-snug ${
            isFromMe ? "text-black/80" : "text-zinc-300"
          }`}
        >
          {transcript}
        </p>
      )}
      {!hasTranscript && !showTranscribing && (
        <p className={`mt-1.5 text-[11px] italic ${isFromMe ? "text-black/55" : "text-zinc-500"}`}>
          {t("chat.voiceNoPreview")}
        </p>
      )}
    </div>
  );
}
