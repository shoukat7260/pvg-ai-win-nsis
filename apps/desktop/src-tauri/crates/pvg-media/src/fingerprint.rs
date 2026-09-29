//! Partial media fingerprint for change detection / relink hints.
//!
//! **Not cryptographic authentication.** The fingerprint is SHA-256 over the first
//! 1 MiB of file bytes, combined with file size and modification time. It is a
//! cheap content+metadata hint suitable for detecting local edits, not a security
//! integrity proof.

use crate::error::{MediaError, MediaResult};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use std::time::SystemTime;

/// Number of leading bytes included in the content hash.
pub const FINGERPRINT_HEAD_BYTES: u64 = 1024 * 1024; // 1 MiB

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MediaFingerprint {
    /// Hex-encoded SHA-256 of the first [`FINGERPRINT_HEAD_BYTES`] (or entire file if smaller).
    pub content_sha256: String,
    pub size_bytes: u64,
    /// Unix epoch milliseconds of mtime when available.
    pub mtime_ms: Option<i64>,
    /// Combined identity string: `{sha256}:{size}:{mtime_ms|na}`.
    pub id: String,
}

fn mtime_millis(path: &Path) -> MediaResult<Option<i64>> {
    let meta = std::fs::metadata(path)?;
    match meta.modified() {
        Ok(t) => {
            let ms = t
                .duration_since(SystemTime::UNIX_EPOCH)
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0);
            Ok(Some(ms))
        }
        Err(_) => Ok(None),
    }
}

fn hash_head(path: &Path) -> MediaResult<(String, u64)> {
    let mut file = File::open(path)?;
    let size = file.seek(SeekFrom::End(0))?;
    file.seek(SeekFrom::Start(0))?;

    let to_read = size.min(FINGERPRINT_HEAD_BYTES) as usize;
    let mut buf = vec![0u8; to_read];
    let mut read_total = 0;
    while read_total < to_read {
        match file.read(&mut buf[read_total..])? {
            0 => break,
            n => read_total += n,
        }
    }
    buf.truncate(read_total);

    let mut hasher = Sha256::new();
    hasher.update(&buf);
    let digest = hasher.finalize();
    Ok((hex_encode(&digest), size))
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0xf) as usize] as char);
    }
    out
}

/// Compute a deterministic partial fingerprint for `path`.
pub fn fingerprint_file(path: &Path) -> MediaResult<MediaFingerprint> {
    if !path.is_file() {
        return Err(MediaError::InvalidInput(format!(
            "not a file: {}",
            path.display()
        )));
    }
    let (content_sha256, size_bytes) = hash_head(path)?;
    let mtime_ms = mtime_millis(path)?;
    let id = match mtime_ms {
        Some(ms) => format!("{content_sha256}:{size_bytes}:{ms}"),
        None => format!("{content_sha256}:{size_bytes}:na"),
    };
    Ok(MediaFingerprint {
        content_sha256,
        size_bytes,
        mtime_ms,
        id,
    })
}

/// Fingerprint arbitrary bytes (tests / in-memory sources). Size is `bytes.len()`;
/// mtime is omitted (`na`).
pub fn fingerprint_bytes(bytes: &[u8]) -> MediaFingerprint {
    let head = if bytes.len() as u64 > FINGERPRINT_HEAD_BYTES {
        &bytes[..FINGERPRINT_HEAD_BYTES as usize]
    } else {
        bytes
    };
    let mut hasher = Sha256::new();
    hasher.update(head);
    let content_sha256 = hex_encode(&hasher.finalize());
    let size_bytes = bytes.len() as u64;
    let id = format!("{content_sha256}:{size_bytes}:na");
    MediaFingerprint {
        content_sha256,
        size_bytes,
        mtime_ms: None,
        id,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn fingerprint_deterministic_for_same_bytes() {
        let data = b"pvg-media fingerprint fixture bytes";
        let a = fingerprint_bytes(data);
        let b = fingerprint_bytes(data);
        assert_eq!(a, b);
        assert_eq!(a.content_sha256.len(), 64);
    }

    #[test]
    fn fingerprint_file_matches_bytes_content_hash() {
        let mut tmp = NamedTempFile::new().unwrap();
        let data = b"same content for file and bytes hash";
        tmp.write_all(data).unwrap();
        tmp.flush().unwrap();

        let from_file = fingerprint_file(tmp.path()).unwrap();
        let from_bytes = fingerprint_bytes(data);
        assert_eq!(from_file.content_sha256, from_bytes.content_sha256);
        assert_eq!(from_file.size_bytes, from_bytes.size_bytes);
    }

    #[test]
    fn different_bytes_different_hash() {
        let a = fingerprint_bytes(b"aaa");
        let b = fingerprint_bytes(b"bbb");
        assert_ne!(a.content_sha256, b.content_sha256);
    }
}
