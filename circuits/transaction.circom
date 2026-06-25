pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/mux1.circom";

// ---------------------------------------------------------------------------
// Soteria hidden-amount join-split (Option B).
//
// A note hides its VALUE: commitment = Poseidon(amount, pubkey, blinding).
// A transaction spends nIns input notes and creates nOuts output notes, proving
//   sum(inputs) + publicAmount == sum(outputs)
// WITHOUT revealing any amount. publicAmount (a public input fixed by the
// on-chain program to the actual lamports moved) is positive for a deposit and
// the field-negative (p - x) for a withdrawal. Range proofs keep every amount in
// [0, 2^248) so values can't be forged via field wraparound.
//
// Multiple outputs => pay several recipients (+ change) in one private tx.
//
// ⚠️ UNAUDITED. This follows the Tornado-Nova / Privacy-Cash design but has not
// been audited; the trusted setup here is single-contributor. Do NOT hold real
// funds with this without an audit and a real multi-party ceremony.
// ---------------------------------------------------------------------------

template Keypair() {
    signal input privateKey;
    signal output publicKey;
    component h = Poseidon(1);
    h.inputs[0] <== privateKey;
    publicKey <== h.out;
}

template MerkleProof(levels) {
    signal input leaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];   // 0 => current node is left child
    signal output root;

    component hashers[levels];
    component mux[levels];
    signal hashes[levels + 1];
    hashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
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
    root <== hashes[levels];
}

template Transaction(levels, nIns, nOuts) {
    var MAX_AMOUNT_BITS = 248;

    // --- public ---
    signal input root;
    signal input publicAmount;           // ext lamports in(+)/out(-), set on-chain
    signal input extDataHash;            // binds recipients/relayer/fee/enc-outputs
    signal input inputNullifier[nIns];
    signal input outputCommitment[nOuts];

    // --- private: inputs ---
    signal input inAmount[nIns];
    signal input inPrivateKey[nIns];
    signal input inBlinding[nIns];
    signal input inPathIndices[nIns][levels];
    signal input inPathElements[nIns][levels];

    // --- private: outputs ---
    signal input outAmount[nOuts];
    signal input outPubkey[nOuts];
    signal input outBlinding[nOuts];

    component inKeypair[nIns];
    component inCommitment[nIns];
    component inSignature[nIns];
    component inNullifierHash[nIns];
    component inTree[nIns];
    component inAmountBits[nIns];
    component inIsDummy[nIns];
    signal inSum[nIns + 1];
    inSum[0] <== 0;

    for (var i = 0; i < nIns; i++) {
        // amount in range (also rejects field-negative values)
        inAmountBits[i] = Num2Bits(MAX_AMOUNT_BITS);
        inAmountBits[i].in <== inAmount[i];

        inKeypair[i] = Keypair();
        inKeypair[i].privateKey <== inPrivateKey[i];

        inCommitment[i] = Poseidon(3);
        inCommitment[i].inputs[0] <== inAmount[i];
        inCommitment[i].inputs[1] <== inKeypair[i].publicKey;
        inCommitment[i].inputs[2] <== inBlinding[i];

        // signature proves ownership; nullifier is unique per note + owner
        inSignature[i] = Poseidon(2);
        inSignature[i].inputs[0] <== inPrivateKey[i];
        inSignature[i].inputs[1] <== inCommitment[i].out;

        inNullifierHash[i] = Poseidon(2);
        inNullifierHash[i].inputs[0] <== inCommitment[i].out;
        inNullifierHash[i].inputs[1] <== inSignature[i].out;
        inNullifierHash[i].out === inputNullifier[i];

        inTree[i] = MerkleProof(levels);
        inTree[i].leaf <== inCommitment[i].out;
        for (var j = 0; j < levels; j++) {
            inTree[i].pathElements[j] <== inPathElements[i][j];
            inTree[i].pathIndices[j] <== inPathIndices[i][j];
        }
        // membership required only for real (amount > 0) inputs; dummies skip it
        inIsDummy[i] = IsZero();
        inIsDummy[i].in <== inAmount[i];
        (1 - inIsDummy[i].out) * (root - inTree[i].root) === 0;

        inSum[i + 1] <== inSum[i] + inAmount[i];
    }

    component outCommitmentHash[nOuts];
    component outAmountBits[nOuts];
    signal outSum[nOuts + 1];
    outSum[0] <== 0;

    for (var i = 0; i < nOuts; i++) {
        outAmountBits[i] = Num2Bits(MAX_AMOUNT_BITS);
        outAmountBits[i].in <== outAmount[i];

        outCommitmentHash[i] = Poseidon(3);
        outCommitmentHash[i].inputs[0] <== outAmount[i];
        outCommitmentHash[i].inputs[1] <== outPubkey[i];
        outCommitmentHash[i].inputs[2] <== outBlinding[i];
        outCommitmentHash[i].out === outputCommitment[i];

        outSum[i + 1] <== outSum[i] + outAmount[i];
    }

    // value conservation (in the field; publicAmount carries the sign)
    inSum[nIns] + publicAmount === outSum[nOuts];

    // the two inputs must be different notes (no same-note double spend in one tx)
    component sameNullifier = IsEqual();
    sameNullifier.in[0] <== inputNullifier[0];
    sameNullifier.in[1] <== inputNullifier[1];
    sameNullifier.out === 0;

    // bind the external data so a relayer can't re-target outputs/fee
    signal extDataSq;
    extDataSq <== extDataHash * extDataHash;
}

// depth 20 (~1M notes), 2 inputs, 2 outputs (1 recipient + change, or 2 payees)
component main {
    public [root, publicAmount, extDataHash, inputNullifier, outputCommitment]
} = Transaction(20, 2, 2);
