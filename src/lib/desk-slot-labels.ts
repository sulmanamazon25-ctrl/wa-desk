/** Labels for the two-desk pattern (Personal = `default`, Business = `business`). */
export function formatDeskSlotLabel(id: string, label: string | undefined, t: (key: string) => string): string {
  const L = (label ?? "").trim();
  if (L) return L;
  if (id === "default") return t("header.slotPersonal");
  if (id === "business") return t("header.slotBusiness");
  return id;
}
