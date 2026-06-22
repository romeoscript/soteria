export interface Announcement {
  id: number;
  ephemeralPub: string;
  viewTag: number;
  stealthPub: string | null;
  slot: number | null;
  signature: string | null;
  createdAt: Date;
}

export type NewAnnouncement = Omit<Announcement, "id" | "createdAt">;

export interface MemberSet {
  id: string;
  groupId: number | null;
  root: string | null;
  memberCount: number;
}

export interface Nullifier {
  hash: string;
  groupId: number;
  signature: string | null;
  createdAt: Date;
}

export interface AnnouncementRepo {
  add(a: NewAnnouncement): Promise<Announcement>;
  list(opts: { sinceSlot?: number; limit: number }): Promise<Announcement[]>;
}

export interface SetRepo {
  getOrCreate(id: string): Promise<MemberSet>;
  get(id: string): Promise<MemberSet | null>;
  getMembers(id: string): Promise<string[]>;
  /** Append a commitment; returns its leaf index, or null if already present. */
  addMember(id: string, commitment: string): Promise<number | null>;
  setRoot(id: string, root: string): Promise<void>;
  setGroupId(id: string, groupId: number): Promise<void>;
}

export interface NullifierRepo {
  isSpent(hash: string): Promise<boolean>;
  markSpent(n: Nullifier): Promise<void>;
}

export interface Repositories {
  announcements: AnnouncementRepo;
  sets: SetRepo;
  nullifiers: NullifierRepo;
}
