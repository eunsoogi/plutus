use std::{fs, path::Path};

use anyhow::{bail, Context, Result};
use rand::RngCore;

pub fn remote_session_key_ref(session_id: &str) -> String {
    format!("secure://plutus/remote-control/session-keys/{session_id}")
}

pub struct SecureStore;

impl SecureStore {
    pub fn create_remote_session_key(root: &Path, session_id: &str) -> Result<String> {
        fs::create_dir_all(root).context("failed to create secure storage directory")?;
        let mut secret = [0_u8; 32];
        rand::thread_rng().fill_bytes(&mut secret);
        let key_ref = remote_session_key_ref(session_id);
        let key_ref_path = root.join(format!("{session_id}.keyref"));
        let secret_path = root.join(format!("{session_id}.secret"));
        fs::write(&key_ref_path, key_ref.as_bytes())
            .context("failed to persist secure key reference")?;
        fs::write(&secret_path, hex::encode(secret))
            .context("failed to persist remote session secret material")?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&key_ref_path, fs::Permissions::from_mode(0o600))
                .context("failed to restrict secure key reference permissions")?;
            fs::set_permissions(&secret_path, fs::Permissions::from_mode(0o600))
                .context("failed to restrict secure session secret permissions")?;
        }
        Ok(key_ref)
    }

    pub fn read_remote_session_secret(root: &Path, key_ref: &str) -> Result<String> {
        Self::assert_secure_ref(key_ref)?;
        let session_id = key_ref
            .rsplit('/')
            .next()
            .filter(|value| !value.is_empty())
            .context("secure session key reference is missing a session id")?;
        let secret = fs::read_to_string(root.join(format!("{session_id}.secret")))
            .context("failed to read remote session secret material")?;
        if secret.trim().len() < 64 {
            bail!("remote session secret material is invalid");
        }
        Ok(secret)
    }

    pub fn assert_secure_ref(key_ref: &str) -> Result<()> {
        if !key_ref.starts_with("secure://plutus/") {
            bail!("secure storage references must be opaque secure:// refs");
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn persists_only_opaque_remote_session_key_refs() {
        let temp = tempfile::tempdir().unwrap();
        let key_ref = SecureStore::create_remote_session_key(temp.path(), "session-1").unwrap();
        assert_eq!(
            key_ref,
            "secure://plutus/remote-control/session-keys/session-1"
        );
        SecureStore::assert_secure_ref(&key_ref).unwrap();
        let stored_ref = fs::read_to_string(temp.path().join("session-1.keyref")).unwrap();
        assert_eq!(stored_ref, key_ref);
        let stored_secret = SecureStore::read_remote_session_secret(temp.path(), &key_ref).unwrap();
        assert_ne!(stored_secret, key_ref);
        assert_eq!(stored_secret.len(), 64);
    }
}
