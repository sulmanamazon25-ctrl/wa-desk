import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";

export const metadata: Metadata = {
  title: "Download · WhatsApp AI Desk",
  description: "Download the Windows installer for WhatsApp AI Desk.",
};

const DOWNLOAD_URL =
  process.env.DOWNLOAD_URL?.trim() ||
  process.env.NEXT_PUBLIC_DOWNLOAD_URL?.trim() ||
  "/release/WhatsApp-AI-Desk-Setup-latest.exe";

export default async function DownloadPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const sp = await searchParams;
  const success = sp?.checkout === "success";

  return (
    <MarketingShell active="download">
      <main className="mx-auto max-w-2xl px-4 py-14 text-center">
        {success && (
          <div className="mb-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            Payment received — check your email for your license key, then download below.
          </div>
        )}
        <h1 className="text-3xl font-bold text-white">Download for Windows</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          One-click installer. No Node.js required. After install: enter your license key, then add your OpenRouter API key.
        </p>
        <a
          href={DOWNLOAD_URL}
          className="mt-8 inline-flex rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-8 py-3.5 text-sm font-semibold text-black shadow-lg hover:brightness-110"
        >
          Download WhatsApp AI Desk (Windows)
        </a>
        <ol className="mt-10 space-y-3 text-left text-sm text-zinc-400">
          <li>1. Install and open the app</li>
          <li>2. Paste license key from email</li>
          <li>3. Setup → API keys → OpenRouter → Save + Test</li>
          <li>4. Connect WhatsApp → Training → Inbox (Draft queue recommended)</li>
        </ol>
        <p className="mt-8 text-xs text-zinc-500">
          Need ffmpeg for voice notes: <code className="text-zinc-400">winget install Gyan.FFmpeg</code>
        </p>
        <p className="mt-4">
          <Link href="/support" className="text-sm text-emerald-400 hover:underline">
            Setup guide & support →
          </Link>
        </p>
      </main>
    </MarketingShell>
  );
}
