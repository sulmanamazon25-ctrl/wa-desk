"use client";

import * as React from "react";
import type { ApiKeysTestResponse } from "../../../electron/ipc-contract";
import type { SecretsFormModel, SecretsPatch } from "../../../shared/secrets";
import { KeysEditor } from "@/components/setup/setup-forms";
import { useI18n } from "@/i18n/I18nContext";

export function ApiKeysView({ isElectron }: { isElectron: boolean }) {
  const { t } = useI18n();
  const [form, setForm] = React.useState<SecretsFormModel | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [testBusy, setTestBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [testResult, setTestResult] = React.useState<ApiKeysTestResponse | null>(null);

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

  async function test(patch: SecretsPatch) {
    if (!window.desktop) return;
    setTestBusy(true);
    setMsg(null);
    try {
      const result = await window.desktop.settings.testKeys(patch);
      setTestResult(result);
    } catch (e) {
      setTestResult({
        ok: false,
        checks: [],
        summary: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24 pt-2">
      <div>
        <h2 className="text-xl font-semibold text-white">{t("keys.title")}</h2>
        <p className="mt-1 text-sm text-zinc-500">{t("keys.sub")}</p>
      </div>
      {!isElectron && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {t("connect.electronOnly")}
        </div>
      )}
      {msg && <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-200">{msg}</div>}
      {!form && <div className="text-sm text-zinc-500">…</div>}
      {form && (
        <KeysEditor
          form={form}
          busy={busy}
          testBusy={testBusy}
          testResult={testResult}
          onSave={save}
          onTest={test}
          onPatchField={(key, value) => setForm((f) => (f ? { ...f, [key]: value } as SecretsFormModel : f))}
          labels={{
            intro: t("keys.intro"),
            save: t("keys.save"),
            test: t("keys.test"),
            openrouterKey: t("keys.openrouterKey"),
            openrouterChatModel: t("keys.openrouterChatModel"),
            openrouterSttModel: t("keys.openrouterSttModel"),
            openrouterVoiceHint: t("keys.openrouterVoiceHint"),
            legacyToggle: t("keys.legacyToggle"),
            legacyHint: t("keys.legacyHint"),
            xaiKey: t("keys.xaiKey"),
            xaiModel: t("keys.xaiModel"),
            xaiSttModel: t("keys.xaiSttModel"),
            xaiVoiceHint: t("keys.xaiVoiceHint"),
            groqKey: t("keys.groqKey"),
            groqModel: t("keys.groqModel"),
            groqWhisperModel: t("keys.groqWhisperModel"),
            savedReplace: t("keys.savedReplace"),
            notSet: t("keys.notSet"),
            clearSaved: t("keys.clearSaved"),
            groqOptionalHint: t("keys.groqOptionalHint"),
            testSummaryPass: t("keys.testSummaryPass"),
            testSummaryFail: t("keys.testSummaryFail"),
            requiredBadge: t("keys.requiredBadge"),
            optionalBadge: t("keys.optionalBadge"),
          }}
        />
      )}
    </div>
  );
}
