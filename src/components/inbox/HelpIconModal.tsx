"use client";

import { useEffect, useId, useRef } from "react";

type HelpIconModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** One or more paragraphs */
  paragraphs: string[];
  variant: "info" | "error";
  closeLabel: string;
};

/**
 * Accessible modal for help text or errors (icon in parent opens this).
 */
export function HelpIconModal({ open, onClose, title, paragraphs, variant, closeLabel }: HelpIconModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("button")?.focus(), 10);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const ring = variant === "error" ? "border-rose-500/35 shadow-rose-900/20" : "border-white/[0.12] shadow-black/40";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`max-h-[min(80vh,520px)] w-full max-w-md overflow-y-auto rounded-2xl border bg-[#0c1016] p-4 shadow-xl ${ring}`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-sm font-semibold text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
          >
            ×
          </button>
        </div>
        <div className="mt-3 space-y-3 text-xs leading-relaxed text-zinc-300">
          {paragraphs.filter((p) => p.trim().length > 0).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
              variant === "error"
                ? "bg-rose-500/90 text-white hover:bg-rose-400"
                : "border border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.1]"
            }`}
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type HintIconButtonProps = {
  onClick: () => void;
  "aria-label": string;
  title: string;
  /** Emerald / cyan / amber / rose */
  accent: "emerald" | "cyan" | "amber" | "rose";
  /** Info glyph vs alert */
  glyph: "info" | "alert";
  /** Unread-style dot (e.g. error seen but message still present) */
  showBadge?: boolean;
};

const accentRing: Record<HintIconButtonProps["accent"], string> = {
  emerald: "border-emerald-500/35 text-emerald-200/95 hover:border-emerald-400/55 hover:bg-emerald-500/10",
  cyan: "border-cyan-500/35 text-cyan-200/95 hover:border-cyan-400/55 hover:bg-cyan-500/10",
  amber: "border-amber-500/35 text-amber-200/95 hover:border-amber-400/55 hover:bg-amber-500/10",
  rose: "border-rose-500/40 text-rose-200/95 hover:border-rose-400/55 hover:bg-rose-500/10",
};

export function HintIconButton({ onClick, "aria-label": ariaLabel, title, accent, glyph, showBadge }: HintIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-black/35 transition ${accentRing[accent]}`}
    >
      {glyph === "info" ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
          <path stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" d="M12 10v5M12 7h.01" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
          <path
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
            d="M12 9v4M12 17h.01M10.3 3.6h3.4L21 17.5a1 1 0 0 1-.9 1.5H3.9a1 1 0 0 1-.9-1.5L10.3 3.6Z"
          />
        </svg>
      )}
      {showBadge ? (
        <span
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-[#070a0e] bg-rose-400"
          aria-hidden
        />
      ) : null}
    </button>
  );
}
