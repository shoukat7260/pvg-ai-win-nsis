use serde::Serialize;
use std::env;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsReport {
    pub app_name: String,
    pub app_version: String,
    pub phase: String,
    pub os: String,
    pub arch: String,
    pub rustc_channel: String,
    pub data_root: String,
    pub workspace_root: String,
    pub connectivity_hint: String,
    pub vault_backend: String,
    pub notes: Vec<String>,
}

pub fn collect(data_root: &str, workspace_root: &str) -> DiagnosticsReport {
    DiagnosticsReport {
        app_name: "PVG AI".into(),
        app_version: env!("CARGO_PKG_VERSION").into(),
        phase: "3-media".into(),
        os: env::consts::OS.into(),
        arch: env::consts::ARCH.into(),
        rustc_channel: "stable".into(),
        data_root: data_root.to_string(),
        workspace_root: workspace_root.to_string(),
        connectivity_hint: "LOCAL_ONLY".into(),
        vault_backend: "memory (OS keychain planned)".into(),
        notes: vec![
            "Phase 3 media IPC — probe/import/derivatives via pvg-media".into(),
            "No secrets are included in diagnostics payloads".into(),
            "FFmpeg/ffprobe optional; EngineUnavailable when missing".into(),
        ],
    }
}
