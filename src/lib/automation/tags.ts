export type LeadTag = "new" | "qualified" | "booked" | "dnd";

export type LeadNote = {
  id: string;
  chatId: string;
  tag: LeadTag;
  note: string;
  updatedAt: number;
};

/** CRM-like notes stored client-side for now; migrate to Supabase `lead_notes` later. */
export function loadLeadNotes(): LeadNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("lead_notes_v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LeadNote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function upsertLeadNote(note: LeadNote) {
  const all = loadLeadNotes().filter((n) => n.id !== note.id);
  all.push(note);
  window.localStorage.setItem("lead_notes_v1", JSON.stringify(all));
}
