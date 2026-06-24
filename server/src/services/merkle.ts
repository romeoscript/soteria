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

export interface MerklePath {
  pathElements: string[];
  pathIndices: number[];
  root: string;
}

/**
 * Full Merkle path for the leaf at `index` over the same fixed-depth Poseidon
 * tree as computeRoot. Lets a client (or test) build a withdraw witness from
 * the server's commitment list without re-deriving the tree shape.
 */
export async function computeProof(
  commitments: string[],
  index: number
): Promise<MerklePath> {
  const poseidon = await getPoseidon();
  const h2 = (a: bigint, b: bigint) => BigInt(poseidon.F.toString(poseidon([a, b])));

  const zeros: bigint[] = [0n];
  for (let i = 0; i < DEPTH; i++) zeros.push(h2(zeros[i], zeros[i]));

  let layer = commitments.map((c) => BigInt(c));
  const pathElements: string[] = [];
  const pathIndices: number[] = [];
  let idx = index;

  for (let level = 0; level < DEPTH; level++) {
    const isRight = idx % 2;
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    const sibling = siblingIdx < layer.length ? layer[siblingIdx] : zeros[level];
    pathElements.push(sibling.toString());
    pathIndices.push(isRight);

    const next: bigint[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i];
      const right = i + 1 < layer.length ? layer[i + 1] : zeros[level];
      next.push(h2(left, right));
    }
    layer = next;
    idx = Math.floor(idx / 2);
  }

  const root = layer.length ? layer[0].toString() : zeros[DEPTH].toString();
  return { pathElements, pathIndices, root };
}
