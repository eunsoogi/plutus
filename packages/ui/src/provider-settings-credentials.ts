import {
  defaultCredentialRef,
  fallbackProviders,
} from "./provider-settings-types";
import type {
  ProviderId,
  TradingProviderConfig,
} from "./provider-settings-types";

export type ProviderCredentialDraft = {
  readonly apiKey: string;
  readonly secretKey: string;
  readonly passphrase: string;
  readonly accountId: string;
};

export type ProviderCredentialField = keyof ProviderCredentialDraft;

export const emptyCredentialDraft: ProviderCredentialDraft = {
  apiKey: "",
  secretKey: "",
  passphrase: "",
  accountId: "",
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Command failed";
}

export function selectProvider(
  providers: readonly TradingProviderConfig[],
  selectedId: ProviderId,
): TradingProviderConfig {
  return (
    providers.find((provider) => provider.providerId === selectedId) ??
    fallbackProviders[0]
  );
}

export function updateCredentialDraft(
  draft: ProviderCredentialDraft,
  field: ProviderCredentialField,
  value: string,
): ProviderCredentialDraft {
  return {
    ...draft,
    [field]: value,
  };
}

export function credentialRefFromInput(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function credentialDraftHasValues(
  draft: ProviderCredentialDraft,
): boolean {
  return (
    draft.apiKey.trim().length > 0 ||
    draft.secretKey.trim().length > 0 ||
    draft.passphrase.trim().length > 0 ||
    draft.accountId.trim().length > 0
  );
}

export function providerCredentialRef(
  providerId: ProviderId,
  draft: ProviderCredentialDraft,
  existingRef: string,
): string | null {
  if (credentialDraftHasValues(draft)) return defaultCredentialRef(providerId);
  return credentialRefFromInput(existingRef);
}
