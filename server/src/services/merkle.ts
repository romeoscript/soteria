import { buildPoseidon } from "circomlibjs";

// Mirrors packages/sdk/src/zk/merkle.ts and circuits/credential.circom:
//   leaf already = Poseidon(secret); parent = Poseidon(left, right);
//   empty slots fold a zero subtree. Keep DEPTH in sync with the circuit.
export const DEPTH = 20;

type Poseidon = ((xs: bigint[]) => unknown) & { F: { toString(x: unknown): string } };
let poseidonPromise: Promise<Poseidon> | undefined;

function getPoseidon(): Promise<Poseidon> {
  poseidonPromise ??= buildPoseidon() as Promise<Poseidon>;
  return poseidonPromise;
}

export async function computeRoot(commitments: string[]): Promise<string> {
  const poseidon = await getPoseidon();
  const h2 = (a: bigint, b: bigint) => BigInt(poseidon.F.toString(poseidon([a, b])));

  const zeros: bigint[] = [0n];
  for (let i = 0; i < DEPTH; i++) zeros.push(h2(zeros[i], zeros[i]));

  let layer = commitments.map((c) => BigInt(c));
  if (layer.length === 0) return zeros[DEPTH].toString();

  for (let level = 0; level < DEPTH; level++) {
    const next: bigint[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : zeros[level];
      next.push(h2(left, right));
    }
    layer = next;
  }
  return layer[0].toString();
}
