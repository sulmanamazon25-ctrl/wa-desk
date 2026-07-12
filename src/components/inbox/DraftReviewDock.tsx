"use client";

import * as React from "react";
import type { WaDraftReplyPayload } from "../../../electron/ipc-contract";
import { HelpIconModal, HintIconButton } from "./HelpIconModal";

export type DraftItem = WaDraftReplyPayload & { localText: string };

export function draftDockKey(d: { accountId: string; chatId: string }): string {
  return `${d.accountId}:${d.chatId}`;
}

export function DraftReviewDock({
  drafts,
  onChangeText,
  onSend,
  onDiscard,
  isElectron,
  t,
}: {
  drafts: DraftItem[];
  onChangeText: (key: string, text: string) => void;
  onSend: (d: DraftItem) => void;
  onDiscard: (key: string) => void;
  isElectron: boolean;
  t: (key: string) => string;
}) {
  const [open, setOpen] = React.useState(true);
  const [dockHelpOpen, setDockHelpOpen] = React.useState(false);

  if (!isElectron || drafts.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] border-t border-white/[0.08] bg-[#070a0e]/95 shadow-[0_-12px_40px_rgba(0,0,0,0.55)] backdrop-blur-xl">
      <HelpIconModal
        open={dockHelpOpen}
        onClose={() => setDockHelpOpen(false)}
        variant="info"
        title={t("chat.hintModalTitleDraft")}
        paragraphs={[t("chat.draftBanner"), t("chat.draftPhoneHint")]}
        closeLabel={t("chat.hintModalClose")}
      />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-left text-xs font-semibold text-emerald-300/95"
        >
          {t("draft.title")} ({drafts.length})
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="truncate text-[10px] text-zinc-500">{t("draft.subtitle")}</span>
          <HintIconButton
            glyph="info"
            accent="emerald"
            aria-label={t("chat.hintDockDraftAria")}
            title={t("chat.hintDockDraftAria")}
            onClick={() => setDockHelpOpen(true)}
          />
        </div>
      </div>
      {open && (
        <div className="mx-auto max-h-[45vh] max-w-6xl space-y-3 overflow-y-auto px-3 pb-4">
          {drafts.map((d) => {
            const k = draftDockKey(d);
            return (
              <div
                key={k}
                className="relative rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.05] to-black/40 p-4 pt-3"
              >
                <button
                  type="button"
                  onClick={() => onDiscard(k)}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-lg leading-none text-zinc-500 transition hover:bg-white/[0.08] hover:text-white"
                  aria-label={t("draft.dismissCard")}
                >
                  ×
                </button>
                <div className="flex flex-wrap items-center justify-between gap-2 pr-10 text-[11px] text-zinc-500">
                  <span className="truncate font-mono text-zinc-300">{d.chatId}</span>
                  <span>
                    {t("draft.provider")}: <span className="text-zinc-300">{d.provider}</span>
                  </span>
                </div>
                <p className="mt-1 text-[10px] leading-snug text-zinc-600">{t("draft.afterLatest")}</p>
                <label className="mt-2 block text-xs text-zinc-400">{t("draft.edit")}</label>
                <textarea
                  value={d.localText}
                  onChange={(e) => onChangeText(k, e.target.value)}
                  rows={4}
                  className="mt-1 w-full resize-y rounded-xl border border-white/[0.08] bg-black/50 px-3 py-2 text-sm text-white outline-none ring-emerald-500/20 focus:ring-2"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSend(d)}
                    disabled={!d.localText.trim()}
                    className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-2 text-xs font-bold text-black shadow-md shadow-emerald-500/20 disabled:opacity-40"
                  >
                    {t("draft.send")}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDiscard(k)}
                    className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-white/[0.05]"
                  >
                    {t("draft.discard")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
