import type { AppLocale } from "./core";
import { ModeControl, ProviderMatrix } from "./provider-settings-panels";
import { providerDisplayName } from "./provider-settings-copy";
import type {
  ProviderCredentialDraft,
  ProviderCredentialField,
} from "./provider-settings-credentials";
import type {
  ProviderMode,
  TradingProviderConfig,
} from "./provider-settings-types";

export function ProviderDetail({
  credentialDraft,
  credentialStorageRef,
  locale,
  mode,
  onCredentialDraft,
  onGenerate,
  onMode,
  onSave,
  onSubmit,
  provider,
  providerForMode,
  status,
  text,
}: {
  credentialDraft: ProviderCredentialDraft;
  credentialStorageRef: string;
  locale: AppLocale;
  mode: ProviderMode;
  onCredentialDraft: (field: ProviderCredentialField, value: string) => void;
  onGenerate: () => void;
  onMode: (mode: ProviderMode) => void;
  onSave: () => void;
  onSubmit: () => void;
  provider: TradingProviderConfig;
  providerForMode: TradingProviderConfig;
  status: string;
  text: Record<string, string>;
}) {
  return (
    <article className="panel provider-detail">
      <div className="provider-detail-heading">
        <span>{text.selected}</span>
        <strong data-testid="selected-provider-name">
          {providerDisplayName(
            provider.providerId,
            provider.displayName,
            locale,
          )}
        </strong>
      </div>
      <ProviderSetupGuide text={text} />
      <CredentialControl
        credentialDraft={credentialDraft}
        credentialStorageRef={credentialStorageRef}
        onCredentialDraft={onCredentialDraft}
        provider={provider}
        text={text}
      />
      <ModeControl mode={mode} onMode={onMode} text={text} />
      <ProviderMatrix
        provider={providerForMode}
        mode={mode}
        text={text}
        locale={locale}
      />
      <div className="provider-actions">
        <button onClick={onSave} type="button">
          {text.save}
        </button>
        <button
          data-testid="generate-provider-decision"
          onClick={onGenerate}
          type="button"
        >
          {text.generate}
        </button>
        <button
          data-testid="simulate-provider-preview"
          onClick={onSubmit}
          type="button"
        >
          {text.submit}
        </button>
      </div>
      <p className="preview-line" data-testid="provider-preview-status">
        {status}
      </p>
    </article>
  );
}

function ProviderSetupGuide({ text }: { text: Record<string, string> }) {
  return (
    <section
      className="provider-setup-guide"
      data-testid="provider-setup-guide"
    >
      <h2>{text.setupTitle}</h2>
      <ol>
        <li>{text.setupExchange}</li>
        <li>{text.setupCredential}</li>
        <li>{text.setupMode}</li>
      </ol>
    </section>
  );
}

function CredentialControl({
  credentialDraft,
  credentialStorageRef,
  onCredentialDraft,
  provider,
  text,
}: {
  credentialDraft: ProviderCredentialDraft;
  credentialStorageRef: string;
  onCredentialDraft: (field: ProviderCredentialField, value: string) => void;
  provider: TradingProviderConfig;
  text: Record<string, string>;
}) {
  const apiLabel =
    provider.providerId === "kiwoom"
      ? text.credentialAppKey
      : text.credentialApiKey;
  return (
    <section className="provider-credential-control">
      <div className="provider-credential-heading">
        <span>{text.credentialInput}</span>
        <code>{credentialStorageRef}</code>
      </div>
      <div className="provider-credential-grid">
        <CredentialField
          label={apiLabel}
          field="apiKey"
          testId="credential-api-key-input"
          type="text"
          value={credentialDraft.apiKey}
          onCredentialDraft={onCredentialDraft}
        />
        <CredentialField
          label={text.credentialSecret}
          field="secretKey"
          testId="credential-secret-input"
          type="password"
          value={credentialDraft.secretKey}
          onCredentialDraft={onCredentialDraft}
        />
        <CredentialField
          label={text.credentialPassphrase}
          field="passphrase"
          testId="credential-passphrase-input"
          type="password"
          value={credentialDraft.passphrase}
          onCredentialDraft={onCredentialDraft}
        />
        <CredentialField
          label={text.credentialAccount}
          field="accountId"
          testId="credential-account-input"
          type="text"
          value={credentialDraft.accountId}
          onCredentialDraft={onCredentialDraft}
        />
      </div>
      <small>{text.credentialHelp}</small>
    </section>
  );
}

function CredentialField({
  field,
  label,
  onCredentialDraft,
  testId,
  type,
  value,
}: {
  field: ProviderCredentialField;
  label: string;
  onCredentialDraft: (field: ProviderCredentialField, value: string) => void;
  testId: string;
  type: "password" | "text";
  value: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <input
        autoComplete="off"
        data-testid={testId}
        onChange={(event) =>
          onCredentialDraft(field, event.currentTarget.value)
        }
        type={type}
        value={value}
      />
    </label>
  );
}
