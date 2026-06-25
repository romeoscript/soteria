#!/usr/bin/env bash
# Trusted setup for circuits/transaction.circom (Option B: hidden amounts) ->
# verifying_key_transaction.rs + runtime artifacts. Mirrors setup-pool.sh.
#
# ⚠️ Single-contributor (dev) setup. The hidden-amount circuit is UNAUDITED and
# this ceremony is not multi-party — do NOT hold real funds with it. A mainnet
# deployment needs an audit + a real Powers-of-Tau / Phase-2 ceremony.
#
#   npm install && bash scripts/setup-transaction.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BUILD=circuits/build
mkdir -p "$BUILD"

SNARKJS="node node_modules/snarkjs/cli.js"
ENTROPY1="$(head -c 64 /dev/urandom | base64)"
ENTROPY2="$(head -c 64 /dev/urandom | base64)"

echo "==> compiling transaction circuit"
circom circuits/transaction.circom --r1cs --wasm --sym -l node_modules -o "$BUILD"

# ~13k constraints -> 2^15 Powers-of-Tau.
echo "==> powers of tau (bn128, 2^15)"
$SNARKJS powersoftau new bn128 15 "$BUILD/potTx15_0000.ptau" -v
$SNARKJS powersoftau contribute "$BUILD/potTx15_0000.ptau" "$BUILD/potTx15_0001.ptau" --name="soteria-tx-1" -v -e="$ENTROPY1"
$SNARKJS powersoftau prepare phase2 "$BUILD/potTx15_0001.ptau" "$BUILD/potTx15_final.ptau" -v

echo "==> phase 2 (groth16)"
$SNARKJS groth16 setup "$BUILD/transaction.r1cs" "$BUILD/potTx15_final.ptau" "$BUILD/transaction_0000.zkey"
$SNARKJS zkey contribute "$BUILD/transaction_0000.zkey" "$BUILD/transaction_final.zkey" --name="soteria-tx-1" -v -e="$ENTROPY2"
$SNARKJS zkey export verificationkey "$BUILD/transaction_final.zkey" "$BUILD/verification_key_transaction.json"

echo "==> generating verifying_key_transaction.rs"
node scripts/vk-to-rust.js "$BUILD/verification_key_transaction.json" VERIFYINGKEY_TRANSACTION \
  > programs/soteria-verifier/src/verifying_key_transaction.rs

echo "==> publishing runtime artifacts to app/public"
mkdir -p app/public
cp "$BUILD/transaction_js/transaction.wasm" app/public/transaction.wasm
cp "$BUILD/transaction_final.zkey" app/public/transaction_final.zkey

echo "Done. verifying_key_transaction.rs regenerated; transaction.wasm + zkey in app/public."
