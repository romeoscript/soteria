// In-memory stores for development. Swap for Postgres/Redis in production —
// the announcement registry in particular should be durable and indexed by slot.

export interface StoredAnnouncement {
  ephemeralPub: string; // base64
  viewTag: number;
  stealthPub?: string; // base64
  slot?: number;
  signature?: string;
  createdAt: number;
}

export interface MemberSet {
  // commitment (decimal string) -> leaf index
  commitments: string[];
  root: string | null; // last published root (decimal string)
}

class Store {
  private announcements: StoredAnnouncement[] = [];
  private sets = new Map<string, MemberSet>();
  private spentNullifiers = new Set<string>();

  addAnnouncement(a: Omit<StoredAnnouncement, "createdAt">) {
    this.announcements.push({ ...a, createdAt: Date.now() });
  }

  // Announcements since an optional slot cursor (clients scan forward).
  getAnnouncements(sinceSlot?: number): StoredAnnouncement[] {
    if (sinceSlot === undefined) return this.announcements;
    return this.announcements.filter((a) => (a.slot ?? 0) >= sinceSlot);
  }

  getOrCreateSet(id: string): MemberSet {
    let s = this.sets.get(id);
    if (!s) {
      s = { commitments: [], root: null };
      this.sets.set(id, s);
    }
    return s;
  }

  addMember(setId: string, commitment: string): number {
    const s = this.getOrCreateSet(setId);
    const index = s.commitments.length;
    s.commitments.push(commitment);
    return index;
  }

  setRoot(setId: string, root: string) {
    this.getOrCreateSet(setId).root = root;
  }

  isSpent(nullifier: string) {
    return this.spentNullifiers.has(nullifier);
  }
  markSpent(nullifier: string) {
    this.spentNullifiers.add(nullifier);
  }
}

export const store = new Store();
