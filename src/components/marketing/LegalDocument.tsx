export function LegalDocument({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-bold text-white">{title}</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: {updated}</p>
      <article className="prose prose-invert prose-sm mt-10 max-w-none prose-headings:text-white prose-p:text-zinc-400 prose-li:text-zinc-400 prose-strong:text-zinc-200">
        {children}
      </article>
    </main>
  );
}
