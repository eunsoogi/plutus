import type { FormEvent } from "react";

import { useI18n } from "./i18n";

export type PositionFormState = {
  readonly averageCost: string;
  readonly costCurrency: string;
  readonly quantity: string;
  readonly symbol: string;
  readonly thesis: string;
};

export const emptyPositionForm: PositionFormState = {
  averageCost: "",
  costCurrency: "USD",
  quantity: "",
  symbol: "",
  thesis: "",
};

export function PositionEntryForm({
  addingPosition,
  form,
  onSubmit,
  onUpdate,
}: {
  addingPosition: boolean;
  form: PositionFormState;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: (field: keyof PositionFormState, value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <section className="panel">
      <h2>{t("portfolio.positionEntry")}</h2>
      <form className="portfolio-entry-form" onSubmit={onSubmit}>
        <label>
          <span>{t("portfolio.positionSymbol")}</span>
          <input
            aria-label={t("portfolio.positionSymbol")}
            value={form.symbol}
            onChange={(event) => onUpdate("symbol", event.currentTarget.value)}
          />
        </label>
        <label>
          <span>{t("portfolio.positionQuantity")}</span>
          <input
            aria-label={t("portfolio.positionQuantity")}
            inputMode="decimal"
            value={form.quantity}
            onChange={(event) =>
              onUpdate("quantity", event.currentTarget.value)
            }
          />
        </label>
        <label>
          <span>{t("portfolio.positionAverageCost")}</span>
          <input
            aria-label={t("portfolio.positionAverageCost")}
            inputMode="decimal"
            value={form.averageCost}
            onChange={(event) =>
              onUpdate("averageCost", event.currentTarget.value)
            }
          />
        </label>
        <label>
          <span>{t("portfolio.positionCostCurrency")}</span>
          <input
            aria-label={t("portfolio.positionCostCurrency")}
            maxLength={3}
            value={form.costCurrency}
            onChange={(event) =>
              onUpdate("costCurrency", event.currentTarget.value)
            }
          />
        </label>
        <label className="portfolio-entry-form__thesis">
          <span>{t("portfolio.positionThesisField")}</span>
          <textarea
            aria-label={t("portfolio.positionThesisField")}
            value={form.thesis}
            onChange={(event) => onUpdate("thesis", event.currentTarget.value)}
          />
        </label>
        <button className="primary" type="submit" disabled={addingPosition}>
          {addingPosition
            ? t("portfolio.addingPosition")
            : t("portfolio.addPosition")}
        </button>
      </form>
    </section>
  );
}
