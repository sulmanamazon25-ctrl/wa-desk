"use client";

import * as React from "react";
import { apiUrl } from "@/lib/api-origin";

export function CheckoutButton({
  plan,
  label,
  className = "",
}: {
  plan: "pro" | "business" | "lifetime";
  label: string;
  className?: string;
}) {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(apiUrl("/api/stripe/checkout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setErr(data.error || "Checkout unavailable");
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={buy}
        className={className}
      >
        {busy ? "Redirecting…" : label}
      </button>
      {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
    </div>
  );
}
