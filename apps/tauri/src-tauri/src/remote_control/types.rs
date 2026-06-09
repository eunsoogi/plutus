use serde::{Deserialize, Serialize};

pub struct PairingCode {
    pub code: String,
    pub host_id: String,
    pub expires_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteDevice {
    pub id: String,
    pub profile_id: String,
    pub device_name: String,
    pub device_platform: String,
    pub public_key: String,
    pub permissions: serde_json::Value,
    pub revoked_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteSession {
    pub id: String,
    pub remote_device_id: String,
    pub status: String,
    pub host_address: String,
    pub session_key_ref: String,
    pub address_metadata: RemoteAddressMetadata,
    pub session_security: RemoteSessionSecurity,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteAddressMetadata {
    pub source: String,
    pub host: String,
    pub port: u16,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteSessionSecurity {
    pub session_key_ref: String,
    pub cipher_suite: String,
    pub handshake_ref: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteUnlockProof {
    pub method: String,
    pub session_key_ref: String,
    pub challenge: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteCommandRequest {
    pub command_id: String,
    pub session_id: String,
    pub session_key_ref: Option<String>,
    pub unlock: Option<RemoteUnlockProof>,
    pub command_type: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteCommandResponse {
    pub command_id: String,
    pub success: bool,
    pub warnings: Vec<String>,
    pub permission_granted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RemoteCommandExecutionResponse {
    pub authorization: RemoteCommandResponse,
    pub data: serde_json::Value,
    pub host_timestamp: String,
}
