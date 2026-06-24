use anchor_lang::prelude::*;
use anchor_lang::system_program;
use groth16_solana::groth16::Groth16Verifier;

use crate::constants::{
    POOL_NULLIFIER_SEED, POOL_NUM_PUBLIC_INPUTS, POOL_SEED, PI_POOL_ASSOCIATION_ROOT,
    PI_POOL_DEPOSIT_ROOT, PI_POOL_FEE, PI_POOL_NULLIFIER_HASH, PI_POOL_RECIPIENT_HI,
    PI_POOL_RECIPIENT_LO, VAULT_SEED,
};
use crate::error::SoteriaError;
use crate::events::Withdrawn;
use crate::state::{Pool, PoolNullifier};
use crate::verifying_key_pool::VERIFYINGKEY_POOL;

#[derive(Accounts)]
#[instruction(
    proof_a: [u8; 64],
    proof_b: [u8; 128],
    proof_c: [u8; 64],
    public_inputs: [[u8; 32]; POOL_NUM_PUBLIC_INPUTS],
    fee: u64
)]
pub struct Withdraw<'info> {
    /// Whoever submits the proof (a relayer, so the withdrawer's own wallet
    /// never appears). Pays rent for the nullifier record and earns `fee`.
    #[account(mut)]
    pub relayer: Signer<'info>,

    #[account(
        seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()],
        bump = pool.bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(
        mut,
        seeds = [VAULT_SEED, &pool.pool_id.to_le_bytes()],
        bump = pool.vault_bump,
    )]
    pub vault: SystemAccount<'info>,

    /// Payout destination, bound into the proof via recipientHi/Lo.
    /// CHECK: validated against the proof's recipient binding below.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,

    // `init` fails if this nullifier was already spent in this pool.
    #[account(
        init,
        payer = relayer,
        space = 8 + PoolNullifier::INIT_SPACE,
        seeds = [
            POOL_NULLIFIER_SEED,
            pool.key().as_ref(),
            public_inputs[PI_POOL_NULLIFIER_HASH].as_ref(),
        ],
        bump
    )]
    pub nullifier: Box<Account<'info, PoolNullifier>>,

    pub system_program: Program<'info, System>,
}

// Big-endian 32-byte field encoding of the top 16 bytes of a pubkey.
fn recipient_hi(key: &Pubkey) -> [u8; 32] {
    let mut out = [0u8; 32];
    out[16..32].copy_from_slice(&key.to_bytes()[0..16]);
    out
}

// Big-endian 32-byte field encoding of the bottom 16 bytes of a pubkey.
fn recipient_lo(key: &Pubkey) -> [u8; 32] {
    let mut out = [0u8; 32];
    out[16..32].copy_from_slice(&key.to_bytes()[16..32]);
    out
}

fn fee_field(fee: u64) -> [u8; 32] {
    let mut out = [0u8; 32];
    out[24..32].copy_from_slice(&fee.to_be_bytes());
    out
}

pub fn handler(
    ctx: Context<Withdraw>,
    proof_a: [u8; 64],
    proof_b: [u8; 128],
    proof_c: [u8; 64],
    public_inputs: [[u8; 32]; POOL_NUM_PUBLIC_INPUTS],
    fee: u64,
) -> Result<()> {
    let pool = &ctx.accounts.pool;
    let recipient_key = ctx.accounts.recipient.key();

    require!(fee <= pool.denomination, SoteriaError::FeeTooHigh);

    // Bindings: the proof commits to depositRoot, associationRoot, recipient
    // and fee, so a relayer cannot re-target the payout.
    let deposit_root = public_inputs[PI_POOL_DEPOSIT_ROOT];
    require!(pool.is_known_root(&deposit_root), SoteriaError::UnknownRoot);

    require!(
        public_inputs[PI_POOL_ASSOCIATION_ROOT] == pool.association_root,
        SoteriaError::UnknownAssociationRoot
    );

    require!(
        public_inputs[PI_POOL_RECIPIENT_HI] == recipient_hi(&recipient_key)
            && public_inputs[PI_POOL_RECIPIENT_LO] == recipient_lo(&recipient_key),
        SoteriaError::RecipientMismatch
    );

    require!(
        public_inputs[PI_POOL_FEE] == fee_field(fee),
        SoteriaError::FeeMismatch
    );

    let mut verifier =
        Groth16Verifier::new(&proof_a, &proof_b, &proof_c, &public_inputs, &VERIFYINGKEY_POOL)
            .map_err(|_| SoteriaError::MalformedProof)?;
    let verified = verifier
        .verify()
        .map_err(|_| SoteriaError::ProofVerificationFailed)?;
    require!(verified, SoteriaError::ProofVerificationFailed);

    // Pay out: (denomination - fee) to the recipient, fee to the relayer.
    let pool_id = pool.pool_id.to_le_bytes();
    let vault_seeds: &[&[u8]] = &[VAULT_SEED, pool_id.as_ref(), &[pool.vault_bump]];
    let signer = &[vault_seeds];

    let payout = pool.denomination - fee;
    system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
            },
            signer,
        ),
        payout,
    )?;

    if fee > 0 {
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.relayer.to_account_info(),
                },
                signer,
            ),
            fee,
        )?;
    }

    let nullifier = &mut ctx.accounts.nullifier;
    nullifier.pool_id = pool.pool_id;
    nullifier.nullifier_hash = public_inputs[PI_POOL_NULLIFIER_HASH];
    nullifier.bump = ctx.bumps.nullifier;

    emit!(Withdrawn {
        pool_id: pool.pool_id,
        nullifier_hash: public_inputs[PI_POOL_NULLIFIER_HASH],
        recipient: recipient_key,
        fee,
    });
    Ok(())
}
