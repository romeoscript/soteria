pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/mux1.circom";

// ---------------------------------------------------------------------------
// Soteria privacy-pool withdraw circuit (compliant pool — path C)
//
// Proves: knowledge of a note (nullifier, secret) whose commitment
//   commitment = Poseidon(nullifier, secret)
// is a leaf in BOTH
//   - the pool's deposit tree    (depositRoot)      -> "I deposited"
//   - the curated association set (associationRoot)  -> "my deposit is approved"
// and reveals a unique nullifierHash = Poseidon(nullifier) so the same note
// cannot be withdrawn twice — WITHOUT revealing which leaf.
//
// recipientHi/Lo and fee are public and squared-in so the proof is bound to a
// specific payout: a relayer that submits it cannot re-target the recipient or
// inflate the fee.
//
// For a pool with no compliance gating, the association set == the full deposit
// set, so associationRoot tracks depositRoot and the second inclusion is a
// no-op in practice. For a compliant pool it is a curated subset.
// ---------------------------------------------------------------------------

template MerkleInclusion(depth) {
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];   // 0 => current node is left child, 1 => right
    signal output root;

    component hashers[depth];
    component mux[depth];
    signal hashes[depth + 1];
    hashes[0] <== leaf;

    for (var i = 0; i < depth; i++) {
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        mux[i] = MultiMux1(2);
        mux[i].c[0][0] <== hashes[i];
        mux[i].c[0][1] <== pathElements[i];
        mux[i].c[1][0] <== pathElements[i];
        mux[i].c[1][1] <== hashes[i];
        mux[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];
        hashes[i + 1] <== hashers[i].out;
    }

    root <== hashes[depth];
}

template Withdraw(depth) {
    // --- private ---
    signal input nullifier;
    signal input secret;
    signal input depositPathElements[depth];
    signal input depositPathIndices[depth];
    signal input assocPathElements[depth];
    signal input assocPathIndices[depth];

    // --- public ---
    signal input depositRoot;
    signal input associationRoot;
    signal input recipientHi;   // top 16 bytes of the 32-byte recipient pubkey
    signal input recipientLo;   // bottom 16 bytes
    signal input fee;           // lamports paid to the relayer

    // --- public output ---
    signal output nullifierHash;

    // note commitment = Poseidon(nullifier, secret)
    component cm = Poseidon(2);
    cm.inputs[0] <== nullifier;
    cm.inputs[1] <== secret;

    // membership in the deposit tree
    component dinc = MerkleInclusion(depth);
    dinc.leaf <== cm.out;
    for (var i = 0; i < depth; i++) {
        dinc.pathElements[i] <== depositPathElements[i];
        dinc.pathIndices[i] <== depositPathIndices[i];
    }
    dinc.root === depositRoot;

    // membership in the association set (same commitment, curated tree)
    component ainc = MerkleInclusion(depth);
    ainc.leaf <== cm.out;
    for (var i = 0; i < depth; i++) {
        ainc.pathElements[i] <== assocPathElements[i];
        ainc.pathIndices[i] <== assocPathIndices[i];
    }
    ainc.root === associationRoot;

    // nullifier = Poseidon(nullifier secret) — public, prevents double-spend
    component nh = Poseidon(1);
    nh.inputs[0] <== nullifier;
    nullifierHash <== nh.out;

    // bind the payout so a relayer cannot re-target it
    signal recipientHiSq;
    recipientHiSq <== recipientHi * recipientHi;
    signal recipientLoSq;
    recipientLoSq <== recipientLo * recipientLo;
    signal feeSq;
    feeSq <== fee * fee;
}

// depth 20 => up to 2^20 (~1M) notes per pool
component main {public [depositRoot, associationRoot, recipientHi, recipientLo, fee]} = Withdraw(20);
