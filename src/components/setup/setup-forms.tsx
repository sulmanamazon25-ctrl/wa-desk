"use client";

import * as React from "react";
import type { ReactNode } from "react";
import type { ApiKeysTestResponse } from "../../../electron/ipc-contract";
import type { SecretsFormModel, SecretsPatch } from "../../../shared/secrets";

export type FormValueKey = Exclude<keyof SecretsFormModel, "configured">;

export const DEFAULT_API_MODELS = {
  openrouterChat: "google/gemini-2.5-flash",
  openrouterStt: "openai/whisper-large-v3-turbo",
  xaiChat: "grok-3",
  xaiStt: "grok-stt",
  groqChat: "llama-3.3-70b-versatile",
  groqWhisper: "whisper-large-v3-turbo",
} as const;

export function buildKeysPatch(form: SecretsFormModel): SecretsPatch {
  const p: SecretsPatch = {
    openrouterChatModel: form.openrouterChatModel.trim() || DEFAULT_API_MODELS.openrouterChat,
    openrouterSttModel: form.openrouterSttModel.trim() || DEFAULT_API_MODELS.openrouterStt,
    xaiChatModel: form.xaiChatModel.trim() || DEFAULT_API_MODELS.xaiChat,
    xaiSttModel: form.xaiSttModel.trim() || DEFAULT_API_MODELS.xaiStt,
    groqModel: form.groqModel.trim() || DEFAULT_API_MODELS.groqChat,
    whisperModel: form.whisperModel.trim() || DEFAULT_API_MODELS.groqWhisper,
  };
  if (form.openrouterApiKey.trim()) p.openrouterApiKey = form.openrouterApiKey.trim();
  if (form.xaiApiKey.trim()) p.xaiApiKey = form.xaiApiKey.trim();
  if (form.groqApiKey.trim()) p.groqApiKey = form.groqApiKey.trim();
  return p;
}

export function GhostBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.08]"
    >
      {children}
    </button>
  );
}

export function KeysEditor({
  form,
  busy,
  testBusy,
  testResult,
  onSave,
  onTest,
  onPatchField,
  labels,
}: {
  form: SecretsFormModel;
  busy: boolean;
  testBusy?: boolean;
  testResult?: ApiKeysTestResponse | null;
  onSave: (p: SecretsPatch) => void;
  onTest?: (p: SecretsPatch) => void;
  onPatchField: (key: FormValueKey, value: string) => void;
  labels: {
    intro: string;
    save: string;
    test: string;
    openrouterKey: string;
    openrouterChatModel: string;
    openrouterSttModel: string;
    openrouterVoiceHint: string;
    legacyToggle: string;
    legacyHint: string;
    xaiKey: string;
    xaiModel: string;
    xaiSttModel: string;
    xaiVoiceHint: string;
    groqKey: string;
    groqModel: string;
    groqWhisperModel: string;
    savedReplace: string;
    notSet: string;
    clearSaved: string;
    groqOptionalHint: string;
    testSummaryPass: string;
    testSummaryFail: string;
    requiredBadge: string;
    optionalBadge: string;
  };
}) {
  const [legacyOpen, setLegacyOpen] = React.useState(false);
  const patch = () => buildKeysPatch(form);
  const disabled = busy || Boolean(testBusy);

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-zinc-400">{labels.intro}</p>

      <SecretRow
        label={labels.openrouterKey}
        hint={form.configured.openrouterApiKey ? labels.savedReplace : labels.notSet}
        value={form.openrouterApiKey}
        onChange={(v) => onPatchField("openrouterApiKey", v)}
        onClear={() => onSave({ openrouterApiKey: null })}
        clearLabel={labels.clearSaved}
        busy={disabled}
        required
      />

      <ModelField
        label={labels.openrouterChatModel}
        value={form.openrouterChatModel}
        placeholder={DEFAULT_API_MODELS.openrouterChat}
        onChange={(v) => onPatchField("openrouterChatModel", v)}
      />

      <p className="text-xs font-medium text-emerald-400/90">{labels.openrouterVoiceHint}</p>
      <ModelField
        label={labels.openrouterSttModel}
        value={form.openrouterSttModel}
        placeholder={DEFAULT_API_MODELS.openrouterStt}
        onChange={(v) => onPatchField("openrouterSttModel", v)}
      />

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
        <button
          type="button"
          onClick={() => setLegacyOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-zinc-300 transition hover:bg-white/[0.04]"
        >
          <span>{labels.legacyToggle}</span>
          <span className="text-xs text-zinc-500">{legacyOpen ? "−" : "+"}</span>
        </button>
        {legacyOpen && (
          <div className="space-y-4 border-t border-white/[0.06] px-4 pb-4 pt-3">
            <p className="text-xs leading-relaxed text-zinc-500">{labels.legacyHint}</p>

            <SecretRow
              label={labels.xaiKey}
              hint={form.configured.xaiApiKey ? labels.savedReplace : labels.notSet}
              value={form.xaiApiKey}
              onChange={(v) => onPatchField("xaiApiKey", v)}
              onClear={() => onSave({ xaiApiKey: null })}
              clearLabel={labels.clearSaved}
              busy={disabled}
            />

            <ModelField
              label={labels.xaiModel}
              value={form.xaiChatModel}
              placeholder={DEFAULT_API_MODELS.xaiChat}
              onChange={(v) => onPatchField("xaiChatModel", v)}
            />

            <p className="text-xs text-zinc-500">{labels.xaiVoiceHint}</p>
            <ModelField
              label={labels.xaiSttModel}
              value={form.xaiSttModel}
              placeholder={DEFAULT_API_MODELS.xaiStt}
              onChange={(v) => onPatchField("xaiSttModel", v)}
            />

            <p className="text-xs leading-relaxed text-zinc-500">{labels.groqOptionalHint}</p>

            <SecretRow
              label={labels.groqKey}
              hint={form.configured.groqApiKey ? labels.savedReplace : labels.notSet}
              value={form.groqApiKey}
              onChange={(v) => onPatchField("groqApiKey", v)}
              onClear={() => onSave({ groqApiKey: null })}
              clearLabel={labels.clearSaved}
              busy={disabled}
            />

            <ModelField
              label={labels.groqModel}
              value={form.groqModel}
              placeholder={DEFAULT_API_MODELS.groqChat}
              onChange={(v) => onPatchField("groqModel", v)}
            />
            <ModelField
              label={labels.groqWhisperModel}
              value={form.whisperModel}
              placeholder={DEFAULT_API_MODELS.groqWhisper}
              onChange={(v) => onPatchField("whisperModel", v)}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSave(patch())}
          className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-40"
        >
          {labels.save}
        </button>
        {onTest && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onTest(patch())}
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-40"
          >
            {labels.test}
          </button>
        )}
      </div>

      {testResult && (
        <ApiKeysTestPanel
          result={testResult}
          labels={{
            pass: labels.testSummaryPass,
            fail: labels.testSummaryFail,
            required: labels.requiredBadge,
            optional: labels.optionalBadge,
          }}
        />
      )}
    </div>
  );
}

function ApiKeysTestPanel({
  result,
  labels,
}: {
  result: ApiKeysTestResponse;
  labels: { pass: string; fail: string; required: string; optional: string };
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        result.ok ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10"
      }`}
    >
      <p className={`text-sm font-medium ${result.ok ? "text-emerald-100" : "text-rose-100"}`}>
        {result.ok ? labels.pass : labels.fail}
      </p>
      <p className="mt-1 text-xs text-zinc-300">{result.summary}</p>
      <ul className="mt-3 space-y-2">
        {result.checks.map((c) => (
          <li
            key={c.id}
            className={`rounded-xl border px-3 py-2 text-xs ${
              c.ok ? "border-emerald-500/20 bg-black/20 text-emerald-50" : "border-rose-500/25 bg-black/25 text-rose-50"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{c.ok ? "✓" : "✗"}</span>
              <span className="font-medium">{c.label}</span>
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                {c.required ? labels.required : labels.optional}
              </span>
            </div>
            <p className="mt-1 leading-relaxed text-zinc-400">{c.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MetaCloudEditor({
  form,
  busy,
  onSave,
  onPatchField,
  labels,
}: {
  form: SecretsFormModel;
  busy: boolean;
  onSave: (p: SecretsPatch) => void;
  onPatchField: (key: FormValueKey, value: string) => void;
  labels: {
    phoneId: string;
    wabaId: string;
    token: string;
    verify: string;
    save: string;
    saved: string;
    notSet: string;
    clearSaved: string;
  };
}) {
  const build = (): SecretsPatch => {
    const p: SecretsPatch = {};
    if (form.metaWaPhoneNumberId.trim()) p.metaWaPhoneNumberId = form.metaWaPhoneNumberId.trim();
    if (form.metaWaBusinessAccountId.trim()) p.metaWaBusinessAccountId = form.metaWaBusinessAccountId.trim();
    if (form.metaWaAccessToken.trim()) p.metaWaAccessToken = form.metaWaAccessToken.trim();
    if (form.metaWaVerifyToken.trim()) p.metaWaVerifyToken = form.metaWaVerifyToken.trim();
    return p;
  };

  return (
    <div className="space-y-4">
      <Field label={labels.phoneId} value={form.metaWaPhoneNumberId} onChange={(v) => onPatchField("metaWaPhoneNumberId", v)} />
      <Field label={labels.wabaId} value={form.metaWaBusinessAccountId} onChange={(v) => onPatchField("metaWaBusinessAccountId", v)} />
      <SecretRow
        label={labels.token}
        hint={form.configured.metaWaAccessToken ? labels.saved : labels.notSet}
        value={form.metaWaAccessToken}
        onChange={(v) => onPatchField("metaWaAccessToken", v)}
        onClear={() => onSave({ metaWaAccessToken: null })}
        clearLabel={labels.clearSaved}
        busy={busy}
      />
      <SecretRow
        label={labels.verify}
        hint={form.configured.metaWaVerifyToken ? labels.saved : labels.notSet}
        value={form.metaWaVerifyToken}
        onChange={(v) => onPatchField("metaWaVerifyToken", v)}
        onClear={() => onSave({ metaWaVerifyToken: null })}
        clearLabel={labels.clearSaved}
        busy={busy}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => onSave(build())}
        className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08] disabled:opacity-40"
      >
        {labels.save}
      </button>
    </div>
  );
}

export function ModelField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-black/50 px-3 py-2.5 text-sm text-white outline-none ring-emerald-500/20 transition placeholder:text-zinc-600 focus:ring-2"
      />
    </label>
  );
}

export function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-white/[0.08] bg-black/50 px-3 py-2.5 text-sm text-white outline-none ring-emerald-500/20 transition focus:ring-2"
      />
    </label>
  );
}

export function SecretRow({
  label,
  hint,
  value,
  onChange,
  onClear,
  busy,
  clearLabel,
  required,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  busy: boolean;
  clearLabel: string;
  required?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-white">
          {label}
          {required ? <span className="ml-1 text-rose-400/90">*</span> : null}
        </span>
        <span className="text-[11px] text-zinc-500">{hint}</span>
      </div>
      <input
        type="password"
        autoComplete="new-password"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={busy}
        placeholder="••••••••"
        className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/50 px-3 py-2.5 text-sm text-white outline-none disabled:opacity-50"
      />
      <button
        type="button"
        disabled={busy}
        onClick={onClear}
        className="mt-2 text-xs text-rose-300/90 hover:underline disabled:opacity-40"
      >
        {clearLabel}
      </button>
    </div>
  );
}
