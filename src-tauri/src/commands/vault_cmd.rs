//! Narrow vault IPC — Phase 2.
//!
//! Allowed: save/get/delete/has provider credentials, list metadata (no secrets),
//! store/clear session refresh, vault status/lock.
//! Forbidden: run_any_command, dump_all_secrets, unrestricted FS.

use crate::errors::{to_invoke_error, AppError};
use crate::security::{
    map_vault_err, validate_provider_key, vault_status, CredentialMetadata, VaultStatus,
    SESSION_REFRESH_KEY,
};
use crate::state::AppState;
use serde::Deserialize;
use tauri::State;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderKeyInput {
    pub provider: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProviderCredentialInput {
    pub provider: String,
    pub secret: String,
    pub label: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreSessionRefreshInput {
    pub refresh_token: String,
}

fn map_err(err: pvg_vault::VaultError) -> String {
    to_invoke_error(map_vault_err(err))
}

#[tauri::command]
pub fn save_provider_credential(
    state: State<'_, AppState>,
    input: SaveProviderCredentialInput,
) -> Result<(), String> {
    let key_id = validate_provider_key(&input.provider).map_err(map_err)?;
    let label = input
        .label
        .unwrap_or_else(|| format!("Provider {}", input.provider));
    state
        .vault
        .store(&key_id, &input.secret, &label)
        .map_err(map_err)
}

#[tauri::command]
pub fn get_provider_credential(
    state: State<'_, AppState>,
    input: ProviderKeyInput,
) -> Result<Option<String>, String> {
    let key_id = validate_provider_key(&input.provider).map_err(map_err)?;
    state.vault.get(&key_id).map_err(map_err)
}

#[tauri::command]
pub fn delete_provider_credential(
    state: State<'_, AppState>,
    input: ProviderKeyInput,
) -> Result<bool, String> {
    let key_id = validate_provider_key(&input.provider).map_err(map_err)?;
    state.vault.delete(&key_id).map_err(map_err)
}

#[tauri::command]
pub fn has_provider_credential(
    state: State<'_, AppState>,
    input: ProviderKeyInput,
) -> Result<bool, String> {
    let key_id = validate_provider_key(&input.provider).map_err(map_err)?;
    state.vault.has(&key_id).map_err(map_err)
}

#[tauri::command]
pub fn list_provider_metadata(
    state: State<'_, AppState>,
) -> Result<Vec<CredentialMetadata>, String> {
    let all = state.vault.list_metadata().map_err(map_err)?;
    Ok(all
        .into_iter()
        .filter(|m| m.key_id.starts_with("provider."))
        .collect())
}

#[tauri::command]
pub fn store_session_refresh(
    state: State<'_, AppState>,
    input: StoreSessionRefreshInput,
) -> Result<(), String> {
    if input.refresh_token.is_empty() {
        return Err(to_invoke_error(AppError::InvalidInput(
            "refresh_token must not be empty".into(),
        )));
    }
    state
        .vault
        .store(SESSION_REFRESH_KEY, &input.refresh_token, "Session refresh")
        .map_err(map_err)
}

#[tauri::command]
pub fn clear_session_refresh(state: State<'_, AppState>) -> Result<bool, String> {
    state.vault.delete(SESSION_REFRESH_KEY).map_err(map_err)
}

#[tauri::command]
pub fn vault_status_cmd(state: State<'_, AppState>) -> Result<VaultStatus, String> {
    vault_status(state.vault.as_ref()).map_err(map_err)
}

#[tauri::command]
pub fn vault_lock(state: State<'_, AppState>) -> Result<(), String> {
    state.vault.lock().map_err(map_err)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultKeyInput {
    pub key_id: String,
}

#[tauri::command]
pub fn vault_has_credential(
    state: State<'_, AppState>,
    input: VaultKeyInput,
) -> Result<bool, String> {
    state.vault.has(&input.key_id).map_err(map_err)
}

#[tauri::command]
pub fn vault_list_metadata(
    state: State<'_, AppState>,
) -> Result<Vec<CredentialMetadata>, String> {
    state.vault.list_metadata().map_err(map_err)
}
