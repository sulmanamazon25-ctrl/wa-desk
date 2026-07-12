import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { PositioningPillars } from "@/components/marketing/PositioningPillars";
import { HOW_IT_WORKS_STEPS } from "@/lib/marketing/positioning";

export const metadata: Metadata = {
  title: "How it works · WhatsApp AI Desk",
  description:
    "Five steps from Windows install to AI-suggested WhatsApp replies: license, connect, OpenRouter BYOK, training, and draft queue.",
};

export default function HowItWorksPage() {
  return (
    <MarketingShell active="how-it-works">
      <main className="mx-auto max-w-4xl px-4 py-14">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/90">How it works</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          From install to your first approved reply
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          WhatsApp AI Desk is a <strong className="text-zinc-200">desktop copilot</strong>, not a cloud chatbot. You
          connect your number, add your OpenRouter key, train on your FAQs, and use Draft queue so every reply is
          reviewed before send.
        </p>

        <ol className="mt-12 space-y-8">
          {HOW_IT_WORKS_STEPS.map((s) => (
            <li key={s.step} className="flex gap-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-bold text-emerald-300">
                {s.step}
              </span>
              <div>
                <h2 className="text-lg font-semibold text-white">{s.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-14 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <h2 className="text-lg font-semibold text-emerald-200">Draft queue (recommended)</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            In Draft queue mode, AI reads each inbound message and writes a suggested reply in the dock. Nothing sends
            until you click <strong className="text-zinc-200">Send to WhatsApp</strong>. This is the safe default for
            customer-facing teams — you stay in control while AI does the heavy lifting.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
          <h2 className="text-lg font-semibold text-white">BYOK with OpenRouter</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Create an account at{" "}
            <a href="https://openrouter.ai/" className="text-emerald-400 hover:underline" target="_blank" rel="noreferrer">
              openrouter.ai
            </a>
            , add credits, and paste your API key in Setup → API keys. One key powers chat replies and voice-note
            transcription. Typical cost is a few dollars to tens of dollars per month depending on volume — billed
            directly by OpenRouter, not marked up by us.
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
          <h2 className="text-lg font-semibold text-white">Voice notes</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            When a customer sends a voice note, the desk transcribes it via OpenRouter STT so AI can suggest a contextual
            reply. Install ffmpeg if transcription fails:{" "}
            <code className="text-zinc-300">winget install Gyan.FFmpeg</code>
          </p>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/download"
            className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-6 py-3 text-sm font-semibold text-black hover:brightness-110"
          >
            Download for Windows
          </Link>
          <Link href="/support" className="rounded-xl border border-white/15 px-6 py-3 text-sm font-semibold text-white hover:bg-white/[0.06]">
            Setup guide
          </Link>
        </div>
      </main>

      <PositioningPillars title="Built on three principles" />
    </MarketingShell>
  );
}
