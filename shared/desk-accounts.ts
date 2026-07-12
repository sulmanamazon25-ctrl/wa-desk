import { z } from "zod";

/** Safe folder name under userData/wwebjs — letters, digits, underscore, hyphen; 1–32 chars. */
export const DESK_ACCOUNT_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$/;

export const DeskAccountSlotSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(DESK_ACCOUNT_ID_RE, "Use 1–32 chars: start with letter or digit, then letters, digits, _ or -"),
  label: z.string().max(40).default(""),
});

export const DeskAccountsStateSchema = z.object({
  slots: z.array(DeskAccountSlotSchema).length(2),
  activeId: z.string().trim().min(1),
});

export type DeskAccountSlot = z.infer<typeof DeskAccountSlotSchema>;
export type DeskAccountsState = z.infer<typeof DeskAccountsStateSchema>;

export function defaultDeskAccounts(): DeskAccountsState {
  return {
    slots: [
      { id: "default", label: "" },
      { id: "business", label: "" },
    ],
    activeId: "default",
  };
}

/** Ensures two slots (Personal + Business). One WhatsApp number per slot — same limits as WhatsApp linked devices. */
export function ensurePersonalBusinessSlots(state: DeskAccountsState): DeskAccountsState {
  let slots = state.slots
    .map((s) => ({ id: s.id.trim(), label: (s.label ?? "").trim() }))
    .filter((s) => DESK_ACCOUNT_ID_RE.test(s.id))
    .slice(0, 2);
  if (slots.length === 0) return defaultDeskAccounts();
  if (slots.length === 1) {
    const id = slots[0].id;
    const secondId = id === "business" ? "default" : "business";
    slots = [...slots, { id: secondId, label: "" }];
  }
  slots = slots.slice(0, 2);
  let activeId = state.activeId.trim() || slots[0].id;
  if (!slots.some((s) => s.id === activeId)) activeId = slots[0].id;
  return { slots, activeId };
}

export function normalizeDeskAccountsState(raw: DeskAccountsState): DeskAccountsState {
  const slots = raw.slots.map((s) => ({ id: s.id.trim(), label: (s.label ?? "").trim() }));
  const seen = new Set<string>();
  const deduped: DeskAccountSlot[] = [];
  for (const s of slots) {
    if (!DESK_ACCOUNT_ID_RE.test(s.id) || seen.has(s.id)) continue;
    seen.add(s.id);
    deduped.push(s);
  }
  if (deduped.length === 0) return defaultDeskAccounts();
  let activeId = raw.activeId.trim();
  if (!deduped.some((s) => s.id === activeId)) activeId = deduped[0].id;
  const padded = ensurePersonalBusinessSlots({ slots: deduped, activeId });
  return DeskAccountsStateSchema.parse(padded);
}

/** Load legacy JSON (1–3 slots) and normalize to exactly two slots. */
export function migrateDeskAccountsFromDisk(parsed: unknown): DeskAccountsState {
  const loose = z
    .object({
      slots: z.array(DeskAccountSlotSchema).default([]),
      activeId: z.string().default("default"),
    })
    .safeParse(parsed);
  if (!loose.success) return defaultDeskAccounts();
  return normalizeDeskAccountsState({ slots: loose.data.slots, activeId: loose.data.activeId });
}
