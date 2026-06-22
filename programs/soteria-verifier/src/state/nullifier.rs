use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct NullifierRecord {
    pub group_id: u64,
    pub nullifier_hash: [u8; 32],
    pub merkle_root: [u8; 32],
    pub bump: u8,
}
