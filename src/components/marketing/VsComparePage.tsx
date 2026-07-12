import Link from "next/link";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { ComparisonTable } from "@/components/marketing/ComparisonTable";
import { CheckoutButton } from "@/components/marketing/CheckoutButton";
import { getVsPage, type VsSlug } from "@/lib/marketing/vs-pages";

export function VsComparePage({ slug }: { slug: VsSlug }) {
  const data = getVsPage(slug);

  return (
    <MarketingShell>
      <main className="mx-auto max-w-4xl px-4 py-14">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400/90">Compare</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{data.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">{data.subtitle}</p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <h2 className="text-sm font-semibold text-emerald-400">WhatsApp AI Desk is for</h2>
            <p className="mt-2 text-sm text-zinc-400">{data.whoDesk}</p>
          </article>
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <h2 className="text-sm font-semibold text-zinc-300">{data.competitor} is for</h2>
            <p className="mt-2 text-sm text-zinc-400">{data.whoThem}</p>
          </article>
        </div>

        <div className="mt-10">
          <ComparisonTable rows={data.rows} competitorName={data.competitor} />
        </div>

        <p className="mt-6 text-sm text-zinc-500">{data.pricingNote}</p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <h2 className="font-semibold text-zinc-200">Choose {data.competitor} if…</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-400">
              {data.chooseThem.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-zinc-600">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
          <article className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <h2 className="font-semibold text-emerald-200">Choose WhatsApp AI Desk if…</h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-300">
              {data.chooseDesk.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-emerald-500">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/download"
            className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-6 py-3 text-sm font-semibold text-black hover:brightness-110"
          >
            Download for Windows
          </Link>
          <CheckoutButton
            plan="pro"
            label="Buy Pro — $29/mo"
            className="rounded-xl border border-white/15 bg-white/[0.06] px-6 py-3 text-sm font-semibold text-white hover:bg-white/[0.1]"
          />
          <Link href="/how-it-works" className="rounded-xl px-6 py-3 text-sm font-semibold text-emerald-400 hover:underline">
            How it works →
          </Link>
        </div>

        <p className="mt-12 text-xs text-zinc-600">
          Comparison based on publicly listed product positioning. Not affiliated with {data.competitor}. Features and
          pricing change — verify on their site before purchasing.
        </p>
      </main>
    </MarketingShell>
  );
}
