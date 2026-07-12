"use client";

import { useEffect, useState } from "react";
import type { TrainingBundle } from "../../../shared/training";
import { useI18n } from "@/i18n/I18nContext";

export function TrainingPanel({ isElectron }: { isElectron: boolean }) {
  const { t } = useI18n();
  const [bundle, setBundle] = useState<TrainingBundle>({
    faqs: [],
    priorityContext: "",
    referenceDocs: [],
    businessInfo: "",
    pricing: "",
    services: "",
    bookingRules: "",
    customInstructions: "",
  });
  const [faqQ, setFaqQ] = useState("");
  const [faqA, setFaqA] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!isElectron || !window.desktop) return;
    void window.desktop.training.load().then(setBundle);
  }, [isElectron]);

  async function persist(next: TrainingBundle) {
    setBundle(next);
    if (!isElectron || !window.desktop) return;
    await window.desktop.training.save(next);
    setSaved("Saved");
    setTimeout(() => setSaved(null), 1200);
  }

  function addFaq() {
    if (!faqQ.trim() || !faqA.trim()) return;
    void persist({ ...bundle, faqs: [...bundle.faqs, { q: faqQ.trim(), a: faqA.trim() }] });
    setFaqQ("");
    setFaqA("");
  }

  return (
    <div className="h-full overflow-y-auto border-l border-white/5 bg-surface-raised/10 p-4">
      <div className="text-sm font-semibold text-white">{t("training.panelTitle")}</div>
      <p className="mt-1 text-xs leading-relaxed text-zinc-500">{t("training.panelSub")}</p>

      <div className="mt-4 space-y-3">
        <Field label="Business information" value={bundle.businessInfo} onChange={(v) => void persist({ ...bundle, businessInfo: v })} disabled={!isElectron} />
        <Field label="Services" value={bundle.services} onChange={(v) => void persist({ ...bundle, services: v })} disabled={!isElectron} />
        <Field label="Pricing" value={bundle.pricing} onChange={(v) => void persist({ ...bundle, pricing: v })} disabled={!isElectron} />
        <Field label="Booking rules" value={bundle.bookingRules} onChange={(v) => void persist({ ...bundle, bookingRules: v })} disabled={!isElectron} />
        <Field
          label="Custom instructions"
          value={bundle.customInstructions}
          onChange={(v) => void persist({ ...bundle, customInstructions: v })}
          disabled={!isElectron}
        />
      </div>

      <div className="mt-6 rounded-xl border border-white/5 bg-black/20 p-3">
        <div className="text-xs font-medium text-zinc-300">FAQ entries</div>
        <div className="mt-2 space-y-2">
          <input
            value={faqQ}
            onChange={(e) => setFaqQ(e.target.value)}
            placeholder="Question"
            disabled={!isElectron}
            className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none disabled:opacity-40"
          />
          <textarea
            value={faqA}
            onChange={(e) => setFaqA(e.target.value)}
            placeholder="Answer"
            rows={3}
            disabled={!isElectron}
            className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none disabled:opacity-40"
          />
          <button
            type="button"
            onClick={addFaq}
            disabled={!isElectron}
            className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15 disabled:opacity-40"
          >
            Add FAQ
          </button>
        </div>
        <ul className="mt-3 space-y-2 text-xs text-zinc-300">
          {bundle.faqs.map((f, idx) => (
            <li key={`${f.q}-${idx}`} className="rounded-lg border border-white/5 bg-black/20 p-2">
              <div className="font-medium text-white">{f.q}</div>
              <div className="mt-1 whitespace-pre-wrap text-zinc-400">{f.a}</div>
            </li>
          ))}
        </ul>
      </div>

      {saved && <div className="mt-3 text-xs text-accent">{saved}</div>}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="block">
      <div className="text-xs text-zinc-500">{label}</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        disabled={disabled}
        className="mt-1 w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none ring-accent/30 focus:ring-2 disabled:opacity-40"
      />
    </label>
  );
}
