import { asc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { announcements, members, nullifiers, sets } from "../db/schema.js";
import type {
  Announcement,
  AnnouncementRepo,
  MemberSet,
  NewAnnouncement,
  Nullifier,
  NullifierRepo,
  Repositories,
  SetRepo,
} from "./types.js";

class PgAnnouncementRepo implements AnnouncementRepo {
  constructor(private db: Db) {}

  async add(a: NewAnnouncement): Promise<Announcement> {
    const [row] = await this.db.insert(announcements).values(a).returning();
    return row as Announcement;
  }

  async list(opts: { sinceSlot?: number; limit: number }): Promise<Announcement[]> {
    const rows = await this.db
      .select()
      .from(announcements)
      .where(opts.sinceSlot !== undefined ? gte(announcements.slot, opts.sinceSlot) : undefined)
      .orderBy(asc(announcements.id))
      .limit(opts.limit);
    return rows as Announcement[];
  }
}

class PgSetRepo implements SetRepo {
  constructor(private db: Db) {}

  async getOrCreate(id: string): Promise<MemberSet> {
    await this.db.insert(sets).values({ id }).onConflictDoNothing();
    return (await this.get(id))!;
  }

  async get(id: string): Promise<MemberSet | null> {
    const [row] = await this.db.select().from(sets).where(eq(sets.id, id));
    return row
      ? { id: row.id, groupId: row.groupId, root: row.root, memberCount: row.memberCount }
      : null;
  }

  async getMembers(id: string): Promise<string[]> {
    const rows = await this.db
      .select({ commitment: members.commitment })
      .from(members)
      .where(eq(members.setId, id))
      .orderBy(asc(members.leafIndex));
    return rows.map((r) => r.commitment);
  }

  // Append-with-index atomically; relies on the unique (set_id, commitment) index
  // to reject duplicates and the row count to assign the next leaf index.
  async addMember(id: string, commitment: string): Promise<number | null> {
    await this.getOrCreate(id);
    return this.db.transaction(async (tx) => {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(members)
        .where(eq(members.setId, id));
      const inserted = await tx
        .insert(members)
        .values({ setId: id, leafIndex: count, commitment })
        .onConflictDoNothing()
        .returning({ leafIndex: members.leafIndex });
      if (inserted.length === 0) return null;
      await tx
        .update(sets)
        .set({ memberCount: count + 1 })
        .where(eq(sets.id, id));
      return inserted[0].leafIndex;
    });
  }

  async setRoot(id: string, root: string): Promise<void> {
    await this.db.update(sets).set({ root }).where(eq(sets.id, id));
  }

  async setGroupId(id: string, groupId: number): Promise<void> {
    await this.db.update(sets).set({ groupId }).where(eq(sets.id, id));
  }
}

class PgNullifierRepo implements NullifierRepo {
  constructor(private db: Db) {}

  async isSpent(hash: string): Promise<boolean> {
    const [row] = await this.db
      .select({ hash: nullifiers.hash })
      .from(nullifiers)
      .where(eq(nullifiers.hash, hash));
    return Boolean(row);
  }

  async markSpent(n: Nullifier): Promise<void> {
    await this.db
      .insert(nullifiers)
      .values({ hash: n.hash, groupId: n.groupId, signature: n.signature })
      .onConflictDoNothing();
  }
}

export function buildPostgresRepos(db: Db): Repositories {
  return {
    announcements: new PgAnnouncementRepo(db),
    sets: new PgSetRepo(db),
    nullifiers: new PgNullifierRepo(db),
  };
}
