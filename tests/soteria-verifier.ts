import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, ComputeBudgetProgram } from "@solana/web3.js";
import { assert } from "chai";
import { readFileSync, existsSync } from "fs";
import BN from "bn.js";

const Q =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n;

function be32(dec: string | bigint): number[] {
  let v = BigInt(dec);
  const out = new Array(32).fill(0);
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

const neg = (s: string | bigint) => (Q - (BigInt(s) % Q)) % Q;

const idl = JSON.parse(
  readFileSync("target/idl/soteria_verifier.json", "utf8")
);

const GROUP_SEED = Buffer.from("group");
const ROOT_HISTORY_SIZE = 32;

function u64le(n: number | bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
}

function groupPda(programId: PublicKey, groupId: number): PublicKey {
  return PublicKey.findProgramAddressSync(
    [GROUP_SEED, u64le(groupId)],
    programId
  )[0];
}

function root(byte: number): number[] {
  const r = new Array(32).fill(0);
  r[31] = byte;
  return r;
}

describe("soteria_verifier", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program: any = new anchor.Program(idl as anchor.Idl, provider);

  let groupId = 0;
  const nextGroup = () => groupId++;

  it("creates a group owned by its creator", async () => {
    const id = nextGroup();
    const group = groupPda(program.programId, id);

    await program.methods
      .createGroup(new BN(id))
      .accounts({ authority: provider.wallet.publicKey, group })
      .rpc();

    const acct = await program.account.group.fetch(group);
    assert.equal(acct.groupId.toNumber(), id);
    assert.ok(acct.authority.equals(provider.wallet.publicKey));
    assert.equal(acct.rootCount.toNumber(), 0);
  });

  it("lets the authority publish roots and tracks them", async () => {
    const id = nextGroup();
    const group = groupPda(program.programId, id);
    await program.methods
      .createGroup(new BN(id))
      .accounts({ authority: provider.wallet.publicKey, group })
      .rpc();

    await program.methods
      .publishRoot(root(1))
      .accounts({ authority: provider.wallet.publicKey, group })
      .rpc();

    const acct = await program.account.group.fetch(group);
    assert.equal(acct.rootCount.toNumber(), 1);
    assert.deepEqual(acct.roots[0], root(1));
  });

  it("rejects a zero root", async () => {
    const id = nextGroup();
    const group = groupPda(program.programId, id);
    await program.methods
      .createGroup(new BN(id))
      .accounts({ authority: provider.wallet.publicKey, group })
      .rpc();

    try {
      await program.methods
        .publishRoot(root(0))
        .accounts({ authority: provider.wallet.publicKey, group })
        .rpc();
      assert.fail("expected ZeroRoot");
    } catch (e) {
      assert.match((e as Error).toString(), /ZeroRoot/);
    }
  });

  it("rejects publishing from a non-authority", async () => {
    const id = nextGroup();
    const group = groupPda(program.programId, id);
    await program.methods
      .createGroup(new BN(id))
      .accounts({ authority: provider.wallet.publicKey, group })
      .rpc();

    const stranger = Keypair.generate();
    try {
      await program.methods
        .publishRoot(root(2))
        .accounts({ authority: stranger.publicKey, group })
        .signers([stranger])
        .rpc();
      assert.fail("expected has_one violation");
    } catch (e) {
      assert.match((e as Error).toString(), /has_one|ConstraintHasOne|unknown signer/i);
    }
  });

  it("evicts the oldest root once the ring buffer wraps", async () => {
    const id = nextGroup();
    const group = groupPda(program.programId, id);
    await program.methods
      .createGroup(new BN(id))
      .accounts({ authority: provider.wallet.publicKey, group })
      .rpc();

    for (let i = 1; i <= ROOT_HISTORY_SIZE + 1; i++) {
      await program.methods
        .publishRoot(root(i % 256))
        .accounts({ authority: provider.wallet.publicKey, group })
        .rpc();
    }

    const acct = await program.account.group.fetch(group);
    assert.equal(acct.rootCount.toNumber(), ROOT_HISTORY_SIZE + 1);
    // slot 0 (first root) was overwritten by the wrap-around push
    assert.deepEqual(acct.roots[0], root((ROOT_HISTORY_SIZE + 1) % 256));
  });

  it("rotates authority and locks out the old key", async () => {
    const id = nextGroup();
    const group = groupPda(program.programId, id);
    await program.methods
      .createGroup(new BN(id))
      .accounts({ authority: provider.wallet.publicKey, group })
      .rpc();

    const next = Keypair.generate();
    await program.methods
      .setAuthority(next.publicKey)
      .accounts({ authority: provider.wallet.publicKey, group })
      .rpc();

    const acct = await program.account.group.fetch(group);
    assert.ok(acct.authority.equals(next.publicKey));

    try {
      await program.methods
        .publishRoot(root(9))
        .accounts({ authority: provider.wallet.publicKey, group })
        .rpc();
      assert.fail("old authority should be locked out");
    } catch (e) {
      assert.match((e as Error).toString(), /has_one|ConstraintHasOne/i);
    }
  });

  // Full proof path — uses the artifacts produced by scripts/setup.sh. Skips
  // automatically if they're absent (e.g. CI without the trusted setup).
  const proofPath = "circuits/build/proof.json";
  const publicPath = "circuits/build/public.json";
  const maybeIt = existsSync(proofPath) && existsSync(publicPath) ? it : it.skip;

  maybeIt("verifies a proof, enforces scope, and burns the nullifier", async () => {
    const proof = JSON.parse(readFileSync(proofPath, "utf8"));
    const pub: string[] = JSON.parse(readFileSync(publicPath, "utf8"));
    // pub = [nullifierHash, merkleRoot, externalNullifier, signalHash]
    const proofA = [...be32(proof.pi_a[0]), ...be32(neg(proof.pi_a[1]))];
    const proofB = [
      ...be32(proof.pi_b[0][1]), ...be32(proof.pi_b[0][0]),
      ...be32(proof.pi_b[1][1]), ...be32(proof.pi_b[1][0]),
    ];
    const proofC = [...be32(proof.pi_c[0]), ...be32(proof.pi_c[1])];
    const publicInputs = pub.map((s) => be32(s));
    const externalNullifier = be32(pub[2]);
    const merkleRoot = be32(pub[1]);
    const cu = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

    const id = nextGroup();
    const group = groupPda(program.programId, id);
    await program.methods
      .createGroup(new BN(id))
      .accounts({ authority: provider.wallet.publicKey, group })
      .rpc();
    await program.methods
      .publishRoot(merkleRoot)
      .accounts({ authority: provider.wallet.publicKey, group })
      .rpc();

    const [nullifier] = PublicKey.findProgramAddressSync(
      [Buffer.from("nullifier"), u64le(id), Buffer.from(be32(pub[0]))],
      program.programId
    );

    await program.methods
      .verifyProof(externalNullifier, proofA, proofB, proofC, publicInputs)
      .accounts({ payer: provider.wallet.publicKey, group, nullifier })
      .preInstructions([cu])
      .rpc();

    const rec = await program.account.nullifierRecord.fetch(nullifier);
    assert.deepEqual(rec.nullifierHash, be32(pub[0]));

    // replay with the same nullifier fails at account init
    try {
      await program.methods
        .verifyProof(externalNullifier, proofA, proofB, proofC, publicInputs)
        .accounts({ payer: provider.wallet.publicKey, group, nullifier })
        .preInstructions([cu])
        .rpc();
      assert.fail("expected double-spend rejection");
    } catch (e) {
      assert.match((e as Error).toString(), /already in use|0x0|custom program error/i);
    }

    // a mismatched externalNullifier fails with ScopeMismatch (fresh group)
    const id2 = nextGroup();
    const group2 = groupPda(program.programId, id2);
    await program.methods
      .createGroup(new BN(id2))
      .accounts({ authority: provider.wallet.publicKey, group: group2 })
      .rpc();
    await program.methods
      .publishRoot(merkleRoot)
      .accounts({ authority: provider.wallet.publicKey, group: group2 })
      .rpc();
    const [nullifier2] = PublicKey.findProgramAddressSync(
      [Buffer.from("nullifier"), u64le(id2), Buffer.from(be32(pub[0]))],
      program.programId
    );
    try {
      await program.methods
        .verifyProof(be32("123"), proofA, proofB, proofC, publicInputs)
        .accounts({ payer: provider.wallet.publicKey, group: group2, nullifier: nullifier2 })
        .preInstructions([cu])
        .rpc();
      assert.fail("expected ScopeMismatch");
    } catch (e) {
      assert.match((e as Error).toString(), /ScopeMismatch/);
    }
  });
});
