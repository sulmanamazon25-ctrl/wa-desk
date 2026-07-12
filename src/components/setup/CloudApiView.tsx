"use client";

import * as React from "react";
import type { SecretsFormModel, SecretsPatch } from "../../../shared/secrets";
import { MetaCloudEditor } from "@/components/setup/setup-forms";
import { useI18n } from "@/i18n/I18nContext";

export function CloudApiView({ isElectron }: { isElectron: boolean }) {
  const { t } = useI18n();
  const [form, setForm] = React.useState<SecretsFormModel | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isElectron || !window.desktop) return;
    void window.desktop.settings.load().then(setForm);
  }, [isElectron]);

  async function save(patch: SecretsPatch) {
    if (!window.desktop) return;
    setBusy(true);
    setMsg(null);
    try {
      const result = await window.desktop.settings.save(patch);
      if (!result.ok) {
        setMsg(result.error);
        return;
      }
      setMsg(t("keys.savedToast"));
      setForm(await window.desktop.settings.load());
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24 pt-2">
      <div>
        <h2 className="text-xl font-semibold text-white">{t("cloud.title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t("cloud.note")}</p>
      </div>
      {!isElectron && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {t("connect.electronOnly")}
        </div>
      )}
      {msg && <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-200">{msg}</div>}
      {!form && <div className="text-sm text-zinc-500">…</div>}
      {form && (
        <MetaCloudEditor
          form={form}
          busy={busy}
          onSave={save}
          onPatchField={(key, value) => setForm((f) => (f ? { ...f, [key]: value } as SecretsFormModel : f))}
          labels={{
            phoneId: t("cloud.phoneId"),
            wabaId: t("cloud.wabaId"),
            token: t("cloud.token"),
            verify: t("cloud.verify"),
            save: t("cloud.save"),
            saved: t("cloud.saved"),
            notSet: t("cloud.notSet"),
            clearSaved: t("keys.clearSaved"),
          }}
        />
      )}
    </div>
  );
}
