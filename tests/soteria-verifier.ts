import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { assert } from "chai";
import { SoteriaVerifier } from "../target/types/soteria_verifier";

const GROUP_SEED = Buffer.from("group");
const ROOT_HISTORY_SIZE = 64;

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
  const program = anchor.workspace.SoteriaVerifier as Program<SoteriaVerifier>;

  let groupId = 0;
  const nextGroup = () => groupId++;

  it("creates a group owned by its creator", async () => {
    const id = nextGroup();
    const group = groupPda(program.programId, id);

    await program.methods
      .createGroup(new anchor.BN(id))
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
      .createGroup(new anchor.BN(id))
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
      .createGroup(new anchor.BN(id))
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
      .createGroup(new anchor.BN(id))
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
      .createGroup(new anchor.BN(id))
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
      .createGroup(new anchor.BN(id))
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

  // Full proof path needs the trusted-setup artifacts (credential.wasm,
  // credential_final.zkey) and the real VERIFYINGKEY. Once available:
  //   1. build a Poseidon set with PoseidonMerkleTree, publish_root(tree.root())
  //   2. proveCredential(...) -> { proofA, proofB, proofC, publicInputs }
  //   3. verifyProof(externalNullifier, ...) succeeds; replay with the same
  //      nullifier fails on init
  //   4. a proof against an unpublished root fails with UnknownRoot
  //   5. a mismatched externalNullifier fails with ScopeMismatch
  it.skip("verifies a selective-disclosure proof and burns the nullifier", async () => {});
});
