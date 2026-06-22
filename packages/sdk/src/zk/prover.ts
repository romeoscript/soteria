import { groth16 } from "snarkjs";
import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { PoseidonMerkleTree } from "./merkle";

// BN254 base field prime (for negating proof.A, per groth16-solana convention).
const Q =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n;

const VERIFIER_PROGRAM_ID = new PublicKey(
  "Aeg1sVeri11111111111111111111111111111111111"
);

function toBE32(dec: string | bigint): number[] {
  let v = BigInt(dec);
  const out = new Array<number>(32).fill(0);
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

export interface CredentialInputs {
  secret: bigint;
  tree: PoseidonMerkleTree;
  leafIndex: number;
  externalNullifier: bigint; // scope id
  signalHash: bigint; // bind to a message/recipient
}

export interface FormattedProof {
  proofA: number[]; // 64
  proofB: number[]; // 128
  proofC: number[]; // 64
  publicInputs: number[][]; // [nullifierHash, merkleRoot, externalNullifier, signalHash]
}

/**
 * Generate a selective-disclosure proof and format it for the on-chain verifier.
 * Requires the circuit artifacts from the trusted setup (see README).
 */
export async function proveCredential(
  inputs: CredentialInputs,
  wasmPath: string,
  zkeyPath: string
): Promise<FormattedProof> {
  const { secret, tree, leafIndex, externalNullifier, signalHash } = inputs;
  const { pathElements, pathIndices } = tree.proof(leafIndex);

  const witness = {
    secret: secret.toString(),
    pathElements: pathElements.map((x) => x.toString()),
    pathIndices: pathIndices.map((x) => x.toString()),
    merkleRoot: tree.root().toString(),
    externalNullifier: externalNullifier.toString(),
    signalHash: signalHash.toString(),
  };

  const { proof, publicSignals } = await groth16.fullProve(
    witness,
    wasmPath,
    zkeyPath
  );

  // --- proof.A : negate y, then x||y big-endian (groth16-solana wants -A) ---
  const ax = BigInt(proof.pi_a[0]);
  const ay = (Q - (BigInt(proof.pi_a[1]) % Q)) % Q;
  const proofA = [...toBE32(ax), ...toBE32(ay)];

  // --- proof.B : G2, swap the c0/c1 ordering snarkjs emits ---
  const proofB = [
    ...toBE32(proof.pi_b[0][1]),
    ...toBE32(proof.pi_b[0][0]),
    ...toBE32(proof.pi_b[1][1]),
    ...toBE32(proof.pi_b[1][0]),
  ];

  // --- proof.C : x||y big-endian ---
  const proofC = [...toBE32(proof.pi_c[0]), ...toBE32(proof.pi_c[1])];

  // publicSignals order = [outputs..., publicInputs...]
  //   = [nullifierHash, merkleRoot, externalNullifier, signalHash]
  const publicInputs = publicSignals.map((s: string) => toBE32(s));

  return { proofA, proofB, proofC, publicInputs };
}

/** Derive the nullifier PDA (seed = nullifierHash = publicInputs[0]). */
export function nullifierPda(nullifierHash: number[]): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("nullifier"), Buffer.from(nullifierHash)],
    VERIFIER_PROGRAM_ID
  );
}

/**
 * Build the `verify` instruction. NOTE: encode args to match your generated
 * Anchor IDL (use @coral-xyz/anchor's program.methods.verify(...) in practice);
 * the manual layout below shows the account set + ordering.
 */
export function buildVerifyAccounts(payer: PublicKey, proof: FormattedProof) {
  const [nullifier] = nullifierPda(proof.publicInputs[0]);
  return {
    programId: VERIFIER_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: nullifier, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  };
}
