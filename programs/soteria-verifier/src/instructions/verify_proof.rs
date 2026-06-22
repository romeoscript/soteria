use anchor_lang::prelude::*;
use groth16_solana::groth16::Groth16Verifier;

use crate::constants::{
    GROUP_SEED, NULLIFIER_SEED, NUM_PUBLIC_INPUTS, PI_EXTERNAL_NULLIFIER, PI_MERKLE_ROOT,
    PI_NULLIFIER_HASH, PI_SIGNAL_HASH,
};
use crate::error::SoteriaError;
use crate::events::Disclosed;
use crate::state::{Group, NullifierRecord};
use crate::verifying_key::VERIFYINGKEY;

#[derive(Accounts)]
#[instruction(
    external_nullifier: [u8; 32],
    proof_a: [u8; 64],
    proof_b: [u8; 128],
    proof_c: [u8; 64],
    public_inputs: [[u8; 32]; NUM_PUBLIC_INPUTS]
)]
pub struct VerifyProof<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [GROUP_SEED, &group.group_id.to_le_bytes()],
        bump = group.bump,
    )]
    pub group: Account<'info, Group>,

    // `init` fails if this nullifier was already spent in this group.
    #[account(
        init,
        payer = payer,
        space = 8 + NullifierRecord::INIT_SPACE,
        seeds = [
            NULLIFIER_SEED,
            &group.group_id.to_le_bytes(),
            public_inputs[PI_NULLIFIER_HASH].as_ref(),
        ],
        bump
    )]
    pub nullifier: Account<'info, NullifierRecord>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<VerifyProof>,
    external_nullifier: [u8; 32],
    proof_a: [u8; 64],
    proof_b: [u8; 128],
    proof_c: [u8; 64],
    public_inputs: [[u8; 32]; NUM_PUBLIC_INPUTS],
) -> Result<()> {
    require!(
        public_inputs[PI_EXTERNAL_NULLIFIER] == external_nullifier,
        SoteriaError::ScopeMismatch
    );

    let group = &ctx.accounts.group;
    let merkle_root = public_inputs[PI_MERKLE_ROOT];
    require!(group.is_known_root(&merkle_root), SoteriaError::UnknownRoot);

    let mut verifier =
        Groth16Verifier::new(&proof_a, &proof_b, &proof_c, &public_inputs, &VERIFYINGKEY)
            .map_err(|_| SoteriaError::MalformedProof)?;
    verifier
        .verify()
        .map_err(|_| SoteriaError::ProofVerificationFailed)?;

    let nullifier = &mut ctx.accounts.nullifier;
    nullifier.group_id = group.group_id;
    nullifier.nullifier_hash = public_inputs[PI_NULLIFIER_HASH];
    nullifier.merkle_root = merkle_root;
    nullifier.bump = ctx.bumps.nullifier;

    emit!(Disclosed {
        group_id: group.group_id,
        nullifier_hash: public_inputs[PI_NULLIFIER_HASH],
        merkle_root,
        external_nullifier: public_inputs[PI_EXTERNAL_NULLIFIER],
        signal_hash: public_inputs[PI_SIGNAL_HASH],
    });
    Ok(())
}
