// Format a snarkjs proof + public signals into the byte layout the on-chain
// verifier expects. Identical convention to packages/sdk/src/zk/prover.ts:
// 32-byte big-endian; G1 = x||y; G2 swaps each Fp2 to c1||c0; A is negated.

const Q =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n;

export function be32(dec: string | bigint): number[] {
  let v = BigInt(dec);
  const out = new Array<number>(32).fill(0);
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

const neg = (s: string | bigint) => (Q - (BigInt(s) % Q)) % Q;

export interface SnarkProof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
}

export interface FormattedProof {
  proofA: number[];
  proofB: number[];
  proofC: number[];
  publicInputs: number[][];
  nullifierHash: number[];
  merkleRoot: number[];
  externalNullifier: number[];
}

// publicSignals order = [nullifierHash, merkleRoot, externalNullifier, signalHash]
export function formatProof(proof: SnarkProof, publicSignals: string[]): FormattedProof {
  const proofA = [...be32(proof.pi_a[0]), ...be32(neg(proof.pi_a[1]))];
  const proofB = [
    ...be32(proof.pi_b[0][1]), ...be32(proof.pi_b[0][0]),
    ...be32(proof.pi_b[1][1]), ...be32(proof.pi_b[1][0]),
  ];
  const proofC = [...be32(proof.pi_c[0]), ...be32(proof.pi_c[1])];
  const publicInputs = publicSignals.map((s) => be32(s));
  return {
    proofA,
    proofB,
    proofC,
    publicInputs,
    nullifierHash: publicInputs[0],
    merkleRoot: publicInputs[1],
    externalNullifier: publicInputs[2],
  };
}

export interface FormattedPoolProof {
  proofA: number[];
  proofB: number[];
  proofC: number[];
  publicInputs: number[][]; // 6
  nullifierHash: number[];
  depositRoot: number[];
  associationRoot: number[];
}

// circuits/withdraw.circom public-signal order:
//   [nullifierHash, depositRoot, associationRoot, recipientHi, recipientLo, fee]
export function formatPoolProof(
  proof: SnarkProof,
  publicSignals: string[]
): FormattedPoolProof {
  const proofA = [...be32(proof.pi_a[0]), ...be32(neg(proof.pi_a[1]))];
  const proofB = [
    ...be32(proof.pi_b[0][1]), ...be32(proof.pi_b[0][0]),
    ...be32(proof.pi_b[1][1]), ...be32(proof.pi_b[1][0]),
  ];
  const proofC = [...be32(proof.pi_c[0]), ...be32(proof.pi_c[1])];
  const publicInputs = publicSignals.map((s) => be32(s));
  return {
    proofA,
    proofB,
    proofC,
    publicInputs,
    nullifierHash: publicInputs[0],
    depositRoot: publicInputs[1],
    associationRoot: publicInputs[2],
  };
}
