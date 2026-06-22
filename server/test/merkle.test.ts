import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { buildPoseidon } from "circomlibjs";
import { computeRoot } from "../src/services/merkle.js";

describe("computeRoot", () => {
  it("is deterministic and returns a decimal string", async () => {
    const r = await computeRoot(["1", "2", "3"]);
    expect(r).toMatch(/^\d+$/);
    expect(await computeRoot(["1", "2", "3"])).toBe(r);
  });

  it("distinguishes empty, single, and multi-member sets", async () => {
    const empty = await computeRoot([]);
    const one = await computeRoot(["1"]);
    const two = await computeRoot(["1", "2"]);
    expect(new Set([empty, one, two]).size).toBe(3);
  });

  // Cross-check against the actual circuit: gen-input.js uses secret
  // 12345678901234567890 as the sole member at leaf 0, so computeRoot of its
  // commitment must equal public.json[1] (the circuit's merkleRoot).
  it("matches the circuit's merkle root for a single member", async () => {
    const publicPath = "../circuits/build/public.json";
    if (!existsSync(publicPath)) return;
    const pub: string[] = JSON.parse(readFileSync(publicPath, "utf8"));
    const poseidon = await buildPoseidon();
    const commitment = BigInt(
      poseidon.F.toString(poseidon([12345678901234567890n]))
    ).toString();
    expect(await computeRoot([commitment])).toBe(pub[1]);
  });
});
