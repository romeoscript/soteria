use anchor_lang::prelude::*;

pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;
mod verifying_key;

use constants::NUM_PUBLIC_INPUTS;
use instructions::*;

declare_id!("Aeg1sVeri11111111111111111111111111111111111");

const _: () = assert!(
    verifying_key::VERIFYINGKEY.nr_pubinputs as usize == NUM_PUBLIC_INPUTS,
    "VERIFYINGKEY public-input count must match the circuit"
);

#[program]
pub mod soteria_verifier {
    use super::*;

    pub fn create_group(ctx: Context<CreateGroup>, group_id: u64) -> Result<()> {
        instructions::create_group::handler(ctx, group_id)
    }

    pub fn publish_root(ctx: Context<PublishRoot>, new_root: [u8; 32]) -> Result<()> {
        instructions::publish_root::handler(ctx, new_root)
    }

    pub fn set_authority(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
        instructions::set_authority::handler(ctx, new_authority)
    }

    pub fn verify_proof(
        ctx: Context<VerifyProof>,
        proof_a: [u8; 64],
        proof_b: [u8; 128],
        proof_c: [u8; 64],
        public_inputs: [[u8; 32]; NUM_PUBLIC_INPUTS],
    ) -> Result<()> {
        instructions::verify_proof::handler(ctx, proof_a, proof_b, proof_c, public_inputs)
    }
}
