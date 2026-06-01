import { DecisionPanel, PayloadPanel } from "./provider-settings-panels";
import type {
  DryRunOrderResult,
  OrderSide,
  OrderType,
  TradingDecision,
} from "./provider-settings-types";

export function ProviderWorkbench(props: {
  decision: TradingDecision | undefined;
  limitPrice: string;
  order: DryRunOrderResult | undefined;
  orderType: OrderType;
  quantity: string;
  quoteCurrency: string;
  rationale: string;
  side: OrderSide;
  symbol: string;
  text: Record<string, string>;
  setLimitPrice: (value: string) => void;
  setOrderType: (value: OrderType) => void;
  setQuantity: (value: string) => void;
  setQuoteCurrency: (value: string) => void;
  setRationale: (value: string) => void;
  setSide: (value: OrderSide) => void;
  setSymbol: (value: string) => void;
}) {
  return (
    <section className="provider-layout provider-workbench">
      <article className="panel provider-detail">
        <h2>{props.text.composer}</h2>
        <div className="provider-form-grid">
          <TextInput
            label={props.text.symbol}
            value={props.symbol}
            onChange={props.setSymbol}
          />
          <SelectInput
            label={props.text.side}
            value={props.side}
            options={[
              ["buy", props.text.buy],
              ["sell", props.text.sell],
            ]}
            onChange={(value) => props.setSide(value as OrderSide)}
          />
          <SelectInput
            label={props.text.orderType}
            value={props.orderType}
            options={[
              ["market", props.text.marketOrder],
              ["limit", props.text.limitOrder],
            ]}
            onChange={(value) => props.setOrderType(value as OrderType)}
          />
          <TextInput
            inputMode="decimal"
            label={props.text.quantity}
            value={props.quantity}
            onChange={props.setQuantity}
          />
          <TextInput
            inputMode="decimal"
            label={props.text.limitPrice}
            value={props.limitPrice}
            onChange={props.setLimitPrice}
          />
          <TextInput
            label={props.text.quoteCurrency}
            value={props.quoteCurrency}
            onChange={props.setQuoteCurrency}
          />
        </div>
        <label className="provider-rationale">
          <span>{props.text.rationale}</span>
          <textarea
            onChange={(event) => props.setRationale(event.currentTarget.value)}
            placeholder={props.text.rationalePlaceholder}
            value={props.rationale}
          />
        </label>
      </article>
      <article className="panel provider-detail">
        <PayloadPanel order={props.order} title={props.text.payload} />
        <DecisionPanel
          decision={props.decision}
          text={props.text}
          title={props.text.decision}
        />
      </article>
    </section>
  );
}

function TextInput(props: {
  inputMode?: "decimal";
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{props.label}</span>
      <input
        inputMode={props.inputMode}
        onChange={(event) => props.onChange(event.currentTarget.value)}
        value={props.value}
      />
    </label>
  );
}

function SelectInput(props: {
  label: string;
  value: string;
  options: readonly [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{props.label}</span>
      <select
        onChange={(event) => props.onChange(event.currentTarget.value)}
        value={props.value}
      >
        {props.options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
