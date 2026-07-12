export function billingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

export function stripePriceId(plan: string): string | undefined {
  const map: Record<string, string | undefined> = {
    pro: process.env.STRIPE_PRICE_PRO_MONTHLY?.trim(),
    business: process.env.STRIPE_PRICE_BUSINESS_YEARLY?.trim(),
    lifetime: process.env.STRIPE_PRICE_LIFETIME?.trim(),
  };
  return map[plan];
}

export function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function downloadUrl(): string {
  return process.env.DOWNLOAD_URL?.trim() || `${appOrigin()}/download`;
}
