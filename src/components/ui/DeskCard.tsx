import type { ReactNode } from "react";

export function DeskCard({
  children,
  className = "",
  title,
  subtitle,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className={`desk-card rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 ${className}`}>
      {title ? <h3 className="text-sm font-semibold text-white">{title}</h3> : null}
      {subtitle ? <p className="mt-1 text-xs leading-relaxed text-zinc-500">{subtitle}</p> : null}
      {title || subtitle ? <div className="mt-4">{children}</div> : children}
    </div>
  );
}
