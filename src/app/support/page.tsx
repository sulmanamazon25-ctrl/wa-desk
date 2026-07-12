import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";

export const metadata: Metadata = {
  title: "Support · WhatsApp AI Desk",
  description: "Setup guide, FAQ, and help for WhatsApp AI Desk.",
};

const FAQ = [
  {
    q: "Do I need Node.js?",
    a: "No. Clients use the Windows installer only. Node/npm is for developers building from source.",
  },
  {
    q: "Where do I get an OpenRouter key?",
    a: "Create an account at openrouter.ai, add credits, then paste the API key in Setup → API keys. Use Save + Test until all checks are green.",
  },
  {
    q: "Voice notes are not transcribing",
    a: "Install ffmpeg (winget install Gyan.FFmpeg), verify OpenRouter STT in API keys Test, and ensure the voice note is inbound from a customer.",
  },
  {
    q: "License already activated on another device",
    a: "Each license binds to one machine on first activation. Email support with your purchase email to request a transfer.",
  },
  {
    q: "Is this official WhatsApp?",
    a: "No. The app uses whatsapp-web.js (unofficial). Use a dedicated business number and read our Acceptable Use policy.",
  },
];

export default function SupportPage() {
  return (
    <MarketingShell active="support">
      <main className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-3xl font-bold text-white">Support & setup</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Quick answers below. Live chat (bottom-right) when configured. Email via{" "}
          <Link href="/contact" className="text-emerald-400 hover:underline">
            Contact
          </Link>
          .
        </p>

        <section className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
          <h2 className="text-lg font-semibold text-white">Client setup (5 steps)</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
            <li>
              <Link href="/download" className="text-emerald-400 hover:underline">
                Download
              </Link>{" "}
              and run the Windows installer
            </li>
            <li>Open the app → paste license key from purchase email</li>
            <li>Connect → scan WhatsApp QR or use phone pairing</li>
            <li>Setup → API keys → OpenRouter → Save + Test (all green)</li>
            <li>Setup → Training → business FAQ → Inbox → Draft queue → test Suggest reply</li>
          </ol>
          <p className="mt-4 text-xs text-zinc-500">
            Detailed guide: <code className="text-zinc-400">docs/CLIENT-SETUP.md</code> in the developer repo.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-white">FAQ</h2>
          <dl className="mt-4 space-y-6">
            {FAQ.map((item) => (
              <div key={item.q}>
                <dt className="font-medium text-zinc-200">{item.q}</dt>
                <dd className="mt-1 text-sm text-zinc-400">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12 text-sm text-zinc-500">
          <Link href="/terms" className="hover:text-zinc-300">
            Terms
          </Link>
          {" · "}
          <Link href="/privacy" className="hover:text-zinc-300">
            Privacy
          </Link>
          {" · "}
          <Link href="/acceptable-use" className="hover:text-zinc-300">
            Acceptable use
          </Link>
        </section>
      </main>
    </MarketingShell>
  );
}
