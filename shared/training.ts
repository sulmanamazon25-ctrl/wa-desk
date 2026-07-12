import { z } from "zod";

export const TrainingBundleSchema = z.object({
  faqs: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  /** Short, high-priority facts / tone / policies — shown first in the AI prompt (Business tab). */
  priorityContext: z.string().default(""),
  /** Plain-text reference files (name + excerpt) ingested from disk — Business tab. */
  referenceDocs: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        text: z.string(),
      }),
    )
    .default([]),
  businessInfo: z.string().default(""),
  pricing: z.string().default(""),
  services: z.string().default(""),
  bookingRules: z.string().default(""),
  customInstructions: z.string().default(""),
});

export type TrainingBundle = z.infer<typeof TrainingBundleSchema>;

const PROMPT_CHAR_CAP = 28_000;

export function bundleToPromptText(bundle: TrainingBundle): string {
  const faqBlock =
    bundle.faqs.length > 0
      ? "FAQs:\n" + bundle.faqs.map((f) => `- Q: ${f.q}\n  A: ${f.a}`).join("\n")
      : "";
  const priority = (bundle.priorityContext ?? "").trim();
  const priorityBlock = priority
    ? "PRIORITY — owner facts & voice (when anything below matches the customer's question, answer from this — do not guess or give generic bot filler):\n" +
      priority
    : "";
  const docs = bundle.referenceDocs ?? [];
  const docBlock =
    docs.length > 0
      ? docs
          .map((d) => {
            const body = (d.text ?? "").trim();
            if (!body) return "";
            return `### Reference file: ${d.name}\n${body}`;
          })
          .filter(Boolean)
          .join("\n\n")
      : "";
  const joined = [
    priorityBlock,
    docBlock,
    faqBlock,
    bundle.businessInfo && `Business:\n${bundle.businessInfo}`,
    bundle.pricing && `Pricing:\n${bundle.pricing}`,
    bundle.services && `Services:\n${bundle.services}`,
    bundle.bookingRules && `Booking rules:\n${bundle.bookingRules}`,
    bundle.customInstructions && `Custom instructions:\n${bundle.customInstructions}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  if (joined.length <= PROMPT_CHAR_CAP) return joined;
  return joined.slice(0, PROMPT_CHAR_CAP) + "\n\n[…truncated for model size — shorten files or priority text in Business.]";
}
