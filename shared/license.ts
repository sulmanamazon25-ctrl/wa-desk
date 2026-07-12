export type LicensePlan = "trial" | "pro" | "business" | "lifetime";

export type LicenseActivateRequest = {
  licenseKey: string;
  machineId: string;
};

export type LicenseActivateResponse =
  | {
      ok: true;
      token: string;
      plan: LicensePlan;
      email: string;
      expiresAt: string | null;
    }
  | { ok: false; error: string };

export type LicenseStatus = {
  licensed: boolean;
  plan?: LicensePlan;
  email?: string;
  expiresAt?: string | null;
  machineId?: string;
};

export type LicenseConnectStatus = {
  licensed: boolean;
  trialActive: boolean;
  trialEndsAt: string | null;
  trialDaysLeft: number;
  canConnect: boolean;
};

export type WaStartResponse =
  | { ok: true }
  | { ok: false; error: string; trialExpired?: boolean; licenseRequired?: boolean };

export type StoredLicense = {
  token: string;
  licenseKey: string;
  plan: LicensePlan;
  email: string;
  expiresAt: string | null;
  machineId: string;
  activatedAt: string;
};
