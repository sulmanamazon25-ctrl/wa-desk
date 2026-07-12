"use client";

import * as React from "react";
import type { ReplyMode } from "../../../electron/ipc-contract";
import type { DeskAccountSlot } from "../../../shared/desk-accounts";
import { formatDeskSlotLabel } from "@/lib/desk-slot-labels";
import { useI18n } from "@/i18n/I18nContext";

const REPLY_MODES: { mode: ReplyMode; labelKey: string }[] = [
  { mode: "auto", labelKey: "reply.auto" },
  { mode: "paused", labelKey: "reply.paused" },
  { mode: "draft", labelKey: "reply.draft" },
  { mode: "selective", labelKey: "reply.selective" },
];

function sessionDotClass(line: string): string {
  const s = line.toLowerCase();
  if (s.startsWith("ready")) return "bg-emerald-400";
  if (s.startsWith("error")) return "bg-rose-400";
  if (s.startsWith("initializing") || s.startsWith("qr") || s.startsWith("pairing")) return "bg-amber-400";
  if (s.startsWith("authenticated")) return "bg-cyan-400";
  return "bg-zinc-500";
}

export function DeskTopBar({
  replyMode,
  setReplyMode,
  deskSlots,
  activeDeskAccountId,
  onSelectDeskAccount,
  activeSessionLine,
  isElectron,
}: {
  replyMode: ReplyMode;
  setReplyMode: (m: ReplyMode) => void;
  deskSlots: DeskAccountSlot[];
  activeDeskAccountId: string;
  onSelectDeskAccount: (id: string) => void;
  activeSessionLine: string;
  isElectron: boolean;
}) {
  const { t } = useI18n();

  const acc = activeDeskAccountId.trim() || "default";

  React.useEffect(() => {
    if (!isElectron || !window.desktop) return;
    void window.desktop.wa.setReplyMode(acc, replyMode, false);
  }, [isElectron, acc]);

  function armMode(mode: ReplyMode) {
    setReplyMode(mode);
    if (isElectron && window.desktop) {
      void window.desktop.wa.setReplyMode(acc, mode, true);
    }
  }

  const shortSession = activeSessionLine.split(" · ")[0] ?? activeSessionLine;
  const sessionReady = activeSessionLine.toLowerCase().startsWith("ready");

  return (
    <header
      role="banner"
      className="relative z-[100] flex shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#0a0d12]/90 px-4 py-2.5 backdrop-blur-md"
    >
      <div
        role="group"
        aria-label={t("header.accountsGroup")}
        className="flex items-center gap-1.5"
      >
        {deskSlots.map((slot) => {
          const active = slot.id === activeDeskAccountId;
          const pill = formatDeskSlotLabel(slot.id, slot.label, t);
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => onSelectDeskAccount(slot.id)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                active
                  ? "border-emerald-500/45 bg-emerald-500/12 text-emerald-100"
                  : "border-white/[0.08] bg-black/30 text-zinc-400 hover:border-white/15 hover:text-white"
              }`}
            >
              {pill.length > 18 ? pill.slice(0, 18) + "…" : pill}
            </button>
          );
        })}
      </div>

      <div
        className="flex min-w-0 max-w-[200px] items-center gap-2 rounded-full border border-white/[0.06] bg-black/30 px-3 py-1 text-[11px] text-zinc-400"
        title={activeSessionLine}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${sessionDotClass(activeSessionLine)}`} aria-hidden />
        <span className="truncate">{shortSession}</span>
      </div>

      {!sessionReady && replyMode !== "paused" ? (
        <span className="hidden text-[10px] text-amber-200/80 md:inline">{t("reply.waitConnect")}</span>
      ) : null}

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-0.5 rounded-full border border-white/[0.08] bg-black/40 p-0.5 md:flex" title={t("reply.hint")}>
          {REPLY_MODES.map(({ mode, labelKey }) => (
            <button
              key={mode}
              type="button"
              disabled={!isElectron}
              onClick={() => armMode(mode)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition disabled:opacity-40 ${
                replyMode === mode ? "bg-emerald-500 text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        <label className="md:hidden">
          <span className="sr-only">{t("reply.hint")}</span>
          <select
            value={replyMode}
            disabled={!isElectron}
            onChange={(e) => armMode(e.target.value as ReplyMode)}
            className="rounded-lg border border-white/[0.08] bg-black/50 px-2 py-1 text-xs text-white outline-none disabled:opacity-40"
          >
            {REPLY_MODES.map(({ mode, labelKey }) => (
              <option key={mode} value={mode}>
                {t(labelKey)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
