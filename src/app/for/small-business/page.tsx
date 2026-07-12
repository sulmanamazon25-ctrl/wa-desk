import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { CheckoutButton } from "@/components/marketing/CheckoutButton";
import { PositioningPillars } from "@/components/marketing/PositioningPillars";
import { POSITIONING } from "@/lib/marketing/positioning";

export const metadata: Metadata = {
  title: "WhatsApp AI Desk for small business",
  description:
    "Local desktop WhatsApp assistant for freelancers, agencies, and local services. BYOK AI, draft queue, voice notes — no cloud inbox lock-in.",
};

const PAIN_POINTS = [
  {
    title: "Customers message your personal WhatsApp",
    body: "You do not need a six-week Meta API project to start replying faster. Connect with QR in minutes on the PC you already use.",
  },
  {
    title: "You cannot afford another $79/mo SaaS stack",
    body: "Pay for software ($29/mo Pro or $499 Lifetime) and OpenRouter usage directly. No bundled AI markup.",
  },
  {
    title: "You cannot risk wrong auto-replies",
    body: "Draft queue lets AI suggest — you approve. Every customer-facing message stays under your control.",
  },
  {
    title: "Voice notes slow you down",
    body: "Transcribe inbound voice messages so AI can draft a reply with full context.",
  },
];

export default function ForSmallBusinessPage() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-4xl px-4 py-14">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/90">For small business</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          WhatsApp support without the cloud platform tax
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">{POSITIONING.tagline}</p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {PAIN_POINTS.map((p) => (
            <article key={p.title} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
              <h2 className="font-semibold text-white">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{p.body}</p>
            </article>
          ))}
        </div>

        <section className="mt-14 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <h2 className="text-lg font-semibold text-emerald-200">Agencies: Lifetime $499</h2>
          <p className="mt-3 text-sm text-zinc-400">
            Standardize one Windows desk per operator with a perpetual license. No monthly platform fee for the
            software itself — just OpenRouter usage per client volume.
          </p>
          <div className="mt-4">
            <CheckoutButton
              plan="lifetime"
              label="Buy Lifetime — $499"
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-6 py-3 text-sm font-semibold text-black hover:brightness-110"
            />
          </div>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/download"
            className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-6 py-3 text-sm font-semibold text-black hover:brightness-110"
          >
            Download free starter
          </Link>
          <Link href="/pricing" className="rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white hover:bg-white/[0.06]">
            All plans
          </Link>
          <Link href="/how-it-works" className="rounded-xl px-6 py-3 text-sm font-semibold text-emerald-400 hover:underline">
            How it works →
          </Link>
        </div>
      </main>

      <PositioningPillars />
    </MarketingShell>
  );
}
