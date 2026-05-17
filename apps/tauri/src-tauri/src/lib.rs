pub mod audit;
pub mod commands;
pub mod remote_control;
pub mod remote_transport;
pub mod secure_store;
pub mod security;
pub mod storage;

use tauri::Manager;

use crate::commands::AppState;
use crate::storage::{AppDataPaths, PlutusDatabase};

pub fn registered_command_names() -> &'static [&'static str] {
    &[
        "list_portfolios",
        "create_portfolio",
        "get_portfolio_snapshot",
        "add_portfolio_position",
        "update_portfolio_position",
        "update_position_thesis",
        "list_watchlists",
        "create_watchlist",
        "add_watchlist_item",
        "update_watchlist_item",
        "start_research_run",
        "get_research_run",
        "cancel_research_run",
        "append_run_event",
        "persist_final_output",
        "enqueue_local_job",
        "write_artifact_file",
        "get_artifact",
        "open_local_artifact_file",
        "list_memory_activity",
        "update_memory",
        "archive_memory",
        "forget_memory",
        "set_memory_category_enabled",
        "list_wiki_pages",
        "get_wiki_page",
        "list_wiki_activity",
        "revert_wiki_revision",
        "pair_remote_device",
        "revoke_remote_device",
        "list_remote_devices",
        "execute_remote_command",
    ]
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let paths = AppDataPaths::create(app_data_dir)?;
            let mut db = PlutusDatabase::open(&paths.database)?;
            db.seed_mvp()?;
            app.manage(AppState::new(db, paths));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_portfolios,
            commands::create_portfolio,
            commands::get_portfolio_snapshot,
            commands::add_portfolio_position,
            commands::update_portfolio_position,
            commands::update_position_thesis,
            commands::list_watchlists,
            commands::create_watchlist,
            commands::add_watchlist_item,
            commands::update_watchlist_item,
            commands::start_research_run,
            commands::get_research_run,
            commands::cancel_research_run,
            commands::append_run_event,
            commands::persist_final_output,
            commands::enqueue_local_job,
            commands::write_artifact_file,
            commands::get_artifact,
            commands::open_local_artifact_file,
            commands::list_memory_activity,
            commands::update_memory,
            commands::archive_memory,
            commands::forget_memory,
            commands::set_memory_category_enabled,
            commands::list_wiki_pages,
            commands::get_wiki_page,
            commands::list_wiki_activity,
            commands::revert_wiki_revision,
            commands::pair_remote_device,
            commands::revoke_remote_device,
            commands::list_remote_devices,
            commands::execute_remote_command,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Plutus Tauri app");
}

#[cfg(test)]
mod tests {
    #[test]
    fn registers_product_tauri_commands() {
        let commands = crate::registered_command_names();
        for command in [
            "list_portfolios",
            "create_portfolio",
            "get_portfolio_snapshot",
            "add_portfolio_position",
            "update_portfolio_position",
            "update_position_thesis",
            "start_research_run",
            "append_run_event",
            "persist_final_output",
            "enqueue_local_job",
            "write_artifact_file",
            "get_artifact",
            "open_local_artifact_file",
            "cancel_research_run",
            "create_watchlist",
            "add_watchlist_item",
            "update_watchlist_item",
            "list_memory_activity",
            "update_memory",
            "archive_memory",
            "forget_memory",
            "set_memory_category_enabled",
            "list_wiki_pages",
            "get_wiki_page",
            "list_wiki_activity",
            "revert_wiki_revision",
            "pair_remote_device",
            "revoke_remote_device",
            "list_remote_devices",
            "execute_remote_command",
        ] {
            assert!(commands.contains(&command), "missing command {command}");
        }
    }
}
