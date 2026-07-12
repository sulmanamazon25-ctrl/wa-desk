import type { Metadata } from "next";
import { VsComparePage } from "@/components/marketing/VsComparePage";
import { getVsPage } from "@/lib/marketing/vs-pages";

const slug = "wati" as const;
const data = getVsPage(slug);

export const metadata: Metadata = {
  title: `${data.title} · WhatsApp AI Desk`,
  description: data.subtitle,
};

export default function VsWatiPage() {
  return <VsComparePage slug={slug} />;
}
