CREATE TABLE IF NOT EXISTS local_profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES local_profiles(id),
  name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  base_currency TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS instruments (
  id TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL,
  canonical_symbol TEXT NOT NULL,
  display_symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  sector TEXT,
  category TEXT,
  market TEXT,
  region TEXT,
  currency TEXT NOT NULL,
  exchange TEXT,
  provider_refs TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolios (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES local_profiles(id),
  name TEXT NOT NULL,
  base_currency TEXT NOT NULL,
  benchmark_id TEXT,
  risk_profile TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL REFERENCES portfolios(id),
  account_id TEXT NOT NULL REFERENCES accounts(id),
  instrument_id TEXT NOT NULL REFERENCES instruments(id),
  quantity REAL NOT NULL,
  average_cost REAL NOT NULL,
  cost_currency TEXT NOT NULL,
  fees_total REAL NOT NULL,
  acquired_at TEXT,
  risk_bucket TEXT,
  tags TEXT NOT NULL,
  thesis TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watchlists (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES local_profiles(id),
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id TEXT PRIMARY KEY,
  watchlist_id TEXT NOT NULL REFERENCES watchlists(id),
  instrument_id TEXT NOT NULL REFERENCES instruments(id),
  trigger_note TEXT NOT NULL,
  target_zone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS research_runs (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES local_profiles(id),
  portfolio_id TEXT REFERENCES portfolios(id),
  status TEXT NOT NULL,
  user_request TEXT NOT NULL,
  selected_team TEXT NOT NULL,
  codex_thread_id TEXT,
  workspace_path TEXT NOT NULL,
  custom_agent_versions TEXT NOT NULL,
  local_tool_config_hash TEXT NOT NULL,
  model_config TEXT NOT NULL,
  recommendation_category TEXT,
  confidence TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  failure_reason TEXT
);

CREATE TABLE IF NOT EXISTS research_run_events (
  id TEXT PRIMARY KEY,
  research_run_id TEXT NOT NULL REFERENCES research_runs(id),
  sequence INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(research_run_id, sequence)
);

CREATE TABLE IF NOT EXISTS research_run_final_outputs (
  id TEXT PRIMARY KEY,
  research_run_id TEXT NOT NULL REFERENCES research_runs(id),
  summary TEXT NOT NULL,
  structured_output TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS local_job_queue (
  id TEXT PRIMARY KEY,
  research_run_id TEXT REFERENCES research_runs(id),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  available_at TEXT NOT NULL,
  locked_at TEXT,
  failure_reason TEXT
);

CREATE TABLE IF NOT EXISTS agent_artifacts (
  id TEXT PRIMARY KEY,
  research_run_id TEXT NOT NULL REFERENCES research_runs(id),
  artifact_type TEXT NOT NULL,
  title TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  metadata TEXT NOT NULL,
  created_by_agent TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS strategy_specs (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES local_profiles(id),
  research_run_id TEXT REFERENCES research_runs(id),
  name TEXT NOT NULL,
  asset_universe TEXT NOT NULL,
  time_range TEXT NOT NULL,
  entry_rules TEXT NOT NULL,
  exit_rules TEXT NOT NULL,
  position_sizing TEXT NOT NULL,
  risk_rules TEXT NOT NULL,
  required_data TEXT NOT NULL,
  benchmark_id TEXT,
  fee_assumption_bps REAL NOT NULL,
  slippage_assumption_bps REAL NOT NULL,
  engine_target TEXT NOT NULL,
  validation_plan TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backtest_runs (
  id TEXT PRIMARY KEY,
  strategy_spec_id TEXT NOT NULL REFERENCES strategy_specs(id),
  research_run_id TEXT REFERENCES research_runs(id),
  status TEXT NOT NULL,
  dataset_ref TEXT NOT NULL,
  assumptions TEXT NOT NULL,
  metrics TEXT NOT NULL,
  warnings TEXT NOT NULL,
  artifact_ids TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  failure_reason TEXT
);

CREATE TABLE IF NOT EXISTS memory_records (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES local_profiles(id),
  mem0_id TEXT,
  kind TEXT NOT NULL,
  summary TEXT NOT NULL,
  tags TEXT NOT NULL,
  source_refs TEXT NOT NULL,
  capture_policy TEXT NOT NULL,
  sensitivity_class TEXT NOT NULL,
  retention_class TEXT NOT NULL,
  status TEXT NOT NULL,
  last_recalled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS memory_activity (
  id TEXT PRIMARY KEY,
  memory_id TEXT REFERENCES memory_records(id),
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  research_run_id TEXT,
  audit_ref TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wiki_pages (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES local_profiles(id),
  slug TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  current_revision_id TEXT,
  tags TEXT NOT NULL,
  source_refs TEXT NOT NULL,
  memory_refs TEXT NOT NULL,
  freshness TEXT NOT NULL,
  confidence TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS wiki_revisions (
  id TEXT PRIMARY KEY,
  wiki_page_id TEXT NOT NULL REFERENCES wiki_pages(id),
  revision_number INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  revision_note TEXT NOT NULL,
  source_refs TEXT NOT NULL,
  contradiction_refs TEXT NOT NULL,
  created_by TEXT NOT NULL,
  audit_ref TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wiki_links (
  id TEXT PRIMARY KEY,
  from_wiki_page_id TEXT REFERENCES wiki_pages(id),
  to_wiki_page_id TEXT REFERENCES wiki_pages(id),
  link_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS remote_devices (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES local_profiles(id),
  device_name TEXT NOT NULL,
  device_platform TEXT NOT NULL,
  public_key TEXT NOT NULL,
  permissions TEXT NOT NULL,
  paired_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS remote_sessions (
  id TEXT PRIMARY KEY,
  remote_device_id TEXT NOT NULL REFERENCES remote_devices(id),
  status TEXT NOT NULL,
  host_address TEXT NOT NULL,
  session_key_ref TEXT NOT NULL,
  started_at TEXT NOT NULL,
  last_heartbeat_at TEXT,
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  profile_id TEXT,
  research_run_id TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS price_bars (
  id TEXT PRIMARY KEY,
  instrument_id TEXT NOT NULL REFERENCES instruments(id),
  provider TEXT NOT NULL,
  interval TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  timezone TEXT NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL,
  adjusted_close REAL,
  source_metadata TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_price_bars_unique
ON price_bars(instrument_id, provider, interval, timestamp);

CREATE TABLE IF NOT EXISTS quote_snapshots (
  id TEXT PRIMARY KEY,
  instrument_id TEXT NOT NULL REFERENCES instruments(id),
  provider TEXT NOT NULL,
  as_of TEXT NOT NULL,
  price REAL NOT NULL,
  currency TEXT NOT NULL,
  bid REAL,
  ask REAL,
  volume REAL,
  delay_status TEXT NOT NULL,
  warnings TEXT NOT NULL
);
