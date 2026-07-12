import { isLicensed } from "./license-store";
import { isTrialActive, getTrialEndsAt, trialDaysRemaining, ensureTrialStarted } from "./trial-store";

let adminConnectBypass = false;

export function setAdminConnectBypass(enabled: boolean): void {
  adminConnectBypass = enabled;
}

const gateDisabled = () => process.env.DESK_GATE_DISABLED === "1";

export async function canConnectWhatsApp(): Promise<boolean> {
  if (gateDisabled() || adminConnectBypass) return true;
  if (await isLicensed()) return true;
  if (await isTrialActive()) return true;
  return false;
}

export async function getConnectLicenseStatus(): Promise<{
  licensed: boolean;
  trialActive: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number;
  canConnect: boolean;
}> {
  await ensureTrialStarted();
  const licensed = await isLicensed();
  const trialActive = licensed ? false : await isTrialActive();
  const trialEndsAt = licensed ? null : await getTrialEndsAt();
  const trialDaysLeft = licensed ? 0 : await trialDaysRemaining();
  const canConnect = gateDisabled() || adminConnectBypass || licensed || trialActive;
  return { licensed, trialActive, trialEndsAt, trialDaysLeft, canConnect };
}
