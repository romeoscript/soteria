use anchor_lang::prelude::*;

#[event]
pub struct GroupCreated {
    pub group_id: u64,
    pub authority: Pubkey,
}

#[event]
pub struct RootPublished {
    pub group_id: u64,
    pub root: [u8; 32],
    pub index: u32,
}

#[event]
pub struct AuthorityChanged {
    pub group_id: u64,
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
}

#[event]
pub struct Disclosed {
    pub group_id: u64,
    pub nullifier_hash: [u8; 32],
    pub merkle_root: [u8; 32],
    pub external_nullifier: [u8; 32],
    pub signal_hash: [u8; 32],
}

// ── Privacy pool ──

#[event]
pub struct PoolCreated {
    pub pool_id: u64,
    pub authority: Pubkey,
    pub denomination: u64,
}

#[event]
pub struct Deposited {
    pub pool_id: u64,
    pub commitment: [u8; 32],
    pub leaf_index: u64,
}

#[event]
pub struct PoolRootPublished {
    pub pool_id: u64,
    pub root: [u8; 32],
    pub index: u32,
}

#[event]
pub struct AssociationRootSet {
    pub pool_id: u64,
    pub association_root: [u8; 32],
}

#[event]
pub struct Withdrawn {
    pub pool_id: u64,
    pub nullifier_hash: [u8; 32],
    pub recipient: Pubkey,
    pub fee: u64,
}
