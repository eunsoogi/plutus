# Plutus PRD: Market Data And Portfolio Management

## 1. Objective

Provide a reliable data and portfolio foundation for stocks and crypto so agents can reason over the user's actual holdings, watchlists, strategies, and market context.

## 2. Asset Coverage

MVP asset classes:

- US-listed stocks and ETFs.
- Major crypto spot pairs.
- Stablecoins as portfolio assets.
- Cash balances by currency.

Post-MVP asset classes:

- Korean equities.
- Hong Kong equities.
- Options.
- Futures and forex.
- On-chain wallet positions.

## 3. Market Data Requirements

The data layer must support:

- Symbol search and canonical instrument identity.
- OHLCV candles with interval and timezone normalization.
- Latest quote and data freshness timestamp.
- Corporate actions for equities where provider supports them.
- Fundamentals for equities in post-MVP or premium mode.
- Crypto exchange price and volume data.
- Data-provider failover strategy.
- Data freshness warnings when data is delayed, missing, or provider-derived.

## 4. Suggested Providers

MVP free/low-friction providers:

- Yahoo Finance-compatible provider for US equities and ETFs.
- CoinGecko for crypto metadata and broad market data.
- CCXT for exchange-specific crypto OHLCV where API access is available.

Production/premium provider options:

- Polygon.io or Tiingo for equities.
- Finnhub or Financial Modeling Prep for fundamentals/news.
- CoinMarketCap, Kaiko, or CryptoCompare for crypto market data.
- Broker read-only integrations after security review.

## 5. Portfolio Requirements

Users must be able to:

- Create multiple portfolios.
- Add stock, ETF, crypto, stablecoin, and cash positions.
- Record cost basis, quantity, fees, currency, and acquisition date.
- Group positions by account, strategy, tag, or thesis.
- Track allocation by asset, sector/category, currency, and risk bucket.
- See portfolio performance over selectable periods.
- Compare portfolio performance with benchmarks such as SPY, QQQ, BTC, ETH, or a custom blend.
- Save notes and thesis updates per position.

## 6. Watchlist Requirements

Users must be able to:

- Create watchlists.
- Add instruments by symbol search.
- Attach trigger notes and target zones.
- Ask agents to monitor watchlist changes manually through research runs.
- See recent agent research linked to each instrument.

## 7. Data Model Requirements

Core entities:

- User.
- Account.
- Portfolio.
- Position.
- Instrument.
- PriceBar.
- QuoteSnapshot.
- Watchlist.
- WatchlistItem.
- ResearchRun.
- AgentArtifact.
- StrategySpec.
- BacktestRun.

## 8. Acceptance Criteria

- User can create a portfolio containing AAPL, NVDA, BTC, ETH, USDC, and USD cash.
- User can ask for allocation by asset class and receive a table plus risk notes.
- User can ask for a BTC/NVDA correlation check and receive a data freshness warning if provider data is stale.
- User can open the same portfolio state from macOS and mobile.
