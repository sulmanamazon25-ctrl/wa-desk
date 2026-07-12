import Link from "next/link";
import { CrispChat } from "@/components/marketing/CrispChat";

export function MarketingShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: "pricing" | "contact" | "download" | "support";
}) {
  const link = (href: string, label: string, key: string) => (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active === key ? "bg-emerald-500/20 text-emerald-200" : "text-zinc-400 hover:text-white"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-[#05080c] text-zinc-100">
      <CrispChat />
      <header className="border-b border-white/[0.06] bg-black/40 px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-semibold text-emerald-400 hover:text-emerald-300">
            WhatsApp AI Desk
          </Link>
          <nav className="flex flex-wrap items-center gap-1">
            {link("/pricing", "Pricing", "pricing")}
            {link("/download", "Download", "download")}
            {link("/support", "Support", "support")}
            {link("/contact", "Contact", "contact")}
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-white/[0.06] px-4 py-8 text-center text-xs text-zinc-500">
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/terms" className="hover:text-zinc-300">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-zinc-300">
            Privacy
          </Link>
          <Link href="/acceptable-use" className="hover:text-zinc-300">
            Acceptable use
          </Link>
        </div>
        <p className="mt-3">© {new Date().getFullYear()} WhatsApp AI Desk · Local-first desktop assistant</p>
      </footer>
    </div>
  );
}
