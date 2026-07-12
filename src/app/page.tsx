import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { CheckoutButton } from "@/components/marketing/CheckoutButton";
import { PositioningPillars } from "@/components/marketing/PositioningPillars";
import {
  COST_COMPARISON,
  FEATURES,
  ICP_CARDS,
  NOT_FOR_YOU,
  POSITIONING,
  SETUP_STEPS,
  VS_LINKS,
} from "@/lib/marketing/positioning";

export const metadata: Metadata = {
  title: "WhatsApp AI Desk — Desktop WhatsApp AI with BYOK & draft queue",
  description:
    "Local-first desktop WhatsApp assistant: OpenRouter BYOK, draft queue approvals, voice-note transcription, FAQ training. Not another cloud chatbot platform.",
};

export default function MarketingLandingPage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden px-4 py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.15),transparent)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/90">{POSITIONING.eyebrow}</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">{POSITIONING.heroTitle}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            {POSITIONING.heroLead}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/download"
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-8 py-3.5 text-sm font-semibold text-black shadow-lg hover:brightness-110"
            >
              Download for Windows
            </Link>
            <CheckoutButton
              plan="pro"
              label="Buy Pro — $29/mo"
              className="rounded-xl border border-white/15 bg-white/[0.06] px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/[0.1]"
            />
            <Link
              href="/how-it-works"
              className="rounded-xl px-6 py-3.5 text-sm font-semibold text-emerald-400 hover:underline"
            >
              How it works →
            </Link>
          </div>
        </div>
      </section>

      <PositioningPillars />

      <section className="border-t border-white/[0.06] px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-semibold text-white">Who it&apos;s for</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {ICP_CARDS.map((card) => (
              <article key={card.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                <h3 className="font-semibold text-white">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{card.body}</p>
              </article>
            ))}
          </div>
          <p className="mt-8 text-center">
            <Link href="/for/small-business" className="text-sm font-semibold text-emerald-400 hover:underline">
              See small-business use cases →
            </Link>
          </p>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-4 py-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8">
          <h2 className="text-lg font-semibold text-amber-200">Not for you if…</h2>
          <ul className="mt-4 space-y-2 text-sm text-zinc-400">
            {NOT_FOR_YOU.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="text-amber-500/80">—</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-zinc-500">
            We are honest about tradeoffs. Compare us to cloud platforms before you buy.
          </p>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl font-semibold text-white">Transparent costs</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <article className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
              <h3 className="font-semibold text-emerald-300">{COST_COMPARISON.desk.label}</h3>
              <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                {COST_COMPARISON.desk.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
            <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
              <h3 className="font-semibold text-zinc-300">{COST_COMPARISON.cloud.label}</h3>
              <ul className="mt-4 space-y-2 text-sm text-zinc-400">
                {COST_COMPARISON.cloud.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-zinc-600">—</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
          <p className="mt-6 text-center">
            <Link href="/pricing" className="text-sm font-semibold text-emerald-400 hover:underline">
              View pricing →
            </Link>
          </p>
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-4 py-16">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-2xl font-semibold text-white">Compare without leaving this site</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400">
            See how a local desktop desk differs from the cloud WhatsApp SaaS you may already be researching.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {VS_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-white/10 bg-white/[0.04] px-5 py-2 text-sm font-semibold text-zinc-300 hover:border-emerald-500/30 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-semibold text-white">What you get</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article key={f.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
              <h3 className="font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-white/[0.06] px-4 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-xl font-semibold text-white">Ready in five steps</h2>
          <ol className="mt-6 space-y-2 text-left text-sm text-zinc-400">
            {SETUP_STEPS.map((step, i) => (
              <li key={step}>
                {i + 1}. {step}
              </li>
            ))}
          </ol>
          <Link href="/support" className="mt-8 inline-block text-sm font-semibold text-emerald-400 hover:underline">
            Full setup guide →
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
