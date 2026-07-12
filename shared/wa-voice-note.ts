/** Shared voice-note detection for Electron (wwebjs) and the Next.js UI. */

export type VoiceNoteDetect = {
  type: string | undefined | unknown;
  hasMedia: boolean;
  /** Optional filename from WhatsApp (when type is `audio`). */
  filename?: string;
};

/**
 * True for WhatsApp voice notes: usually `ptt`, sometimes `voice`, rarely `audio` (short clip / ogg).
 */
export function isVoiceNoteMessage(d: VoiceNoteDetect): boolean {
  const raw = String(d.type ?? "")
    .trim()
    .toLowerCase();
  if (raw === "ptt" || raw === "voice") return true;
  if (raw === "audio") {
    if (!d.hasMedia) return false;
    const fn = (d.filename ?? "").trim();
    if (!fn) return true;
    if (/\.(ogg|opus|oga)$/i.test(fn)) return true;
  }
  return false;
}
