import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { CheckoutButton } from "@/components/marketing/CheckoutButton";

export const metadata: Metadata = {
  title: "Pricing · WhatsApp AI Desk",
  description: "Plans for WhatsApp AI Desk — OpenRouter BYOK, voice notes, and team support.",
};

const tiers = [
  {
    name: "Starter BYOK",
    price: "Free",
    period: "installer + docs",
    blurb: "Install the desk, bring your own OpenRouter key. Full inbox, training, and AI reply modes.",
    features: ["1 PC · 1 WhatsApp session", "OpenRouter chat + voice STT", "Keys stay on your machine", "Community / docs support"],
    cta: "download",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/ seat / mo",
    blurb: "Licensed software + email support. You still pay OpenRouter for AI usage (BYOK).",
    features: ["Everything in Starter", "License key + updates", "Email support (48h)", "Draft queue + voice AI"],
    plan: "pro" as const,
    highlight: true,
  },
  {
    name: "Business",
    price: "$249",
    period: "/ year / workspace",
    blurb: "Annual commitment with onboarding call and priority support.",
    features: ["All Pro features", "Annual billing", "Onboarding session", "Training template setup"],
    plan: "business" as const,
    highlight: false,
  },
  {
    name: "Lifetime",
    price: "$499",
    period: "one-time",
    blurb: "Perpetual license for one workspace. Best for agencies standardizing on one desk.",
    features: ["No monthly fee", "Lifetime updates channel", "Priority email support", "Single-device license"],
    plan: "lifetime" as const,
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <MarketingShell active="pricing">
      <main className="mx-auto max-w-6xl px-4 py-14">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/90">WhatsApp AI Desk</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Software license. Your AI key.</h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            We sell the <strong className="text-zinc-200">desktop assistant</strong> (install, license, support). You add one{" "}
            <strong className="text-zinc-200">OpenRouter</strong> API key for chat and voice transcription — usage bills to your
            OpenRouter account, not marked up by us.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {tiers.map((t) => (
            <article
              key={t.name}
              className={`flex flex-col rounded-2xl border p-6 shadow-xl ${
                t.highlight
                  ? "border-emerald-500/50 bg-gradient-to-b from-emerald-500/10 to-transparent ring-1 ring-emerald-500/30"
                  : "border-white/[0.08] bg-white/[0.02]"
              }`}
            >
              <h2 className="text-lg font-semibold text-white">{t.name}</h2>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">{t.price}</span>
                <span className="text-sm text-zinc-500">{t.period}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{t.blurb}</p>
              <ul className="mt-6 flex-1 space-y-2 text-sm text-zinc-300">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {t.cta === "download" ? (
                  <Link
                    href="/download"
                    className="block rounded-xl border border-white/15 bg-white/[0.06] py-3 text-center text-sm font-semibold text-white hover:bg-white/[0.1]"
                  >
                    Download free
                  </Link>
                ) : t.plan ? (
                  <CheckoutButton
                    plan={t.plan}
                    label="Buy now"
                    className={`block w-full rounded-xl py-3 text-center text-sm font-semibold transition ${
                      t.highlight
                        ? "bg-gradient-to-r from-emerald-400 to-teal-500 text-black hover:brightness-110"
                        : "border border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.1]"
                    }`}
                  />
                ) : null}
              </div>
            </article>
          ))}
        </div>

        <section className="mx-auto mt-16 max-w-3xl rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-sm text-zinc-400">
          <h2 className="text-lg font-semibold text-white">OpenRouter (BYOK)</h2>
          <p className="mt-3">
            After purchase you receive a <strong className="text-zinc-200">license key</strong> by email. Install the app, activate,
            then add your OpenRouter key under Setup → API keys → Save + Test. Typical AI cost is a few dollars to tens of dollars
            per month depending on message volume.
          </p>
        </section>
      </main>
    </MarketingShell>
  );
}
