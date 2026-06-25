import {
  bigint,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const announcements = pgTable(
  "announcements",
  {
    id: serial("id").primaryKey(),
    ephemeralPub: text("ephemeral_pub").notNull(),
    viewTag: integer("view_tag").notNull(),
    stealthPub: text("stealth_pub"),
    slot: bigint("slot", { mode: "number" }),
    signature: text("signature"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("announcements_slot_idx").on(t.slot)]
);

export const sets = pgTable("sets", {
  id: text("id").primaryKey(),
  groupId: bigint("group_id", { mode: "number" }),
  root: text("root"),
  memberCount: integer("member_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const members = pgTable(
  "members",
  {
    id: serial("id").primaryKey(),
    setId: text("set_id")
      .notNull()
      .references(() => sets.id),
    leafIndex: integer("leaf_index").notNull(),
    commitment: text("commitment").notNull(),
  },
  (t) => [
    uniqueIndex("members_set_commitment_idx").on(t.setId, t.commitment),
    index("members_set_idx").on(t.setId),
  ]
);

export const nullifiers = pgTable("nullifiers", {
  hash: text("hash").primaryKey(),
  groupId: bigint("group_id", { mode: "number" }).notNull(),
  signature: text("signature"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Hidden-amount shielded pool (Option B) ──
// Encrypted note secrets are NOT recoverable from chain, so the operator must
// persist them (with their tree position) to survive restarts.
export const shieldedRecords = pgTable(
  "shielded_records",
  {
    id: serial("id").primaryKey(),
    shieldedId: integer("shielded_id").notNull(),
    leafIndex: integer("leaf_index").notNull(),
    commitment: text("commitment").notNull(),
    encryptedSecret: text("encrypted_secret").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("shielded_records_pool_leaf_idx").on(t.shieldedId, t.leafIndex),
    index("shielded_records_pool_idx").on(t.shieldedId),
  ]
);

export const shieldedNullifiers = pgTable(
  "shielded_nullifiers",
  {
    shieldedId: integer("shielded_id").notNull(),
    nullifierKey: text("nullifier_key").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("shielded_nullifiers_idx").on(t.shieldedId, t.nullifierKey)]
);
