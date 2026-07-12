"use client";

import * as React from "react";
import type { WaStartRequest } from "../../../electron/ipc-contract";
import type { LicenseConnectStatus } from "../../../shared/license";
import type { DeskAccountSlot } from "../../../shared/desk-accounts";
import { formatDeskSlotLabel } from "@/lib/desk-slot-labels";
import { GhostBtn } from "@/components/setup/setup-forms";
import { WA_HELP_LINKS } from "@/components/setup/wa-links";
import { DeskCard } from "@/components/ui/DeskCard";
import { DeskButton } from "@/components/ui/DeskButton";
import { LicenseActivateModal } from "@/components/license/LicenseActivateModal";

export function WaConnectPanel({
  accountId,
  onAccountIdChange,
  deskSlots,
  onSaveDeskSlots,
  isElectron,
  qrDataUrl,
  pairingCode,
  status,
  t,
}: {
  accountId: string;
  onAccountIdChange: (v: string) => void;
  deskSlots: DeskAccountSlot[];
  onSaveDeskSlots: (slots: DeskAccountSlot[]) => void | Promise<void>;
  isElectron: boolean;
  qrDataUrl: string | null;
  pairingCode: string | null;
  status: string;
  t: (key: string) => string;
}) {
  const [phoneDigits, setPhoneDigits] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [slotDraft, setSlotDraft] = React.useState<DeskAccountSlot[]>(deskSlots);
  const [showPairing, setShowPairing] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [connectLic, setConnectLic] = React.useState<LicenseConnectStatus | null>(null);
  const [licenseModalOpen, setLicenseModalOpen] = React.useState(false);
  const [pendingStart, setPendingStart] = React.useState<WaStartRequest | null>(null);

  const acc = accountId.trim() || "default";
  const pairingSelectValue = deskSlots.some((s) => s.id === acc) ? acc : (deskSlots[0]?.id ?? "default");
  const statusNorm = status.toLowerCase();
  const isInitializing = statusNorm.startsWith("initializing");
  const isQrPhase = statusNorm.startsWith("qr");
  const showStuckHint = isInitializing && !qrDataUrl && !pairingCode;

  React.useEffect(() => {
    if (!showStuckHint) return;
    const timer = window.setTimeout(() => {
      setMsg(t("connect.initializingSlow"));
    }, 25_000);
    return () => window.clearTimeout(timer);
  }, [showStuckHint, t]);

  React.useEffect(() => {
    setSlotDraft(deskSlots);
  }, [deskSlots]);

  React.useEffect(() => {
    if (!deskSlots.some((s) => s.id === acc)) {
      onAccountIdChange(pairingSelectValue);
    }
  }, [deskSlots, acc, pairingSelectValue, onAccountIdChange]);

  const refreshConnectStatus = React.useCallback(async () => {
    if (!window.desktop?.license?.connectStatus) return;
    const s = await window.desktop.license.connectStatus();
    setConnectLic(s);
  }, []);

  React.useEffect(() => {
    void refreshConnectStatus();
  }, [refreshConnectStatus]);

  async function runStart(req: WaStartRequest) {
    if (!window.desktop) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await window.desktop.wa.startSession(req);
      if (!res.ok) {
        if (res.licenseRequired || res.error === "LICENSE_REQUIRED") {
          setPendingStart(req);
          setLicenseModalOpen(true);
          return;
        }
        const err = res.error ?? "";
        const chromeIssue = /chrome|chromium|puppeteer/i.test(err);
        setMsg(chromeIssue ? t("connect.chromeMissing") : err || t("connect.startFail"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function start(req: WaStartRequest) {
    if (!window.desktop) return;
    const status = await window.desktop.license?.connectStatus?.();
    if (status && !status.canConnect) {
      setPendingStart(req);
      setLicenseModalOpen(true);
      return;
    }
    await runStart(req);
  }

  async function onLicenseActivated() {
    await refreshConnectStatus();
    if (pendingStart) {
      const req = pendingStart;
      setPendingStart(null);
      await runStart(req);
    }
  }

  async function openExternal(url: string) {
    if (!window.desktop) return;
    const r = await window.desktop.shell.openExternal(url);
    if (!r.ok) setMsg(r.error ?? t("connect.linkFail"));
  }

  function updateSlotLabel(slotId: string, label: string) {
    setSlotDraft((rows) => rows.map((r) => (r.id === slotId ? { ...r, label } : r)));
  }

  async function persistSlotLabels() {
    setMsg(null);
    setBusy(true);
    try {
      const merged = deskSlots.map((s) => {
        const d = slotDraft.find((x) => x.id === s.id);
        return { id: s.id, label: (d?.label ?? s.label ?? "").trim() };
      });
      await onSaveDeskSlots(merged);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-16">
      <LicenseActivateModal
        open={licenseModalOpen}
        onClose={() => {
          setLicenseModalOpen(false);
          setPendingStart(null);
        }}
        onActivated={() => void onLicenseActivated()}
        trialExpired={connectLic ? !connectLic.trialActive && !connectLic.licensed : true}
      />

      {connectLic?.trialActive && !connectLic.licensed && (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          Free trial: {connectLic.trialDaysLeft} day{connectLic.trialDaysLeft === 1 ? "" : "s"} left to connect WhatsApp
          without a license.
        </div>
      )}

      {connectLic && !connectLic.canConnect && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Trial ended — activate a license to connect WhatsApp.
        </div>
      )}

      {!isElectron && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {t("connect.electronOnly")}
        </div>
      )}

      {msg && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-200">{msg}</div>
      )}

      <DeskCard title={t("connect.stepAccount")} subtitle={t("connect.pairingTargetHint")}>
        <label className="block">
          <span className="text-xs font-medium text-zinc-500">{t("connect.pairingTarget")}</span>
          <select
            value={pairingSelectValue}
            onChange={(e) => onAccountIdChange(e.target.value)}
            disabled={!isElectron || busy}
            className="mt-2 w-full rounded-lg border border-white/[0.08] bg-black/50 px-3 py-2.5 text-sm text-white outline-none disabled:opacity-50"
          >
            {deskSlots.map((s) => (
              <option key={s.id} value={s.id}>
                {formatDeskSlotLabel(s.id, s.label, t)}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
          <span className="font-medium text-zinc-400">{t("connect.status")}</span>
          <span className={isInitializing ? "text-amber-200/90" : "text-zinc-300"}>{status}</span>
        </div>
      </DeskCard>

      <DeskCard title={t("connect.qrTitle")} subtitle={t("connect.qrHint")}>
        <DeskButton
          variant="primary"
          className="w-full"
          disabled={!isElectron || busy}
          onClick={() => void start({ accountId: acc, mode: "qr" })}
        >
          {busy || isInitializing ? t("connect.qrCtaBusy") : t("connect.qrCta")}
        </DeskButton>
        {(busy || isInitializing) && !qrDataUrl && (
          <p className="mt-3 text-center text-xs text-zinc-500">{t("connect.qrWaiting")}</p>
        )}
        {isQrPhase && !qrDataUrl && (
          <p className="mt-3 text-center text-xs text-emerald-300/80">{t("connect.qrLoading")}</p>
        )}
        {qrDataUrl && (
          <div className="mt-5 rounded-xl bg-white p-4 text-center shadow-lg">
            <div className="text-xs font-semibold text-zinc-800">{t("connect.scanQr")}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="WhatsApp QR" src={qrDataUrl} className="mx-auto mt-3 h-52 w-52" />
          </div>
        )}
        {showStuckHint ? (
          <p className="mt-3 text-[11px] leading-relaxed text-amber-200/80">{t("connect.initializingHint")}</p>
        ) : null}

        <button
          type="button"
          onClick={() => setShowPairing((v) => !v)}
          className="mt-4 text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          {showPairing ? "− " : "+ "}
          {t("connect.pairTitle")}
        </button>
        {showPairing && (
          <div className="mt-3 space-y-3 border-t border-white/[0.06] pt-3">
            <p className="text-xs text-zinc-500">{t("connect.pairHint")}</p>
            <input
              value={phoneDigits}
              onChange={(e) => setPhoneDigits(e.target.value.replace(/[^\d]/g, ""))}
              disabled={!isElectron || busy}
              placeholder="923001234567"
              className="w-full rounded-lg border border-white/[0.08] bg-black/50 px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
            />
            <DeskButton
              variant="secondary"
              className="w-full"
              disabled={!isElectron || busy || phoneDigits.length < 8}
              onClick={() => void start({ accountId: acc, mode: "phone", phoneDigits })}
            >
              {t("connect.pairCta")}
            </DeskButton>
            {pairingCode && (
              <div className="rounded-xl border border-emerald-500/25 bg-black/40 px-4 py-5 text-center">
                <div className="text-xs text-zinc-400">{t("connect.enterOnPhone")}</div>
                <div className="mt-2 font-mono text-2xl font-bold tracking-[0.3em] text-white">{pairingCode}</div>
              </div>
            )}
          </div>
        )}
      </DeskCard>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left text-sm font-medium text-zinc-300 transition hover:bg-white/[0.04]"
      >
        <span>{t("nav.advanced")}</span>
        <span className="text-zinc-500">{showAdvanced ? "−" : "+"}</span>
      </button>

      {showAdvanced && (
        <div className="space-y-4">
          <DeskCard title={t("connect.deskSlotsTitle")} subtitle={t("connect.deskSlotsHint")}>
            <div className="space-y-3">
              {slotDraft.map((row) => (
                <div key={row.id} className="rounded-lg border border-white/[0.06] bg-black/25 p-3">
                  <div className="text-sm font-semibold text-white">{formatDeskSlotLabel(row.id, row.label, t)}</div>
                  <label className="mt-2 block">
                    <span className="text-[10px] uppercase text-zinc-500">{t("connect.deskSlotLabel")}</span>
                    <input
                      value={row.label}
                      onChange={(e) => updateSlotLabel(row.id, e.target.value)}
                      disabled={!isElectron || busy}
                      placeholder={t("connect.deskSlotLabelPh")}
                      className="mt-1 w-full rounded-lg border border-white/[0.08] bg-black/50 px-3 py-2 text-sm text-white outline-none disabled:opacity-50"
                    />
                  </label>
                </div>
              ))}
            </div>
            <DeskButton variant="secondary" className="mt-3" disabled={!isElectron || busy} onClick={() => void persistSlotLabels()}>
              {t("connect.deskSlotsSaveLabels")}
            </DeskButton>
          </DeskCard>

          <DeskCard title={t("connect.sessionTools")} subtitle={t("connect.sessionHint")}>
            <div className="flex flex-wrap gap-2">
              <DeskButton
                variant="ghost"
                disabled={!isElectron || busy}
                onClick={async () => {
                  if (!window.desktop) return;
                  setBusy(true);
                  const r = await window.desktop.wa.cancelPairing(acc);
                  if (!r.ok) setMsg(r.error ?? t("connect.cancelFail"));
                  setBusy(false);
                }}
              >
                {t("connect.cancelPairing")}
              </DeskButton>
              <DeskButton
                variant="ghost"
                disabled={!isElectron || busy}
                onClick={async () => {
                  if (!window.desktop) return;
                  if (!confirm(t("connect.confirmLogout"))) return;
                  setBusy(true);
                  await window.desktop.wa.logout(acc);
                  setBusy(false);
                }}
              >
                {t("connect.logout")}
              </DeskButton>
              <DeskButton
                variant="danger"
                disabled={!isElectron || busy}
                onClick={async () => {
                  if (!window.desktop) return;
                  if (!confirm(t("connect.confirmWipe"))) return;
                  setBusy(true);
                  const r = await window.desktop.wa.resetLocalSession(acc);
                  if (!r.ok) setMsg(r.error ?? t("connect.wipeFail"));
                  setBusy(false);
                }}
              >
                {t("connect.wipe")}
              </DeskButton>
            </div>
          </DeskCard>
        </div>
      )}

      <div className="border-t border-white/[0.05] pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">{t("connect.quickLinks")}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <GhostBtn onClick={() => void openExternal(WA_HELP_LINKS.web)}>{t("connect.linkWeb")}</GhostBtn>
          <GhostBtn onClick={() => void openExternal(WA_HELP_LINKS.linkDeviceFaq)}>{t("connect.linkDevice")}</GhostBtn>
          <GhostBtn onClick={() => void openExternal(WA_HELP_LINKS.linkedDevicesFaq)}>{t("connect.linkLinked")}</GhostBtn>
        </div>
      </div>
    </div>
  );
}
