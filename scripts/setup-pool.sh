#!/usr/bin/env bash
# Trusted setup for circuits/withdraw.circom -> verifying_key_pool.rs + runtime
# artifacts. Mirrors scripts/setup.sh for the privacy-pool withdraw circuit.
#
# NOTE: this is a single-contributor (dev/staging) setup. A mainnet deployment
# needs a real multi-party Powers-of-Tau / Phase-2 ceremony before the pool VK
# can be trusted to hold funds.
#
#   npm install && bash scripts/setup-pool.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BUILD=circuits/build
mkdir -p "$BUILD"

SNARKJS="node node_modules/snarkjs/cli.js"
ENTROPY1="$(head -c 64 /dev/urandom | base64)"
ENTROPY2="$(head -c 64 /dev/urandom | base64)"

echo "==> compiling withdraw circuit"
circom circuits/withdraw.circom --r1cs --wasm --sym -l node_modules -o "$BUILD"

# The withdraw circuit has two Merkle inclusions (deposit + association) so it is
# larger than credential.circom; bump Powers-of-Tau to 2^16.
echo "==> powers of tau (bn128, 2^16)"
$SNARKJS powersoftau new bn128 16 "$BUILD/pot16_0000.ptau" -v
$SNARKJS powersoftau contribute "$BUILD/pot16_0000.ptau" "$BUILD/pot16_0001.ptau" --name="soteria-pool-1" -v -e="$ENTROPY1"
$SNARKJS powersoftau prepare phase2 "$BUILD/pot16_0001.ptau" "$BUILD/pot16_final.ptau" -v

echo "==> phase 2 (groth16)"
$SNARKJS groth16 setup "$BUILD/withdraw.r1cs" "$BUILD/pot16_final.ptau" "$BUILD/withdraw_0000.zkey"
$SNARKJS zkey contribute "$BUILD/withdraw_0000.zkey" "$BUILD/withdraw_final.zkey" --name="soteria-pool-1" -v -e="$ENTROPY2"
$SNARKJS zkey export verificationkey "$BUILD/withdraw_final.zkey" "$BUILD/verification_key_pool.json"

echo "==> generating verifying_key_pool.rs"
node scripts/vk-to-rust.js "$BUILD/verification_key_pool.json" VERIFYINGKEY_POOL \
  > programs/soteria-verifier/src/verifying_key_pool.rs

echo "==> publishing runtime artifacts to app/public"
mkdir -p app/public
cp "$BUILD/withdraw_js/withdraw.wasm" app/public/withdraw.wasm
cp "$BUILD/withdraw_final.zkey" app/public/withdraw_final.zkey

echo "Done. verifying_key_pool.rs regenerated; withdraw.wasm + zkey in app/public."
