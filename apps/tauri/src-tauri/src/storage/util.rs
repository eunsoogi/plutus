use chrono::Utc;
use uuid::Uuid;

pub fn now() -> String {
    Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub fn new_id() -> String {
    Uuid::now_v7().to_string()
}

pub fn json_text(value: serde_json::Value) -> String {
    value.to_string()
}

pub fn sha256_hex(contents: &[u8]) -> String {
    use sha2::{Digest, Sha256};

    let mut hasher = Sha256::new();
    hasher.update(contents);
    hex::encode(hasher.finalize())
}
