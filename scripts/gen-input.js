// Produce a sample witness input for credential.circom: one member at leaf 0 of
// an otherwise-empty depth-20 tree. Zero-subtree siblings match
// packages/sdk/src/zk/merkle.ts so the computed root equals the circuit's.
//
//   node scripts/gen-input.js > input.json

const { buildPoseidon } = require("circomlibjs");

const DEPTH = 20;
const secret = 12345678901234567890n;
const externalNullifier = 42n;
const signalHash = 7n;

(async () => {
  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const H = (xs) => BigInt(F.toString(poseidon(xs)));

  const zeros = [0n];
  for (let i = 0; i < DEPTH; i++) zeros.push(H([zeros[i], zeros[i]]));

  const leaf = H([secret]);

  let node = leaf;
  const pathElements = [];
  const pathIndices = [];
  for (let i = 0; i < DEPTH; i++) {
    pathElements.push(zeros[i].toString());
    pathIndices.push(0);
    node = H([node, zeros[i]]);
  }

  process.stdout.write(
    JSON.stringify(
      {
        secret: secret.toString(),
        pathElements,
        pathIndices,
        merkleRoot: node.toString(),
        externalNullifier: externalNullifier.toString(),
        signalHash: signalHash.toString(),
      },
      null,
      2
    )
  );
})();
