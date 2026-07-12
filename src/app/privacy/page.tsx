import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LegalDocument } from "@/components/marketing/LegalDocument";

export const metadata: Metadata = {
  title: "Privacy Policy · WhatsApp AI Desk",
};

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <LegalDocument title="Privacy Policy" updated="July 2026">
        <p>We respect your privacy. This policy describes what we collect when you buy or contact us about WhatsApp AI Desk.</p>
        <h2>Desktop application (local)</h2>
        <ul>
          <li>WhatsApp session data, chat history used for AI context, and API keys are stored on your PC (Electron userData).</li>
          <li>We do not receive your WhatsApp messages or OpenRouter keys unless you explicitly send them to us for support.</li>
        </ul>
        <h2>Our server (license & billing)</h2>
        <ul>
          <li>Email address, license key hash, plan, Stripe session id, activation machine id, and expiry metadata.</li>
          <li>Payment processing is handled by Stripe; we do not store full card numbers.</li>
        </ul>
        <h2>Contact form</h2>
        <p>Name, email, and message content are emailed to our inbox via Resend for sales and support.</p>
        <h2>Analytics & chat</h2>
        <p>
          Marketing pages may load Crisp chat when configured. You can disable third-party scripts by not visiting the
          marketing site from the desktop app.
        </p>
        <h2>Retention</h2>
        <p>License records are kept for billing, fraud prevention, and support. You may request deletion where law allows.</p>
        <h2>Your rights</h2>
        <p>Depending on your region you may have access, correction, or deletion rights. Contact us to exercise them.</p>
      </LegalDocument>
    </MarketingShell>
  );
}
