mod commands;
mod diagnostics;
mod errors;
mod filesystem;
mod project;
mod security;
mod state;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            commands::project_cmd::create_project,
            commands::project_cmd::open_project,
            commands::project_cmd::load_project_document,
            commands::project_cmd::read_project_metadata,
            commands::project_cmd::save_project,
            commands::project_cmd::list_workspace_projects,
            commands::project_cmd::rename_project,
            commands::project_cmd::duplicate_project,
            commands::project_cmd::trash_project,
            commands::project_cmd::restore_project,
            commands::project_cmd::delete_project_permanent,
            commands::project_cmd::list_trashed_projects,
            commands::project_cmd::generate_project_thumbnail,
            commands::workspace_cmd::ensure_local_workspace,
            commands::diagnostics_cmd::get_diagnostics,
            commands::vault_cmd::vault_has_credential,
            commands::vault_cmd::vault_list_metadata,
            commands::vault_cmd::save_provider_credential,
            commands::vault_cmd::get_provider_credential,
            commands::vault_cmd::delete_provider_credential,
            commands::vault_cmd::has_provider_credential,
            commands::vault_cmd::list_provider_metadata,
            commands::vault_cmd::store_session_refresh,
            commands::vault_cmd::get_session_refresh,
            commands::vault_cmd::clear_session_refresh,
            commands::vault_cmd::vault_status_cmd,
            commands::vault_cmd::vault_lock,
            commands::progress::emit_progress_stub,
            // Phase 3 media
            commands::media_cmd::media_probe,
            commands::media_cmd::media_import,
            commands::media_cmd::media_list_assets,
            commands::media_cmd::media_remove_asset,
            commands::media_cmd::media_relink_asset,
            commands::media_cmd::media_generate_thumbnail,
            commands::media_cmd::media_generate_waveform,
            commands::media_cmd::media_generate_proxy,
            commands::media_cmd::media_list_jobs,
            commands::media_cmd::media_cancel_job,
            commands::media_cmd::media_storage_summary,
            commands::media_cmd::media_engine_status,
            commands::media_cmd::media_resolve_preview,
            commands::media_cmd::media_export_sequence,
            // Autosave / recovery
            commands::recovery_cmd::project_write_autosave,
            commands::recovery_cmd::project_list_recovery,
            commands::recovery_cmd::project_restore_autosave,
        ])
        .setup(|app| {
            let state = app.state::<AppState>();
            state
                .bootstrap_roots()
                .map_err(|e| -> Box<dyn std::error::Error> { e.to_string().into() })?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running PVG AI");
}
