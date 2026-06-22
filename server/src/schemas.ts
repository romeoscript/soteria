import { z } from "zod";

const decimal = z.string().regex(/^\d+$/, "must be a decimal string").max(80);
const base64 = z
  .string()
  .regex(/^[A-Za-z0-9+/]+={0,2}$/, "must be base64")
  .max(2048);
export const slug = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "invalid id");

export const announceBody = z.object({
  ephemeralPub: base64,
  viewTag: z.number().int().min(0).max(255),
  stealthPub: base64.optional(),
  slot: z.number().int().nonnegative().optional(),
  signature: base64.optional(),
});

export const announcementsQuery = z.object({
  sinceSlot: z.coerce.number().int().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export const setIdParam = z.object({ id: slug });

export const addMemberBody = z.object({ commitment: decimal });

export const createGroupBody = z.object({
  groupId: z.coerce.number().int().nonnegative(),
  setId: slug.optional(),
});

// Raw snarkjs proof + public signals; the server formats the bytes itself.
export const relayVerifyBody = z.object({
  groupId: z.coerce.number().int().nonnegative(),
  proof: z.object({
    pi_a: z.array(decimal).length(3),
    pi_b: z.array(z.array(decimal).length(2)).length(3),
    pi_c: z.array(decimal).length(3),
  }),
  // [nullifierHash, merkleRoot, externalNullifier, signalHash]
  publicSignals: z.array(decimal).length(4),
});

export type AnnounceBody = z.infer<typeof announceBody>;
export type RelayVerifyBody = z.infer<typeof relayVerifyBody>;
