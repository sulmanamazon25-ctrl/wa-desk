import type { Metadata } from "next";
import { DashboardGateClient } from "./DashboardGateClient";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "WhatsApp AI Desk — inbox, connect up to three WhatsApp sessions, API keys, business context, and AI reply modes. Runs locally in Electron.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "WhatsApp AI Desk — Dashboard",
    description: "Local-first WhatsApp assistant: inbox, AI replies, keys, and business context.",
    type: "website",
  },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardGateClient>{children}</DashboardGateClient>;
}
