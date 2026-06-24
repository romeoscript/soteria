use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::{COMMITMENT_SEED, POOL_SEED, VAULT_SEED};
use crate::events::Deposited;
use crate::state::{Commitment, Pool};

#[derive(Accounts)]
#[instruction(commitment: [u8; 32])]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,

    #[account(
        mut,
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

    // Anchors the commitment to a real deposit and rejects duplicates: `init`
    // fails if this (pool, commitment) PDA already exists.
    #[account(
        init,
        payer = depositor,
        space = 8 + Commitment::INIT_SPACE,
        seeds = [COMMITMENT_SEED, pool.key().as_ref(), commitment.as_ref()],
        bump
    )]
    pub commitment_record: Box<Account<'info, Commitment>>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Deposit>, commitment: [u8; 32]) -> Result<()> {
    let denomination = ctx.accounts.pool.denomination;

    // Pull exactly one denomination into the vault.
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.depositor.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        denomination,
    )?;

    let pool = &mut ctx.accounts.pool;
    let leaf_index = pool.num_commitments;

    let record = &mut ctx.accounts.commitment_record;
    record.pool_id = pool.pool_id;
    record.commitment = commitment;
    record.leaf_index = leaf_index;
    record.bump = ctx.bumps.commitment_record;

    pool.num_commitments += 1;

    emit!(Deposited {
        pool_id: pool.pool_id,
        commitment,
        leaf_index,
    });
    Ok(())
}
