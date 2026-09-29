//! Re-export vault from `pvg-vault` and map errors into AppError.

use crate::errors::{AppError, AppResult};

pub use pvg_vault::{
    create_vault, validate_key, validate_provider_key, vault_status, CredentialMetadata,
    CredentialVault, KeyringCredentialVault, MemoryCredentialVault, VaultStatus,
    SESSION_REFRESH_KEY,
};

pub type VaultEntryMeta = CredentialMetadata;

pub fn map_vault_err(err: pvg_vault::VaultError) -> AppError {
    match err {
        pvg_vault::VaultError::InvalidInput(m) => AppError::InvalidInput(m),
        pvg_vault::VaultError::Vault(m) => AppError::Vault(m),
    }
}

pub fn validate_key_app(key_id: &str) -> AppResult<()> {
    validate_key(key_id).map_err(map_vault_err)
}

pub fn validate_provider_key_app(provider: &str) -> AppResult<String> {
    validate_provider_key(provider).map_err(map_vault_err)
}
