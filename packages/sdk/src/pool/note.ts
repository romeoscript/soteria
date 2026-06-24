import { buildPoseidon } from "circomlibjs";

// BN254 scalar field order. nullifier/secret must be reduced mod this.
const FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * A pool note. Whoever holds (nullifier, secret) can withdraw the deposit whose
 * commitment = Poseidon(nullifier, secret). Losing it loses the funds — there is
 * no server-side copy.
 */
export interface Note {
  poolId: bigint;
  nullifier: bigint;
  secret: bigint;
}

let _poseidon: any;
async function poseidon(): Promise<any> {
  if (!_poseidon) _poseidon = await buildPoseidon();
  return _poseidon;
}

function randomFieldElement(): bigint {
  // 31 bytes = 248 bits < field order, so a single reduction is unbiased enough.
  const bytes = new Uint8Array(31);
  globalThis.crypto.getRandomValues(bytes);
  let v = 0n;
  for (const b of bytes) v = (v << 8n) | BigInt(b);
  return v % FIELD;
}

/** Generate a fresh note for a pool. */
export function randomNote(poolId: bigint | number): Note {
  return {
    poolId: BigInt(poolId),
    nullifier: randomFieldElement(),
    secret: randomFieldElement(),
  };
}

/** Note commitment = Poseidon(nullifier, secret) — the tree leaf. */
export async function commitment(note: Note): Promise<bigint> {
  const p = await poseidon();
  return BigInt(p.F.toString(p([note.nullifier, note.secret])));
}

/** nullifierHash = Poseidon(nullifier) — revealed at withdraw, public. */
export async function nullifierHash(note: Note): Promise<bigint> {
  const p = await poseidon();
  return BigInt(p.F.toString(p([note.nullifier])));
}

const PREFIX = "soteria-note-v1";

function toHex(v: bigint): string {
  return v.toString(16);
}

/** Serialize a note to the backup string the user must save to claim funds. */
export function encodeNote(note: Note): string {
  return [PREFIX, note.poolId.toString(), toHex(note.nullifier), toHex(note.secret)].join(":");
}

/** Parse a backup string back into a note. */
export function decodeNote(s: string): Note {
  const parts = s.trim().split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error("invalid note backup string");
  }
  return {
    poolId: BigInt(parts[1]),
    nullifier: BigInt("0x" + parts[2]),
    secret: BigInt("0x" + parts[3]),
  };
}

/** 32-byte big-endian encoding of a field element (tree leaf / PDA seed). */
export function toBytes32(v: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let x = v;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}
