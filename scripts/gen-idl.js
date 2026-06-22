// Generate the Anchor 0.30 IDL for soteria_verifier directly, bypassing the
// broken host-side `anchor build` IDL generator (anchor-syn 0.30.1 + modern
// Rust/proc-macro2). Discriminators and type layouts mirror the program source.
//
//   node scripts/gen-idl.js > target/idl/soteria_verifier.json

const { createHash } = require("crypto");
const fs = require("fs");

const ADDRESS = "9HNLpUVFX61pX759oy1vuMMwQaQaGnK9KgMyhTrDrRGs";
const SYSTEM = "11111111111111111111111111111111";

const disc = (prefix, name) =>
  [...createHash("sha256").update(`${prefix}:${name}`).digest().subarray(0, 8)];

const u8arr = (n) => ({ array: ["u8", n] });
const bytes32 = u8arr(32);

const idl = {
  address: ADDRESS,
  metadata: {
    name: "soteria_verifier",
    version: "0.1.0",
    spec: "0.1.0",
    description: "Groth16 selective-disclosure verifier with per-group root registry",
  },
  instructions: [
    {
      name: "create_group",
      discriminator: disc("global", "create_group"),
      accounts: [
        { name: "authority", writable: true, signer: true },
        { name: "group", writable: true },
        { name: "system_program", address: SYSTEM },
      ],
      args: [{ name: "group_id", type: "u64" }],
    },
    {
      name: "publish_root",
      discriminator: disc("global", "publish_root"),
      accounts: [
        { name: "authority", signer: true },
        { name: "group", writable: true },
      ],
      args: [{ name: "new_root", type: bytes32 }],
    },
    {
      name: "set_authority",
      discriminator: disc("global", "set_authority"),
      accounts: [
        { name: "authority", signer: true },
        { name: "group", writable: true },
      ],
      args: [{ name: "new_authority", type: "pubkey" }],
    },
    {
      name: "verify_proof",
      discriminator: disc("global", "verify_proof"),
      accounts: [
        { name: "payer", writable: true, signer: true },
        { name: "group" },
        { name: "nullifier", writable: true },
        { name: "system_program", address: SYSTEM },
      ],
      args: [
        { name: "external_nullifier", type: bytes32 },
        { name: "proof_a", type: u8arr(64) },
        { name: "proof_b", type: u8arr(128) },
        { name: "proof_c", type: u8arr(64) },
        { name: "public_inputs", type: { array: [bytes32, 4] } },
      ],
    },
  ],
  accounts: [
    { name: "Group", discriminator: disc("account", "Group") },
    { name: "NullifierRecord", discriminator: disc("account", "NullifierRecord") },
  ],
  events: [
    { name: "GroupCreated", discriminator: disc("event", "GroupCreated") },
    { name: "RootPublished", discriminator: disc("event", "RootPublished") },
    { name: "AuthorityChanged", discriminator: disc("event", "AuthorityChanged") },
    { name: "Disclosed", discriminator: disc("event", "Disclosed") },
  ],
  errors: [
    { code: 6000, name: "UnknownRoot", msg: "merkle root is not among the group's recent published roots" },
    { code: 6001, name: "ZeroRoot", msg: "merkle root cannot be zero" },
    { code: 6002, name: "MalformedProof", msg: "proof bytes are malformed" },
    { code: 6003, name: "ProofVerificationFailed", msg: "zero-knowledge proof failed verification" },
    { code: 6004, name: "InvalidAuthority", msg: "new authority cannot be the default pubkey" },
    { code: 6005, name: "ScopeMismatch", msg: "proof's external nullifier does not match the expected scope" },
  ],
  types: [
    {
      name: "Group",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "pubkey" },
          { name: "group_id", type: "u64" },
          { name: "depth", type: "u8" },
          { name: "root_count", type: "u64" },
          { name: "current_root_index", type: "u32" },
          { name: "roots", type: { array: [bytes32, 32] } },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "NullifierRecord",
      type: {
        kind: "struct",
        fields: [
          { name: "group_id", type: "u64" },
          { name: "nullifier_hash", type: bytes32 },
          { name: "merkle_root", type: bytes32 },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "GroupCreated",
      type: {
        kind: "struct",
        fields: [
          { name: "group_id", type: "u64" },
          { name: "authority", type: "pubkey" },
        ],
      },
    },
    {
      name: "RootPublished",
      type: {
        kind: "struct",
        fields: [
          { name: "group_id", type: "u64" },
          { name: "root", type: bytes32 },
          { name: "index", type: "u32" },
        ],
      },
    },
    {
      name: "AuthorityChanged",
      type: {
        kind: "struct",
        fields: [
          { name: "group_id", type: "u64" },
          { name: "old_authority", type: "pubkey" },
          { name: "new_authority", type: "pubkey" },
        ],
      },
    },
    {
      name: "Disclosed",
      type: {
        kind: "struct",
        fields: [
          { name: "group_id", type: "u64" },
          { name: "nullifier_hash", type: bytes32 },
          { name: "merkle_root", type: bytes32 },
          { name: "external_nullifier", type: bytes32 },
          { name: "signal_hash", type: bytes32 },
        ],
      },
    },
  ],
};

process.stdout.write(JSON.stringify(idl, null, 2));
