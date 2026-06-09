mod authorization;
mod executor;
mod handlers;
mod pairing;
mod security;
mod types;

#[cfg(test)]
mod test_support;
#[cfg(test)]
mod tests;

pub use authorization::authorize_remote_command;
pub use executor::execute_authorized_remote_command;
pub use pairing::{
    create_pairing_code, list_devices, mark_session_stale, pair_device, pair_device_with_transport,
    revoke_device, set_host_kill_switch,
};
pub use security::command_group;
#[cfg(test)]
pub(crate) use test_support::{test_remote_public_key, test_unlock_challenge};
pub use types::{
    PairingCode, RemoteAddressMetadata, RemoteCommandExecutionResponse, RemoteCommandRequest,
    RemoteCommandResponse, RemoteDevice, RemoteSession, RemoteSessionSecurity, RemoteUnlockProof,
};
