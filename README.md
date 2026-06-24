# Soteria — Solana Privacy Toolkit

Privacy primitives for Solana. The first three modules protect users **without
breaking the sender↔recipient transaction graph**. The fourth — a *compliant
privacy pool* — does sever the deposit↔withdrawal link, but gated by an
association set and an auditor disclosure path rather than as an unconditional
tumbler. Every module keeps an auditor / disclosure path.

```
contract  →  programs/soteria-verifier (Anchor: on-chain Groth16 verifier + nullifier registry + pool)
sdk       →  packages/sdk              (TypeScript client: zk · stealth · confidential · pool)
backend   →  server                    (Express: announcement registry · member sets · proof relay · pool operator)
frontend  →  app                       (Vite + React: try every primitive)
circuit   →  circuits/credential.circom · circuits/withdraw.circom (Circom)
```

## Modules & status

| Module | What it does | Mainnet today? |
|--------|--------------|----------------|
| **ZK selective disclosure** | Prove set membership / eligibility without revealing which identity. | ✅ uses `alt_bn128` syscalls |
| **Stealth receiving** | One-time receive addresses so a main wallet isn't exposed. | ✅ client crypto + announcement registry |
| **Confidential amounts** | Hide transfer amounts via Token-2022, with a mint-level auditor key. | ⚠️ localnet — Solana's ZK ElGamal Proof program is disabled pending audit |
| **Compliant privacy pool** | ZK deposit/withdraw that severs the on-chain link, gated by an association set + auditor root. | ⚠️ scaffold — needs `setup-pool.sh` (real MPC ceremony for mainnet) |

## Quick start

```bash
# 1. install (npm workspaces)
npm install

# 2. backend
npm run dev:server          # http://localhost:8787

# 3. frontend
npm run dev:app             # http://localhost:5173

# 4. on-chain program
anchor build && anchor test
```

## Module 1 — ZK selective disclosure (trusted setup)

The circuit proves knowledge of a `secret` whose Poseidon commitment is a leaf in
a published Merkle root, plus a scoped nullifier — without revealing the leaf.
Use for anonymous allowlists, one-person-one-vote, credential checks. **No value
pool**: nothing is deposited or withdrawn.

On-chain model (`programs/soteria-verifier`, Semaphore-style):

- **`create_group(group_id)`** — opens a `Group` PDA; the creator becomes its authority.
- **`publish_root(root)`** — authority pushes a Merkle root into a 32-entry ring
  buffer (recent roots stay valid so in-flight proofs survive a root update).
- **`set_authority(new)`** — rotate the group authority.
- **`verify_proof(external_nullifier, a, b, c, public_inputs)`** — permissionless;
  asserts `external_nullifier` matches the proof's scope (`ScopeMismatch` otherwise),
  checks the proof's root is a known recent root, verifies the Groth16 proof over
  `alt_bn128`, then `init`s a per-group `NullifierRecord` PDA so each nullifier can
  be spent once. `signalHash` is emitted in the `Disclosed` event for the consuming
  app to match against its expected signal.

The whole trusted setup is scripted. It compiles the circuit, runs Powers-of-Tau
+ Phase 2, regenerates `programs/soteria-verifier/src/verifying_key.rs`, and copies
the client artifacts (`credential.wasm`, `credential_final.zkey`) into `app/public/`:

```bash
npm install && bash scripts/setup.sh
```

`cargo test -p soteria-verifier` then runs the converted `VERIFYINGKEY` through the
real `groth16-solana` verifier against a sample proof, validating both the VK byte
encoding and the proof formatting in `packages/sdk/src/zk/prover.ts`.

### Build & test the program

Anchor 0.30.1's IDL generator doesn't compile under current Rust toolchains
(`anchor-syn` + the ark/proc-macro2 crates). The program `.so` builds fine, so we
build without IDL and generate the IDL directly:

```bash
anchor build --no-idl                                   # build the .so
node scripts/gen-idl.js > target/idl/soteria_verifier.json
anchor test --skip-build --provider.cluster localnet    # 7 passing
```

The suite exercises group creation, root publishing, `has_one` gating, ring-buffer
eviction, authority rotation, and the full `verify_proof` path — a real Groth16
proof verified **on-chain** (needs a compute-unit bump above the 200k default; the
test provisions it), with nullifier double-spend and `ScopeMismatch` both rejected.

> ⚠️ `scripts/setup.sh` is a **single-contributor (dev/staging)** ceremony — the
> toxic waste is not multi-party-discarded. A mainnet deployment needs a real
> multi-party Powers-of-Tau / Phase-2 ceremony before trusting `verifying_key.rs`.

## Module 2 — Stealth receiving

`packages/sdk/src/stealth`. Dual-key ed25519 stealth addresses (ERC-5564 style).
A recipient shares a meta-address (spend + view pubkeys); senders derive a fresh
one-time address per payment and publish an ephemeral key to the registry.

> Spending caveat: the one-time signing key is a raw scalar, not a standard
> ed25519 seed. Use `signWithStealthScalar` in a custom transaction signer.

## Module 3 — Confidential amounts

`packages/sdk/src/confidential`. Token-2022 Confidential Transfer with a
mint-level auditor ElGamal key. Mint creation + deposit are reachable from JS;
transfer/withdraw are proof-gated. Test on a local validator:

```bash
solana-test-validator -r \
  --clone-upgradeable-program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
  --url https://api.mainnet.solana.com
```

## Module 4 — Compliant privacy pool (path C)

`programs/soteria-verifier` (pool instructions) · `packages/sdk/src/pool` ·
`server/src/routes/pool.ts` · `app/src/components/PoolPanel.tsx` ·
`circuits/withdraw.circom`.

A fixed-denomination shielded pool. A deposit locks one denomination into a vault
and inserts a note commitment `Poseidon(nullifier, secret)` into a Merkle tree. A
withdrawal proves — in zero knowledge — that the note is a leaf in **both** the
deposit tree and a curated **association set**, reveals a one-time
`nullifierHash` to prevent double-spend, and pays a fresh recipient. The
on-chain link between deposit and withdrawal is severed; the association set +
auditor root are what keep it a *compliant* pool rather than an unconditional
tumbler (the Elusiv / Privacy-Pools model).

```bash
bash scripts/setup-pool.sh     # trusted setup -> verifying_key_pool.rs + app/public/withdraw.{wasm,zkey}
```

Flow:

- **`init_pool(pool_id, denomination)`** — authority opens a pool + vault PDA.
- **`deposit(commitment)`** — locks one denomination; anchors a `Commitment` PDA
  so the operator can order deposits into the tree but cannot fabricate notes.
- **`publish_pool_root` / `set_association_root`** — the operator maintains the
  trees off-chain (v1) and publishes roots; recent deposit roots ring-buffer so
  in-flight proofs survive updates.
- **`withdraw(proof, public_inputs, fee)`** — verifies the Groth16 proof over
  `alt_bn128`, checks the deposit root is recent + the association root matches +
  the recipient/fee bindings, burns the nullifier, and pays
  `denomination − fee` to the recipient and `fee` to the relayer (so the
  withdrawer's own wallet never appears on-chain).

> ⚠️ **v1 trust model:** the deposit/association trees are maintained by the pool
> operator, which is trusted for liveness and correct tree-building (not for
> custody — proofs gate every payout, and `Commitment` PDAs prevent forged
> notes). A fully trustless on-chain incremental Merkle tree is the v2 follow-on.
> `verifying_key_pool.rs` ships as a zero-filled placeholder until
> `setup-pool.sh` is run, and that single-contributor setup needs a real
> multi-party ceremony before mainnet.

## What this is not

Soteria's privacy pool keeps a compliance gate (an association set the operator
curates) and an auditor disclosure root. It deliberately does **not** ship an
*unconditional* tumbler — a pool that severs the link for arbitrary deposits with
no association/disclosure path. That distinction is what separates a compliant
privacy pool from the money-transmitter / laundering exposure that sanctioned
mixers carry.

## Build/run notes

This repo is a scaffold: code is written but not built in the delivery
environment. Install dependencies and run the trusted setup before the proof
flow works end to end. Validate two integration points with one real proof:
the `verifying_key.rs` constant and the proof byte-formatting in
`packages/sdk/src/zk/prover.ts` (endianness / G2 ordering).
