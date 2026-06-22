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

class MemoryAnnouncementRepo implements AnnouncementRepo {
  private rows: Announcement[] = [];
  private seq = 1;

  async add(a: NewAnnouncement): Promise<Announcement> {
    const row: Announcement = { id: this.seq++, createdAt: new Date(), ...a };
    this.rows.push(row);
    return row;
  }

  async list(opts: { sinceSlot?: number; limit: number }): Promise<Announcement[]> {
    return this.rows
      .filter((r) => opts.sinceSlot === undefined || (r.slot ?? 0) >= opts.sinceSlot)
      .slice(-opts.limit);
  }
}

interface SetState extends MemberSet {
  commitments: string[];
}

class MemorySetRepo implements SetRepo {
  private sets = new Map<string, SetState>();

  private ensure(id: string): SetState {
    let s = this.sets.get(id);
    if (!s) {
      s = { id, groupId: null, root: null, memberCount: 0, commitments: [] };
      this.sets.set(id, s);
    }
    return s;
  }

  async getOrCreate(id: string): Promise<MemberSet> {
    return strip(this.ensure(id));
  }

  async get(id: string): Promise<MemberSet | null> {
    const s = this.sets.get(id);
    return s ? strip(s) : null;
  }

  async getMembers(id: string): Promise<string[]> {
    return [...this.ensure(id).commitments];
  }

  async addMember(id: string, commitment: string): Promise<number | null> {
    const s = this.ensure(id);
    if (s.commitments.includes(commitment)) return null;
    const index = s.commitments.length;
    s.commitments.push(commitment);
    s.memberCount = s.commitments.length;
    return index;
  }

  async setRoot(id: string, root: string): Promise<void> {
    this.ensure(id).root = root;
  }

  async setGroupId(id: string, groupId: number): Promise<void> {
    this.ensure(id).groupId = groupId;
  }
}

class MemoryNullifierRepo implements NullifierRepo {
  private spent = new Map<string, Nullifier>();
  async isSpent(hash: string): Promise<boolean> {
    return this.spent.has(hash);
  }
  async markSpent(n: Nullifier): Promise<void> {
    this.spent.set(n.hash, n);
  }
}

function strip(s: SetState): MemberSet {
  return { id: s.id, groupId: s.groupId, root: s.root, memberCount: s.memberCount };
}

export function buildMemoryRepos(): Repositories {
  return {
    announcements: new MemoryAnnouncementRepo(),
    sets: new MemorySetRepo(),
    nullifiers: new MemoryNullifierRepo(),
  };
}
