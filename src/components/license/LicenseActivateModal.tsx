"use client";

import * as React from "react";
import Link from "next/link";

export function LicenseActivateModal({
  open,
  onClose,
  onActivated,
  trialExpired = true,
}: {
  open: boolean;
  onClose: () => void;
  onActivated?: () => void;
  trialExpired?: boolean;
}) {
  const [licenseKey, setLicenseKey] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [showAdmin, setShowAdmin] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setLicenseKey("");
      setPin("");
      setErr(null);
      setShowAdmin(false);
    }
  }, [open]);

  if (!open) return null;

  async function activateLicense(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!window.desktop?.license) return;
    setBusy(true);
    try {
      const r = await window.desktop.license.activate(licenseKey.trim());
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      onActivated?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function adminUnlock(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!window.desktop?.gate) return;
    setBusy(true);
    try {
      const r = await window.desktop.gate.unlock(pin.trim());
      if (!r.ok) {
        setErr("Incorrect admin code.");
        setPin("");
        return;
      }
      onActivated?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0b0f14] p-8 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="license-modal-title"
      >
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/90">WhatsApp AI Desk</p>
        <h2 id="license-modal-title" className="mt-2 text-center text-xl font-semibold text-white">
          Activate your license
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-500">
          {trialExpired
            ? "Your 3-day trial has ended. Paste your license key to connect WhatsApp."
            : "Paste the key from your purchase email to connect WhatsApp."}
        </p>
        <form onSubmit={activateLicense} className="mt-6 space-y-4">
          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="WADESK-XXXX-XXXX-XXXX"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
            className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-center font-mono text-sm tracking-wider text-white outline-none ring-emerald-500/30 focus:ring-2"
          />
          {err && !showAdmin && <p className="text-center text-sm text-rose-300">{err}</p>}
          <button
            type="submit"
            disabled={busy || !licenseKey.trim()}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 py-3 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 disabled:opacity-40"
          >
            {busy ? "Activating…" : "Activate license"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setShowAdmin((v) => !v)}
          className="mt-6 w-full text-center text-xs text-zinc-500 hover:text-zinc-300"
        >
          {showAdmin ? "Hide admin unlock" : "Admin / developer unlock"}
        </button>

        {showAdmin && (
          <form onSubmit={adminUnlock} className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
            <input
              type="password"
              autoComplete="off"
              placeholder="Admin PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2.5 text-center text-white outline-none"
            />
            {err && showAdmin && <p className="text-center text-sm text-rose-300">{err}</p>}
            <button
              type="submit"
              disabled={busy || !pin.trim()}
              className="w-full rounded-xl border border-white/15 bg-white/[0.06] py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              Admin unlock
            </button>
          </form>
        )}

        <div className="mt-6 flex justify-center gap-3 text-xs">
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            Cancel
          </button>
          <Link href="/download" className="text-emerald-400 hover:underline" onClick={onClose}>
            Get a license
          </Link>
        </div>
      </div>
    </div>
  );
}
