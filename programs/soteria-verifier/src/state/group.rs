use anchor_lang::prelude::*;

use crate::constants::ROOT_HISTORY_SIZE;

#[account]
#[derive(InitSpace)]
pub struct Group {
    pub authority: Pubkey,
    pub group_id: u64,
    pub depth: u8,
    pub root_count: u64,
    pub current_root_index: u32,
    pub roots: [[u8; 32]; ROOT_HISTORY_SIZE],
    pub bump: u8,
}

impl Group {
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
