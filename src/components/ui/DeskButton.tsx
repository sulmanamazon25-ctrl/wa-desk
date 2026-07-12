import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function DeskButton({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40";
  const variants: Record<Variant, string> = {
    primary: "bg-gradient-to-r from-emerald-400 to-teal-500 text-black shadow-md shadow-emerald-500/15 hover:brightness-110",
    secondary: "border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]",
    ghost: "border border-white/10 text-zinc-300 hover:bg-white/[0.06] hover:text-white",
    danger: "border border-rose-500/35 text-rose-200 hover:bg-rose-500/10",
  };
  return (
    <button type="button" className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
