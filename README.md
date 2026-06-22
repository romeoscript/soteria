# Soteria — Solana Privacy Toolkit

Privacy primitives for Solana that protect users **without breaking the
sender↔recipient transaction graph**. No mixing pools, no deposit/withdraw that
severs the link between funds. Every module keeps an auditor / disclosure path.

```
contract  →  programs/soteria-verifier (Anchor: on-chain Groth16 verifier + nullifier registry)
sdk       →  packages/sdk              (TypeScript client: zk · stealth · confidential)
backend   →  server                    (Express: announcement registry · member sets · proof relay)
frontend  →  app                       (Vite + React: try all three primitives)
circuit   →  circuits/credential.circom (Circom selective-disclosure circuit)
```

## Modules & status

| Module | What it does | Mainnet today? |
|--------|--------------|----------------|
| **ZK selective disclosure** | Prove set membership / eligibility without revealing which identity. | ✅ uses `alt_bn128` syscalls |
| **Stealth receiving** | One-time receive addresses so a main wallet isn't exposed. | ✅ client crypto + announcement registry |
| **Confidential amounts** | Hide transfer amounts via Token-2022, with a mint-level auditor key. | ⚠️ localnet — Solana's ZK ElGamal Proof program is disabled pending audit |

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
- **`publish_root(root)`** — authority pushes a Merkle root into a 64-entry ring
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

## What this is not

Soteria deliberately omits any feature whose function is to pool deposits and let
them be withdrawn with the on-chain link severed. That design (a tumbler) is what
carries money-transmitter / laundering exposure; it is out of scope by choice.

## Build/run notes

This repo is a scaffold: code is written but not built in the delivery
environment. Install dependencies and run the trusted setup before the proof
flow works end to end. Validate two integration points with one real proof:
the `verifying_key.rs` constant and the proof byte-formatting in
`packages/sdk/src/zk/prover.ts` (endianness / G2 ordering).
