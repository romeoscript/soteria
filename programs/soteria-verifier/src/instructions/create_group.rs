use anchor_lang::prelude::*;

use crate::constants::{GROUP_SEED, TREE_DEPTH};
use crate::events::GroupCreated;
use crate::state::Group;

#[derive(Accounts)]
#[instruction(group_id: u64)]
pub struct CreateGroup<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Group::INIT_SPACE,
        seeds = [GROUP_SEED, &group_id.to_le_bytes()],
        bump
    )]
    pub group: Box<Account<'info, Group>>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateGroup>, group_id: u64) -> Result<()> {
    // `init` zero-fills the account, so root_count/current_root_index/roots
    // start at zero — no large stack-allocated array assignment needed.
    let group = &mut ctx.accounts.group;
    group.authority = ctx.accounts.authority.key();
    group.group_id = group_id;
    group.depth = TREE_DEPTH;
    group.bump = ctx.bumps.group;

    emit!(GroupCreated {
        group_id,
        authority: group.authority,
    });
    Ok(())
}
