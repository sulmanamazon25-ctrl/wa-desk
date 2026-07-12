"use client";

import Link from "next/link";
import { TrainingPanel } from "@/components/inbox/TrainingPanel";
import { useIsElectron } from "@/hooks/use-desktop";

export default function TrainingPage() {
  const isElectron = useIsElectron();
  return (
    <div className="min-h-screen bg-surface">
      <header className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">
          ← Back to inbox
        </Link>
        <div className="text-sm font-semibold text-white">Business training</div>
        <span />
      </header>
      <TrainingPanel isElectron={isElectron} />
    </div>
  );
}
