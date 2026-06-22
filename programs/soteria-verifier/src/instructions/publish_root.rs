use anchor_lang::prelude::*;

use crate::constants::GROUP_SEED;
use crate::error::SoteriaError;
use crate::events::RootPublished;
use crate::state::Group;

#[derive(Accounts)]
pub struct PublishRoot<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [GROUP_SEED, &group.group_id.to_le_bytes()],
        bump = group.bump,
        has_one = authority,
    )]
    pub group: Account<'info, Group>,
}

pub fn handler(ctx: Context<PublishRoot>, new_root: [u8; 32]) -> Result<()> {
    require!(new_root != [0u8; 32], SoteriaError::ZeroRoot);

    let group = &mut ctx.accounts.group;
    group.push_root(new_root);

    emit!(RootPublished {
        group_id: group.group_id,
        root: new_root,
        index: group.current_root_index,
    });
    Ok(())
}
