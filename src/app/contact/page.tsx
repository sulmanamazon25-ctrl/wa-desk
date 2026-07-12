"use client";

import * as React from "react";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { apiUrl } from "@/lib/api-origin";

export default function ContactPage() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [plan, setPlan] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [ok, setOk] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = q.get("plan");
    if (p) setPlan(p);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(apiUrl("/api/contact"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, plan }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setErr(data.error || "Could not send message");
        return;
      }
      setOk(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <MarketingShell active="contact">
      <main className="mx-auto max-w-xl px-4 py-14">
        <h1 className="text-3xl font-bold text-white">Contact sales & support</h1>
        <p className="mt-3 text-sm text-zinc-400">BYOK, annual quotes, reseller, or technical help.</p>

        {ok ? (
          <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-sm text-emerald-100">
            Message sent. We will reply to <strong>{email}</strong> shortly.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <label className="block text-sm">
              <span className="text-zinc-500">Name</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">Email</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">Plan interest (optional)</span>
              <input
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-white"
              />
            </label>
            <label className="block text-sm">
              <span className="text-zinc-500">Message</span>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-white"
              />
            </label>
            {err && <p className="text-sm text-rose-300">{err}</p>}
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-6 py-3 text-sm font-semibold text-black disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send message"}
            </button>
          </form>
        )}

        <p className="mt-8 text-sm text-zinc-500">
          Already a customer? See <Link href="/support" className="text-emerald-400 hover:underline">Support</Link>.
        </p>
      </main>
    </MarketingShell>
  );
}
