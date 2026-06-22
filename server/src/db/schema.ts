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
