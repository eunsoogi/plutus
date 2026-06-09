import type { providerSettingsCopy } from "./provider-settings-copy";

type ProviderSettingsText = (typeof providerSettingsCopy)["en"];

export function ProviderSettingsHeader({
  text,
}: {
  text: ProviderSettingsText;
}) {
  return (
    <header className="page-header provider-header">
      <h1>{text.title}</h1>
      <p>{text.subtitle}</p>
      <div className="pill-row" aria-label={text.safety}>
        <span className="pill">{text.readOnly}</span>
        <span className="pill">{text.dryRunOnly}</span>
        <span className="pill">{text.killSwitch}</span>
      </div>
    </header>
  );
}
