import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { CheckoutButton } from "@/components/marketing/CheckoutButton";

export const metadata: Metadata = {
  title: "WhatsApp AI Desk — Local AI assistant for business WhatsApp",
  description:
    "Desktop WhatsApp assistant with OpenRouter BYOK: AI replies, voice-note transcription, FAQ training. Install on your PC — chats stay local.",
};

export default function MarketingLandingPage() {
  return (
    <MarketingShell>
      <section className="relative overflow-hidden px-4 py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.15),transparent)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/90">Local-first · BYOK</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            WhatsApp AI Desk
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
            A <strong className="text-zinc-200">desktop assistant</strong> for business WhatsApp: AI replies, voice-note
            transcription, and FAQ-trained responses. Install on your PC, connect your number, add your{" "}
            <strong className="text-zinc-200">OpenRouter</strong> API key. Your chats and keys stay on your machine.
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
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-semibold text-white">What you get</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Inbox + draft queue",
              body: "AI suggests replies; you review before send. Safe default for customer-facing teams.",
            },
            {
              title: "Voice notes → text",
              body: "Transcribe inbound voice messages via OpenRouter STT so AI can reply with context.",
            },
            {
              title: "Training bundle",
              body: "Paste FAQs, policies, and tone — the model follows your business, not generic chatbot fluff.",
            },
            {
              title: "One OpenRouter key",
              body: "Chat and speech-to-text through a single BYOK key. Usage bills to your OpenRouter account.",
            },
            {
              title: "Local sessions",
              body: "WhatsApp session data stays on the PC. We only store license email + metadata on our server.",
            },
            {
              title: "Windows installer",
              body: "One-click NSIS setup. No Node.js or npm required for your clients.",
            },
          ].map((f) => (
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
            <li>1. Download and install the Windows app</li>
            <li>2. Activate your license key from email</li>
            <li>3. Connect WhatsApp (QR or pairing code)</li>
            <li>4. Setup → API keys → OpenRouter → Save + Test</li>
            <li>5. Training → paste FAQ → Inbox in Draft queue mode</li>
          </ol>
          <Link href="/support" className="mt-8 inline-block text-sm font-semibold text-emerald-400 hover:underline">
            Full setup guide →
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
