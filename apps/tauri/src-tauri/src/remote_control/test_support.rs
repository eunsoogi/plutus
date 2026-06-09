use ed25519_dalek::Signer;

use super::security::unlock_message;

pub(crate) fn test_remote_public_key() -> String {
    let signing_key = test_remote_signing_key();
    format!(
        "ed25519:{}",
        hex::encode(signing_key.verifying_key().to_bytes())
    )
}

fn test_remote_signing_key() -> ed25519_dalek::SigningKey {
    ed25519_dalek::SigningKey::from_bytes(&[7_u8; 32])
}

pub(crate) fn test_unlock_challenge(
    session_id: &str,
    command_id: &str,
    session_key_ref: &str,
    command_type: &str,
    payload: &serde_json::Value,
) -> String {
    let signature = test_remote_signing_key().sign(
        unlock_message(
            session_id,
            command_id,
            session_key_ref,
            command_type,
            payload,
        )
        .as_bytes(),
    );
    format!("ed25519:{}", hex::encode(signature.to_bytes()))
}
