use anchor_lang::prelude::*;

#[error_code]
pub enum SoteriaError {
    #[msg("merkle root is not among the group's recent published roots")]
    UnknownRoot,
    #[msg("merkle root cannot be zero")]
    ZeroRoot,
    #[msg("proof bytes are malformed")]
    MalformedProof,
    #[msg("zero-knowledge proof failed verification")]
    ProofVerificationFailed,
    #[msg("new authority cannot be the default pubkey")]
    InvalidAuthority,
}
