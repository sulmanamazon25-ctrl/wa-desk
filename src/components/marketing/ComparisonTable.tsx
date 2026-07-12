type Cell = { ok: boolean; text: string };

export type ComparisonRow = {
  feature: string;
  desk: Cell;
  them: Cell;
};

export function ComparisonTable({
  rows,
  competitorName,
}: {
  rows: ComparisonRow[];
  competitorName: string;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.03]">
            <th className="px-4 py-3 text-left font-semibold text-zinc-400">Feature</th>
            <th className="px-4 py-3 text-left font-semibold text-emerald-400">WhatsApp AI Desk</th>
            <th className="px-4 py-3 text-left font-semibold text-zinc-300">{competitorName}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.feature} className="border-b border-white/[0.06] last:border-0">
              <td className="px-4 py-3 text-zinc-300">{row.feature}</td>
              <td className="px-4 py-3">
                <CompareCell {...row.desk} />
              </td>
              <td className="px-4 py-3">
                <CompareCell {...row.them} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareCell({ ok, text }: Cell) {
  return (
    <span className="flex items-start gap-2 text-zinc-400">
      <span className={`mt-0.5 shrink-0 ${ok ? "text-emerald-400" : "text-zinc-600"}`}>
        {ok ? "✓" : "—"}
      </span>
      <span>{text}</span>
    </span>
  );
}
