use anchor_lang::prelude::*;

#[constant]
pub const GROUP_SEED: &[u8] = b"group";

#[constant]
pub const NULLIFIER_SEED: &[u8] = b"nullifier";

/// Merkle depth — MUST match circuits/credential.circom (`Credential(20)`).
pub const TREE_DEPTH: u8 = 20;

/// Number of recent roots accepted by `verify_proof`.
pub const ROOT_HISTORY_SIZE: usize = 64;

pub const NUM_PUBLIC_INPUTS: usize = 4;

// snarkjs orders public signals as [outputs..., publicInputs...], so the
// on-chain order is: [nullifierHash, merkleRoot, externalNullifier, signalHash].
pub const PI_NULLIFIER_HASH: usize = 0;
pub const PI_MERKLE_ROOT: usize = 1;
pub const PI_EXTERNAL_NULLIFIER: usize = 2;
pub const PI_SIGNAL_HASH: usize = 3;
