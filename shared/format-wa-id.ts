/** Strip WhatsApp JID suffix and format digits for display. */
export function formatWaChatId(chatId: string): string {
  const raw = chatId.replace(/@c\.us|@g\.us|@lid\b/gi, "").trim();
  if (!raw) return chatId;
  if (chatId.endsWith("@g.us")) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return raw;
  if (digits.startsWith("92") && digits.length >= 12) {
    return `+92 ${digits.slice(2, 5)} ${digits.slice(5)}`.trim();
  }
  if (digits.length >= 10) {
    return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10, -7)} ${digits.slice(-7)}`.trim();
  }
  return `+${digits}`;
}
