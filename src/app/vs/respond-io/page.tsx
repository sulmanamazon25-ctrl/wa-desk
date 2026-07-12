import type { Metadata } from "next";
import { VsComparePage } from "@/components/marketing/VsComparePage";
import { getVsPage } from "@/lib/marketing/vs-pages";

const slug = "respond-io" as const;
const data = getVsPage(slug);

export const metadata: Metadata = {
  title: `${data.title} · WhatsApp AI Desk`,
  description: data.subtitle,
};

export default function VsRespondIoPage() {
  return <VsComparePage slug={slug} />;
}
