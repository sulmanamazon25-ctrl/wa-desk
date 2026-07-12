import { PILLARS } from "@/lib/marketing/positioning";

export function PositioningPillars({ title = "Why operators choose the desk" }: { title?: string }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <h2 className="text-center text-2xl font-semibold text-white">{title}</h2>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {PILLARS.map((p) => (
          <article
            key={p.id}
            className="rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/5 to-transparent p-6"
          >
            <h3 className="font-semibold text-emerald-300">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{p.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
