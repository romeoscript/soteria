use anchor_lang::prelude::*;

use crate::constants::{POOL_SEED, TREE_DEPTH, VAULT_SEED};
use crate::error::SoteriaError;
use crate::events::PoolCreated;
use crate::state::Pool;

#[derive(Accounts)]
#[instruction(pool_id: u64)]
pub struct InitPool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Pool::INIT_SPACE,
        seeds = [POOL_SEED, &pool_id.to_le_bytes()],
        bump
    )]
    pub pool: Box<Account<'info, Pool>>,

    /// Native-SOL vault PDA. Stays system-owned with no data so it can receive
    /// deposits and sign payouts via its seeds.
    #[account(
        seeds = [VAULT_SEED, &pool_id.to_le_bytes()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitPool>, pool_id: u64, denomination: u64) -> Result<()> {
    require!(denomination > 0, SoteriaError::ZeroDenomination);

    let pool = &mut ctx.accounts.pool;
    pool.authority = ctx.accounts.authority.key();
    pool.pool_id = pool_id;
    pool.denomination = denomination;
    pool.depth = TREE_DEPTH;
    pool.bump = ctx.bumps.pool;
    pool.vault_bump = ctx.bumps.vault;

    emit!(PoolCreated {
        pool_id,
        authority: pool.authority,
        denomination,
    });
    Ok(())
}
