mod app_memory_remote;
mod app_state;
mod artifacts;
mod deterministic_completion;
mod final_output;
mod inputs;
mod memory;
mod portfolio;
mod portfolio_helpers;
mod post_run;
mod provider_holdings;
mod run_lifecycle;
mod runtime;
mod snapshot_memory_wiki;
mod snapshots;
pub mod trading;
mod trading_catalog;
mod trading_payload;
mod trading_provider_config;
mod trading_provider_sync;
mod trading_provider_sync_metadata;
#[cfg(test)]
mod trading_provider_sync_tests;
mod trading_types;
mod validation;
mod wiki;

#[cfg(test)]
mod tests;

pub use app_memory_remote::*;
pub use app_state::*;
pub use inputs::*;
pub use runtime::{CodexRuntimeBridge, CodexRuntimeStart, CodexRuntimeStarted};

use crate::storage::{AppDataPaths, PlutusDatabase};

pub struct PlutusCommands<'a> {
    pub db: &'a PlutusDatabase,
    pub paths: Option<&'a AppDataPaths>,
    pub runtime_bridge: CodexRuntimeBridge,
}

impl<'a> PlutusCommands<'a> {
    pub fn new(db: &'a PlutusDatabase) -> Self {
        Self {
            db,
            paths: None,
            runtime_bridge: CodexRuntimeBridge::default(),
        }
    }

    pub fn new_with_paths(db: &'a PlutusDatabase, paths: &'a AppDataPaths) -> Self {
        Self {
            db,
            paths: Some(paths),
            runtime_bridge: CodexRuntimeBridge::default(),
        }
    }
}
