"use client";

import * as React from "react";
import type { TrainingBundle } from "../../../shared/training";
import { useI18n } from "@/i18n/I18nContext";

export function BusinessView({ isElectron }: { isElectron: boolean }) {
  const { t } = useI18n();
  const [bundle, setBundle] = React.useState<TrainingBundle | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isElectron || !window.desktop) return;
    void window.desktop.training.load().then(setBundle);
  }, [isElectron]);

  async function persist(next: TrainingBundle) {
    setBundle(next);
    if (!isElectron || !window.desktop) return;
    setBusy(true);
    setMsg(null);
    try {
      await window.desktop.training.save(next);
      setMsg(t("business.savedToast"));
      setTimeout(() => setMsg(null), 2000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function addReferenceFiles() {
    if (!isElectron || !window.desktop || !bundle) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await window.desktop.training.pickReferenceDocs();
      if ("cancelled" in r && r.cancelled) return;
      if (!r.ok) {
        setMsg(r.error);
        return;
      }
      setBundle(r.bundle);
      setMsg(t("business.savedToast"));
      setTimeout(() => setMsg(null), 2000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function removeDoc(id: string) {
    if (!bundle) return;
    void persist({
      ...bundle,
      referenceDocs: (bundle.referenceDocs ?? []).filter((d) => d.id !== id),
    });
  }

  if (!bundle && isElectron) {
    return <div className="text-sm text-zinc-500">…</div>;
  }

  const b =
    bundle ??
    ({
      faqs: [],
      priorityContext: "",
      referenceDocs: [],
      businessInfo: "",
      pricing: "",
      services: "",
      bookingRules: "",
      customInstructions: "",
    } satisfies TrainingBundle);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24 pt-2">
      <div>
        <h2 className="text-xl font-semibold text-white">{t("business.title")}</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500">{t("business.sub")}</p>
      </div>

      {!isElectron && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {t("connect.electronOnly")}
        </div>
      )}

      {msg && (
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-200">{msg}</div>
      )}

      <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-5">
        <label className="block">
          <span className="text-sm font-medium text-zinc-200">{t("business.priorityLabel")}</span>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t("business.priorityHint")}</p>
          <textarea
            value={b.priorityContext}
            onChange={(e) => setBundle({ ...b, priorityContext: e.target.value })}
            disabled={!isElectron || busy}
            rows={8}
            placeholder={t("business.priorityPlaceholder")}
            className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none ring-emerald-500/20 focus:ring-2 disabled:opacity-40"
          />
        </label>
        <button
          type="button"
          disabled={!isElectron || busy}
          onClick={() => void persist(b)}
          className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-40"
        >
          {t("business.saveNotes")}
        </button>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-5">
        <div className="text-sm font-medium text-zinc-200">{t("business.filesTitle")}</div>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t("business.filesHint")}</p>
        <button
          type="button"
          disabled={!isElectron || busy}
          onClick={() => void addReferenceFiles()}
          className="mt-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-emerald-500/15 transition hover:brightness-110 disabled:opacity-40"
        >
          {t("business.addFiles")}
        </button>

        <ul className="mt-4 space-y-2">
          {(b.referenceDocs ?? []).length === 0 ? (
            <li className="text-xs text-zinc-600">{t("business.noFiles")}</li>
          ) : (
            (b.referenceDocs ?? []).map((d) => (
              <li
                key={d.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{d.name}</div>
                  <div className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500">
                    {(d.text ?? "").slice(0, 180)}
                    {(d.text ?? "").length > 180 ? "…" : ""}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!isElectron || busy}
                  onClick={() => removeDoc(d.id)}
                  className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/10 disabled:opacity-40"
                >
                  {t("business.removeFile")}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      <p className="text-xs text-zinc-600">{t("business.trainingCrossLink")}</p>
    </div>
  );
}
