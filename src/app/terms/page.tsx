import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { LegalDocument } from "@/components/marketing/LegalDocument";

export const metadata: Metadata = {
  title: "Terms of Service · WhatsApp AI Desk",
};

export default function TermsPage() {
  return (
    <MarketingShell>
      <LegalDocument title="Terms of Service" updated="July 2026">
        <p>
          These Terms govern your use of WhatsApp AI Desk software and related services (&quot;Service&quot;) provided by the
          operator of this website (&quot;we&quot;, &quot;us&quot;).
        </p>
        <h2>License grant</h2>
        <p>
          Upon payment (where applicable), we grant you a non-exclusive, non-transferable license to install and use the
          desktop application on the number of devices specified by your plan. You may not redistribute, resell, or
          sublicense the software except as expressly permitted in writing.
        </p>
        <h2>Subscriptions and renewal</h2>
        <p>
          Monthly and annual plans renew automatically until cancelled through the Stripe Customer Portal or by contacting
          support. Lifetime licenses are valid for the major version channel described at purchase.
        </p>
        <h2>Refunds</h2>
        <p>
          Unless required by applicable law, fees are non-refundable after license delivery. We may offer a 14-day goodwill
          refund for first-time Pro purchases at our discretion.
        </p>
        <h2>Bring your own key (BYOK)</h2>
        <p>
          AI features require your own OpenRouter (or compatible) API account. You are responsible for API spend, key
          security, and compliance with the AI provider&apos;s terms.
        </p>
        <h2>Disclaimer</h2>
        <p>
          The Service is provided &quot;as is&quot;. We do not guarantee uninterrupted WhatsApp connectivity. WhatsApp automation
          may violate Meta&apos;s terms — see Acceptable Use.
        </p>
        <h2>Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, our liability is limited to fees paid in the twelve months before the
          claim.
        </p>
        <h2>Contact</h2>
        <p>Questions: use the contact form on this site or the support email provided at purchase.</p>
      </LegalDocument>
    </MarketingShell>
  );
}
