import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LegalDocument } from "@/components/marketing/LegalDocument";

export const metadata: Metadata = {
  title: "Acceptable Use · WhatsApp AI Desk",
};

export default function AcceptableUsePage() {
  return (
    <MarketingShell>
      <LegalDocument title="Acceptable Use Policy" updated="July 2026">
        <p>By using WhatsApp AI Desk you agree to use it responsibly and lawfully.</p>
        <h2>WhatsApp unofficial API</h2>
        <p>
          This product uses <strong>whatsapp-web.js</strong>, which is <em>not</em> an official WhatsApp Business API
          integration. Meta may restrict or ban accounts that automate consumer WhatsApp in ways that violate their Terms
          of Service. <strong>You are solely responsible</strong> for compliance, consent, opt-outs, and regional messaging
          laws (GDPR, CAN-SPAM, etc.).
        </p>
        <h2>Recommended practices</h2>
        <ul>
          <li>Use a dedicated business phone number, not your personal account.</li>
          <li>Start in <strong>Draft queue</strong> mode; review AI suggestions before sending.</li>
          <li>Disclose to customers when AI assists replies where required by law.</li>
          <li>Do not use the tool for spam, harassment, illegal content, or impersonation.</li>
        </ul>
        <h2>Prohibited uses</h2>
        <ul>
          <li>Bulk unsolicited messaging or purchased lead lists without consent.</li>
          <li>Automating accounts you do not own or have authority to operate.</li>
          <li>Circumventing license or activation limits.</li>
        </ul>
        <h2>Enforcement</h2>
        <p>We may revoke licenses for abuse. We are not liable for account bans imposed by Meta or carriers.</p>
      </LegalDocument>
    </MarketingShell>
  );
}
