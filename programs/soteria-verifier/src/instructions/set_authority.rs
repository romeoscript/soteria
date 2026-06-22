use anchor_lang::prelude::*;

use crate::constants::GROUP_SEED;
use crate::error::SoteriaError;
use crate::events::AuthorityChanged;
use crate::state::Group;

#[derive(Accounts)]
pub struct SetAuthority<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [GROUP_SEED, &group.group_id.to_le_bytes()],
        bump = group.bump,
        has_one = authority,
    )]
    pub group: Box<Account<'info, Group>>,
}

pub fn handler(ctx: Context<SetAuthority>, new_authority: Pubkey) -> Result<()> {
    require!(
        new_authority != Pubkey::default(),
        SoteriaError::InvalidAuthority
    );

    let group = &mut ctx.accounts.group;
    let old_authority = group.authority;
    group.authority = new_authority;

    emit!(AuthorityChanged {
        group_id: group.group_id,
        old_authority,
        new_authority,
    });
    Ok(())
}
