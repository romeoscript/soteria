#!/usr/bin/env bash
# Trusted setup for circuits/credential.circom -> verifying_key.rs + runtime artifacts.
#
# NOTE: this is a single-contributor (dev/staging) setup. A mainnet deployment
# needs a real multi-party Powers-of-Tau / Phase-2 ceremony.
#
#   npm install && bash scripts/setup.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BUILD=circuits/build
mkdir -p "$BUILD"

SNARKJS="node node_modules/snarkjs/cli.js"
ENTROPY1="$(head -c 64 /dev/urandom | base64)"
ENTROPY2="$(head -c 64 /dev/urandom | base64)"

echo "==> compiling circuit"
circom circuits/credential.circom --r1cs --wasm --sym -l node_modules -o "$BUILD"

echo "==> powers of tau (bn128, 2^14)"
$SNARKJS powersoftau new bn128 14 "$BUILD/pot14_0000.ptau" -v
$SNARKJS powersoftau contribute "$BUILD/pot14_0000.ptau" "$BUILD/pot14_0001.ptau" --name="soteria-1" -v -e="$ENTROPY1"
$SNARKJS powersoftau prepare phase2 "$BUILD/pot14_0001.ptau" "$BUILD/pot14_final.ptau" -v

echo "==> phase 2 (groth16)"
$SNARKJS groth16 setup "$BUILD/credential.r1cs" "$BUILD/pot14_final.ptau" "$BUILD/credential_0000.zkey"
$SNARKJS zkey contribute "$BUILD/credential_0000.zkey" "$BUILD/credential_final.zkey" --name="soteria-1" -v -e="$ENTROPY2"
$SNARKJS zkey export verificationkey "$BUILD/credential_final.zkey" "$BUILD/verification_key.json"

echo "==> generating verifying_key.rs"
node scripts/vk-to-rust.js "$BUILD/verification_key.json" > programs/soteria-verifier/src/verifying_key.rs

echo "==> publishing runtime artifacts to app/public"
mkdir -p app/public
cp "$BUILD/credential_js/credential.wasm" app/public/credential.wasm
cp "$BUILD/credential_final.zkey" app/public/credential_final.zkey

echo "Done. verifying_key.rs regenerated; wasm + zkey in app/public."
