import { formatWaChatId as formatWaChatIdShared } from "../../shared/format-wa-id";

export function formatWaChatId(chatId: string): string {
  return formatWaChatIdShared(chatId);
}

export function looksLikeWaId(title: string, chatId: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (t === chatId) return true;
  if (t.includes("@c.us") || t.includes("@g.us")) return true;
  const digitsOnly = t.replace(/\D/g, "");
  const idDigits = chatId.replace(/\D/g, "");
  return digitsOnly.length >= 8 && digitsOnly === idDigits;
}

export function threadInitials(title: string): string {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return "?";
}
