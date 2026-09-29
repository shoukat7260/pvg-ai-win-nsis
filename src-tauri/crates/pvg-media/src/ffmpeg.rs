//! FFmpeg / ffprobe discovery and safe argv construction.
//!
//! All invocations use `std::process::Command` with argument arrays only.
//! Filenames are always a single argv element — never interpolated into a shell string.

use crate::error::{MediaError, MediaResult};
use std::env;
use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};
use std::process::Command;

const ENV_FFMPEG: &str = "PVG_FFMPEG_PATH";
const ENV_FFPROBE: &str = "PVG_FFPROBE_PATH";

/// Reject null bytes and empty paths that could confuse process argv.
pub fn validate_arg_path(path: &Path) -> MediaResult<()> {
    let raw = path.as_os_str().as_encoded_bytes();
    if raw.is_empty() {
        return Err(MediaError::InvalidInput("empty path argument".into()));
    }
    if raw.contains(&0) {
        return Err(MediaError::InvalidInput(
            "path argument must not contain null bytes".into(),
        ));
    }
    Ok(())
}

/// Locate an executable: prefer explicit env override, otherwise search `PATH`.
fn locate_binary(env_key: &str, names: &[&str]) -> MediaResult<PathBuf> {
    if let Ok(override_path) = env::var(env_key) {
        let trimmed = override_path.trim();
        if !trimmed.is_empty() {
            let path = PathBuf::from(trimmed);
            validate_arg_path(&path)?;
            if path.is_file() {
                return Ok(path);
            }
            // Still return the override so callers get a clear EngineUnavailable
            // when the configured path is wrong.
            return Err(MediaError::EngineUnavailable(format!(
                "{env_key} points to missing binary: {}",
                path.display()
            )));
        }
    }

    for name in names {
        if let Some(found) = which(name) {
            return Ok(found);
        }
    }

    Err(MediaError::EngineUnavailable(format!(
        "{} not found (set {env_key} or install on PATH)",
        names.first().copied().unwrap_or("binary")
    )))
}

fn which(name: &str) -> Option<PathBuf> {
    let path_var = env::var_os("PATH")?;
    for dir in env::split_paths(&path_var) {
        let candidate = dir.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
        #[cfg(windows)]
        {
            let with_exe = dir.join(format!("{name}.exe"));
            if with_exe.is_file() {
                return Some(with_exe);
            }
        }
    }
    None
}

pub fn locate_ffmpeg() -> MediaResult<PathBuf> {
    locate_binary(ENV_FFMPEG, &["ffmpeg"])
}

pub fn locate_ffprobe() -> MediaResult<PathBuf> {
    locate_binary(ENV_FFPROBE, &["ffprobe"])
}

/// Safe argv builder: each path/filename is appended as a single argument.
#[derive(Debug, Clone, Default)]
pub struct ArgvBuilder {
    args: Vec<OsString>,
}

impl ArgvBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn flag(mut self, flag: impl AsRef<OsStr>) -> Self {
        self.args.push(flag.as_ref().to_os_string());
        self
    }

    pub fn arg(mut self, value: impl AsRef<OsStr>) -> Self {
        self.args.push(value.as_ref().to_os_string());
        self
    }

    /// Append a filesystem path as exactly one argv element.
    /// Malicious names like `video; rm -rf.mp4` remain a single argument.
    pub fn path(mut self, path: &Path) -> MediaResult<Self> {
        validate_arg_path(path)?;
        self.args.push(path.as_os_str().to_os_string());
        Ok(self)
    }

    pub fn into_vec(self) -> Vec<OsString> {
        self.args
    }

    pub fn as_slice(&self) -> &[OsString] {
        &self.args
    }
}

/// Build a `Command` with the given binary and argv (no shell).
pub fn command_with_args(binary: &Path, args: &[OsString]) -> MediaResult<Command> {
    validate_arg_path(binary)?;
    let mut cmd = Command::new(binary);
    cmd.args(args);
    Ok(cmd)
}

/// Run a command; map spawn failures for missing binaries to `EngineUnavailable`.
pub fn run_checked(mut cmd: Command) -> MediaResult<std::process::Output> {
    match cmd.output() {
        Ok(output) => Ok(output),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Err(MediaError::EngineUnavailable(
            format!("failed to spawn process: {err}"),
        )),
        Err(err) => Err(MediaError::Io(err.to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn malicious_filename_is_single_argv_element() {
        let evil = Path::new("video; rm -rf.mp4");
        let argv = ArgvBuilder::new()
            .flag("-i")
            .path(evil)
            .unwrap()
            .flag("-f")
            .arg("null")
            .arg("-")
            .into_vec();

        assert_eq!(argv.len(), 5);
        assert_eq!(argv[1], OsString::from("video; rm -rf.mp4"));
        // Semicolon must not split into extra argv slots.
        assert!(!argv.iter().any(|a| a == "rm"));
        assert!(!argv.iter().any(|a| a.to_string_lossy().starts_with("-rf")));
    }

    #[test]
    fn rejects_null_byte_in_path() {
        let evil = PathBuf::from("evil\0.mp4");
        let err = validate_arg_path(&evil).unwrap_err();
        assert!(matches!(err, MediaError::InvalidInput(_)));
    }
}
