//! Credential vault for Phase 2 — OS keyring preferred, memory fallback.
//!
//! Set `PVG_VAULT_BACKEND=memory` for tests / CI without a secret service.

use chrono::Utc;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::sync::Arc;
use thiserror::Error;

pub const SESSION_REFRESH_KEY: &str = "session.refresh";
pub const KEYRING_SERVICE: &str = "ai.pvg.desktop";

#[derive(Debug, Error)]
pub enum VaultError {
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("vault error: {0}")]
    Vault(String),
}

pub type VaultResult<T> = Result<T, VaultError>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CredentialMetadata {
    pub key_id: String,
    pub label: String,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub backend: String,
    pub locked: bool,
    pub entry_count: usize,
}

pub trait CredentialVault: Send + Sync {
    fn store(&self, key_id: &str, secret: &str, label: &str) -> VaultResult<()>;
    fn get(&self, key_id: &str) -> VaultResult<Option<String>>;
    fn delete(&self, key_id: &str) -> VaultResult<bool>;
    fn has(&self, key_id: &str) -> VaultResult<bool>;
    fn list_metadata(&self) -> VaultResult<Vec<CredentialMetadata>>;
    fn backend_name(&self) -> &'static str;
    fn lock(&self) -> VaultResult<()> {
        Ok(())
    }
    fn is_locked(&self) -> bool {
        false
    }
}

#[derive(Default)]
struct MemoryInner {
    secrets: HashMap<String, String>,
    meta: HashMap<String, CredentialMetadata>,
    locked: bool,
}

#[derive(Clone, Default)]
pub struct MemoryCredentialVault {
    inner: Arc<RwLock<MemoryInner>>,
}

impl MemoryCredentialVault {
    pub fn new() -> Self {
        Self::default()
    }
}

impl CredentialVault for MemoryCredentialVault {
    fn store(&self, key_id: &str, secret: &str, label: &str) -> VaultResult<()> {
        validate_key(key_id)?;
        if secret.is_empty() {
            return Err(VaultError::Vault("secret must not be empty".into()));
        }
        let mut guard = self.inner.write();
        if guard.locked {
            return Err(VaultError::Vault("vault is locked".into()));
        }
        guard.secrets.insert(key_id.to_string(), secret.to_string());
        guard.meta.insert(
            key_id.to_string(),
            CredentialMetadata {
                key_id: key_id.to_string(),
                label: label.to_string(),
                updated_at_ms: Utc::now().timestamp_millis(),
            },
        );
        Ok(())
    }

    fn get(&self, key_id: &str) -> VaultResult<Option<String>> {
        validate_key(key_id)?;
        let guard = self.inner.read();
        if guard.locked {
            return Err(VaultError::Vault("vault is locked".into()));
        }
        Ok(guard.secrets.get(key_id).cloned())
    }

    fn delete(&self, key_id: &str) -> VaultResult<bool> {
        validate_key(key_id)?;
        let mut guard = self.inner.write();
        if guard.locked {
            return Err(VaultError::Vault("vault is locked".into()));
        }
        guard.meta.remove(key_id);
        Ok(guard.secrets.remove(key_id).is_some())
    }

    fn has(&self, key_id: &str) -> VaultResult<bool> {
        validate_key(key_id)?;
        Ok(self.inner.read().secrets.contains_key(key_id))
    }

    fn list_metadata(&self) -> VaultResult<Vec<CredentialMetadata>> {
        let mut items: Vec<_> = self.inner.read().meta.values().cloned().collect();
        items.sort_by(|a, b| a.key_id.cmp(&b.key_id));
        Ok(items)
    }

    fn backend_name(&self) -> &'static str {
        "memory"
    }

    fn lock(&self) -> VaultResult<()> {
        self.inner.write().locked = true;
        Ok(())
    }

    fn is_locked(&self) -> bool {
        self.inner.read().locked
    }
}

pub struct KeyringCredentialVault {
    meta: Arc<RwLock<HashMap<String, CredentialMetadata>>>,
    locked: Arc<RwLock<bool>>,
}

impl KeyringCredentialVault {
    pub fn new() -> Self {
        Self {
            meta: Arc::new(RwLock::new(HashMap::new())),
            locked: Arc::new(RwLock::new(false)),
        }
    }

    fn entry(key_id: &str) -> keyring::Entry {
        keyring::Entry::new(KEYRING_SERVICE, key_id).expect("keyring entry construction")
    }
}

impl Default for KeyringCredentialVault {
    fn default() -> Self {
        Self::new()
    }
}

impl CredentialVault for KeyringCredentialVault {
    fn store(&self, key_id: &str, secret: &str, label: &str) -> VaultResult<()> {
        validate_key(key_id)?;
        if secret.is_empty() {
            return Err(VaultError::Vault("secret must not be empty".into()));
        }
        if *self.locked.read() {
            return Err(VaultError::Vault("vault is locked".into()));
        }
        Self::entry(key_id)
            .set_password(secret)
            .map_err(|e| VaultError::Vault(format!("keyring store failed: {e}")))?;
        self.meta.write().insert(
            key_id.to_string(),
            CredentialMetadata {
                key_id: key_id.to_string(),
                label: label.to_string(),
                updated_at_ms: Utc::now().timestamp_millis(),
            },
        );
        Ok(())
    }

    fn get(&self, key_id: &str) -> VaultResult<Option<String>> {
        validate_key(key_id)?;
        if *self.locked.read() {
            return Err(VaultError::Vault("vault is locked".into()));
        }
        match Self::entry(key_id).get_password() {
            Ok(secret) => Ok(Some(secret)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(VaultError::Vault(format!("keyring get failed: {e}"))),
        }
    }

    fn delete(&self, key_id: &str) -> VaultResult<bool> {
        validate_key(key_id)?;
        if *self.locked.read() {
            return Err(VaultError::Vault("vault is locked".into()));
        }
        self.meta.write().remove(key_id);
        match Self::entry(key_id).delete_credential() {
            Ok(()) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(e) => Err(VaultError::Vault(format!("keyring delete failed: {e}"))),
        }
    }

    fn has(&self, key_id: &str) -> VaultResult<bool> {
        validate_key(key_id)?;
        match Self::entry(key_id).get_password() {
            Ok(_) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(e) => Err(VaultError::Vault(format!("keyring has failed: {e}"))),
        }
    }

    fn list_metadata(&self) -> VaultResult<Vec<CredentialMetadata>> {
        let mut items: Vec<_> = self.meta.read().values().cloned().collect();
        items.sort_by(|a, b| a.key_id.cmp(&b.key_id));
        Ok(items)
    }

    fn backend_name(&self) -> &'static str {
        "keyring"
    }

    fn lock(&self) -> VaultResult<()> {
        *self.locked.write() = true;
        Ok(())
    }

    fn is_locked(&self) -> bool {
        *self.locked.read()
    }
}

pub fn validate_key(key_id: &str) -> VaultResult<()> {
    let trimmed = key_id.trim();
    if trimmed.is_empty() || trimmed.len() > 128 {
        return Err(VaultError::InvalidInput(
            "key_id must be 1..=128 characters".into(),
        ));
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.')
    {
        return Err(VaultError::InvalidInput(
            "key_id has illegal characters".into(),
        ));
    }
    Ok(())
}

pub fn validate_provider_key(provider: &str) -> VaultResult<String> {
    let trimmed = provider.trim().to_ascii_lowercase();
    if trimmed.is_empty() || trimmed.len() > 64 {
        return Err(VaultError::InvalidInput(
            "provider must be 1..=64 characters".into(),
        ));
    }
    if !trimmed
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err(VaultError::InvalidInput(
            "provider has illegal characters".into(),
        ));
    }
    let key_id = format!("provider.{trimmed}");
    validate_key(&key_id)?;
    Ok(key_id)
}

pub fn create_vault() -> Arc<dyn CredentialVault> {
    let backend = env::var("PVG_VAULT_BACKEND")
        .unwrap_or_default()
        .to_ascii_lowercase();
    if backend == "memory" || cfg!(test) {
        Arc::new(MemoryCredentialVault::new())
    } else {
        Arc::new(KeyringCredentialVault::new())
    }
}

pub fn vault_status(vault: &dyn CredentialVault) -> VaultResult<VaultStatus> {
    let meta = vault.list_metadata()?;
    Ok(VaultStatus {
        backend: vault.backend_name().to_string(),
        locked: vault.is_locked(),
        entry_count: meta.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn memory_vault_round_trip_metadata_only_list() {
        let vault = MemoryCredentialVault::new();
        vault
            .store("api.token", "super-secret", "API token")
            .unwrap();
        assert!(vault.has("api.token").unwrap());
        assert_eq!(
            vault.get("api.token").unwrap().as_deref(),
            Some("super-secret")
        );
        let meta = vault.list_metadata().unwrap();
        assert_eq!(meta.len(), 1);
        assert_eq!(meta[0].key_id, "api.token");
        let json = serde_json::to_string(&meta[0]).unwrap();
        assert!(!json.contains("super-secret"));
        assert!(vault.delete("api.token").unwrap());
        assert!(!vault.has("api.token").unwrap());
    }

    #[test]
    fn rejects_bad_key_ids() {
        let vault = MemoryCredentialVault::new();
        assert!(vault.store("", "x", "l").is_err());
        assert!(vault.store("bad/key", "x", "l").is_err());
        assert!(validate_key("ok.key-1_2").is_ok());
        assert!(validate_key("bad key").is_err());
        assert!(validate_key(&"a".repeat(129)).is_err());
    }

    #[test]
    fn provider_key_validation() {
        assert_eq!(
            validate_provider_key("ElevenLabs").unwrap(),
            "provider.elevenlabs"
        );
        assert!(validate_provider_key("bad/prov").is_err());
        assert!(validate_provider_key("").is_err());
    }

    #[test]
    fn session_refresh_helpers() {
        let vault = MemoryCredentialVault::new();
        vault
            .store(SESSION_REFRESH_KEY, "refresh-secret", "Session refresh")
            .unwrap();
        assert!(vault.has(SESSION_REFRESH_KEY).unwrap());
        vault.delete(SESSION_REFRESH_KEY).unwrap();
        assert!(!vault.has(SESSION_REFRESH_KEY).unwrap());
    }

    #[test]
    fn lock_blocks_secret_access() {
        let vault = MemoryCredentialVault::new();
        vault.store("a.b", "secret", "A").unwrap();
        vault.lock().unwrap();
        assert!(vault.is_locked());
        assert!(vault.get("a.b").is_err());
    }

    #[test]
    fn create_vault_uses_memory_in_tests() {
        assert_eq!(create_vault().backend_name(), "memory");
    }
}
