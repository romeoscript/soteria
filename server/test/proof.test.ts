import { describe, it, expect } from "vitest";
import { be32, formatProof } from "../src/services/proof.js";

describe("be32", () => {
  it("encodes big-endian 32 bytes", () => {
    expect(be32(1n)).toEqual([...new Array(31).fill(0), 1]);
    expect(be32(256n)[30]).toBe(1);
    expect(be32(0n).every((b) => b === 0)).toBe(true);
  });
});

describe("formatProof", () => {
  const proof = {
    pi_a: ["1", "2", "1"],
    pi_b: [["1", "2"], ["3", "4"], ["1", "0"]],
    pi_c: ["5", "6", "1"],
  };

  it("produces the on-chain byte lengths", () => {
    const f = formatProof(proof, ["10", "20", "30", "40"]);
    expect(f.proofA.length).toBe(64);
    expect(f.proofB.length).toBe(128);
    expect(f.proofC.length).toBe(64);
    expect(f.publicInputs.length).toBe(4);
    expect(f.publicInputs.every((x) => x.length === 32)).toBe(true);
  });

  it("maps public-signal indices to the right fields", () => {
    const f = formatProof(proof, ["10", "20", "30", "40"]);
    expect(f.nullifierHash).toEqual(be32("10"));
    expect(f.merkleRoot).toEqual(be32("20"));
    expect(f.externalNullifier).toEqual(be32("30"));
  });

  it("swaps G2 c1||c0 ordering for proofB", () => {
    const f = formatProof(proof, ["10", "20", "30", "40"]);
    // first 32 bytes = pi_b[0][1] = "2"
    expect(f.proofB.slice(0, 32)).toEqual(be32("2"));
    expect(f.proofB.slice(32, 64)).toEqual(be32("1"));
  });
});
