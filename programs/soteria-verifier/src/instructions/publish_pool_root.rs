use anchor_lang::prelude::*;

use crate::constants::POOL_SEED;
use crate::error::SoteriaError;
use crate::events::{AssociationRootSet, PoolRootPublished};
use crate::state::Pool;

#[derive(Accounts)]
pub struct UpdatePoolRoot<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [POOL_SEED, &pool.pool_id.to_le_bytes()],
        bump = pool.bump,
        has_one = authority,
    )]
    pub pool: Box<Account<'info, Pool>>,
}

/// Operator pushes a new deposit-tree root after inserting freshly deposited
/// commitments. Recent roots stay valid so in-flight withdrawals survive an
/// update (32-entry ring buffer).
pub fn publish_pool_root(ctx: Context<UpdatePoolRoot>, new_root: [u8; 32]) -> Result<()> {
    require!(new_root != [0u8; 32], SoteriaError::ZeroRoot);

    let pool = &mut ctx.accounts.pool;
    pool.push_root(new_root);

    emit!(PoolRootPublished {
        pool_id: pool.pool_id,
        root: new_root,
        index: pool.current_root_index,
    });
    Ok(())
}

/// Operator sets the curated association-set root. Withdraw proofs must match
/// this exactly; a non-gated pool sets it equal to the current deposit root.
pub fn set_association_root(
    ctx: Context<UpdatePoolRoot>,
    association_root: [u8; 32],
) -> Result<()> {
    require!(association_root != [0u8; 32], SoteriaError::ZeroRoot);

    let pool = &mut ctx.accounts.pool;
    pool.association_root = association_root;

    emit!(AssociationRootSet {
        pool_id: pool.pool_id,
        association_root,
    });
    Ok(())
}
