"use client";

import * as React from "react";
import type { ReplyMode } from "../../../electron/ipc-contract";

type Step = 1 | 2;

export function PostConnectModal({
  open,
  step,
  setStep,
  onSelectReplyMode,
  onClose,
  t,
}: {
  open: boolean;
  step: Step;
  setStep: (s: Step) => void;
  onSelectReplyMode: (m: ReplyMode) => void;
  onClose: () => void;
  t: (key: string) => string;
}) {
  const [notifResult, setNotifResult] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && step === 1) setNotifResult(null);
  }, [open, step]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function requestNotifications() {
    if (!("Notification" in window)) {
      setNotifResult(t("postConnect.notifUnsupported"));
      setStep(2);
      return;
    }
    const r = await Notification.requestPermission();
    setNotifResult(r === "granted" ? t("postConnect.notifGranted") : t("postConnect.notifDenied"));
    setStep(2);
  }

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#0c1018] p-6 shadow-2xl shadow-black/50"
      >
        {step === 1 && (
          <>
            <h2 className="text-lg font-semibold text-white">{t("postConnect.step1Title")}</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{t("postConnect.step1Body")}</p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void requestNotifications()}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 py-2.5 text-sm font-bold text-black"
              >
                {t("postConnect.allowNotif")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNotifResult(t("postConnect.notifSkipped"));
                  setStep(2);
                }}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-zinc-300 hover:bg-white/[0.05]"
              >
                {t("postConnect.skipNotif")}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-lg font-semibold text-white">{t("postConnect.step2Title")}</h2>
            <p className="mt-2 text-sm text-zinc-500">{t("postConnect.step2Body")}</p>
            {notifResult && <p className="mt-2 text-xs text-zinc-400">{notifResult}</p>}

            <div className="mt-5 grid gap-3">
              {(
                [
                  ["auto", "reply.auto", "postConnect.modeAutoDesc"],
                  ["paused", "reply.paused", "postConnect.modePausedDesc"],
                  ["draft", "reply.draft", "postConnect.modeDraftDesc"],
                  ["selective", "reply.selective", "postConnect.modeSelectiveDesc"],
                ] as const
              ).map(([mode, titleKey, descKey]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    onSelectReplyMode(mode);
                    onClose();
                  }}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-left transition hover:border-emerald-500/40 hover:bg-white/[0.06]"
                >
                  <div className="text-sm font-semibold text-white">{t(titleKey)}</div>
                  <div className="mt-1 text-xs text-zinc-500">{t(descKey)}</div>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-xl border border-white/10 py-2.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/[0.06]"
            >
              {t("postConnect.goInbox")}
            </button>
            <p className="mt-2 text-center text-[11px] text-zinc-500">{t("postConnect.goInboxHint")}</p>
          </>
        )}
      </div>
    </div>
  );
}
