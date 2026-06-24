use anchor_lang::prelude::*;

use crate::constants::ROOT_HISTORY_SIZE;

/// A fixed-denomination privacy pool (path C). Funds live in a separate `vault`
/// PDA; this account holds only state. The deposit Merkle tree is maintained
/// off-chain by the pool authority/operator, which publishes roots here (v1).
/// Each real deposit anchors a `Commitment` PDA, so the operator can order
/// deposits into the tree but cannot fabricate notes.
#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub authority: Pubkey,
    pub pool_id: u64,
    /// Exact deposit/withdraw amount in lamports.
    pub denomination: u64,
    pub depth: u8,
    /// Total deposits made; also the next leaf index.
    pub num_commitments: u64,
    /// Recent deposit-tree roots (ring buffer), same scheme as `Group`.
    pub root_count: u64,
    pub current_root_index: u32,
    pub roots: [[u8; 32]; ROOT_HISTORY_SIZE],
    /// Curated association-set root. Withdraw proofs must match this exactly.
    /// A non-gated pool sets this to the full deposit root.
    pub association_root: [u8; 32],
    pub bump: u8,
    pub vault_bump: u8,
}

impl Pool {
    pub fn push_root(&mut self, new_root: [u8; 32]) {
        if self.root_count > 0 {
            self.current_root_index =
                (self.current_root_index + 1) % ROOT_HISTORY_SIZE as u32;
        }
        self.roots[self.current_root_index as usize] = new_root;
        self.root_count += 1;
    }

    pub fn is_known_root(&self, root: &[u8; 32]) -> bool {
        if *root == [0u8; 32] {
            return false;
        }
        let known = self.root_count.min(ROOT_HISTORY_SIZE as u64) as usize;
        let mut i = self.current_root_index as usize;
        for _ in 0..known {
            if self.roots[i] == *root {
                return true;
            }
            i = if i == 0 { ROOT_HISTORY_SIZE - 1 } else { i - 1 };
        }
        false
    }
}

/// On-chain anchor proving a commitment was backed by a real deposit. Its PDA
/// address (seeds = [COMMITMENT_SEED, pool, commitment]) also prevents the same
/// commitment from being deposited twice.
#[account]
#[derive(InitSpace)]
pub struct Commitment {
    pub pool_id: u64,
    pub commitment: [u8; 32],
    pub leaf_index: u64,
    pub bump: u8,
}

/// Spent-note marker for a pool. `init` fails on a second withdraw of the same
/// nullifier hash, preventing double-spend.
#[account]
#[derive(InitSpace)]
pub struct PoolNullifier {
    pub pool_id: u64,
    pub nullifier_hash: [u8; 32],
    pub bump: u8,
}
