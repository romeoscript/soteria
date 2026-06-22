import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, createPool, closePool } from "../src/db/client.js";
import { buildPostgresRepos } from "../src/repositories/postgres.js";
import type { Repositories } from "../src/repositories/types.js";

// Real Postgres integration. Runs only when TEST_DATABASE_URL is set; otherwise
// skipped so the default unit suite stays DB-free.
const url = process.env.TEST_DATABASE_URL;
const suite = url ? describe : describe.skip;

suite("postgres repositories", () => {
  let repos: Repositories;

  beforeAll(async () => {
    const pool = createPool(url!);
    await pool.query(
      "TRUNCATE announcements, members, nullifiers, sets RESTART IDENTITY CASCADE"
    );
    repos = buildPostgresRepos(createDb(url!));
  });

  afterAll(async () => {
    await closePool();
  });

  it("persists and lists announcements with a slot cursor", async () => {
    await repos.announcements.add({
      ephemeralPub: "AA",
      viewTag: 1,
      stealthPub: null,
      slot: 10,
      signature: null,
    });
    await repos.announcements.add({
      ephemeralPub: "BB",
      viewTag: 2,
      stealthPub: "CC",
      slot: 20,
      signature: null,
    });
    const all = await repos.announcements.list({ limit: 100 });
    expect(all).toHaveLength(2);
    const recent = await repos.announcements.list({ sinceSlot: 15, limit: 100 });
    expect(recent).toHaveLength(1);
    expect(recent[0].ephemeralPub).toBe("BB");
  });

  it("assigns sequential leaf indices and rejects duplicate commitments", async () => {
    expect(await repos.sets.addMember("s1", "111")).toBe(0);
    expect(await repos.sets.addMember("s1", "222")).toBe(1);
    expect(await repos.sets.addMember("s1", "111")).toBeNull(); // duplicate
    expect(await repos.sets.addMember("s1", "333")).toBe(2);

    expect(await repos.sets.getMembers("s1")).toEqual(["111", "222", "333"]);
    const set = await repos.sets.get("s1");
    expect(set?.memberCount).toBe(3);
  });

  it("stores root and group link", async () => {
    await repos.sets.getOrCreate("s2");
    await repos.sets.setRoot("s2", "999");
    await repos.sets.setGroupId("s2", 42);
    const set = await repos.sets.get("s2");
    expect(set?.root).toBe("999");
    expect(set?.groupId).toBe(42);
  });

  it("tracks spent nullifiers idempotently", async () => {
    expect(await repos.nullifiers.isSpent("n1")).toBe(false);
    await repos.nullifiers.markSpent({
      hash: "n1",
      groupId: 0,
      signature: "sig",
      createdAt: new Date(),
    });
    expect(await repos.nullifiers.isSpent("n1")).toBe(true);
    // second mark is a no-op, not an error
    await repos.nullifiers.markSpent({
      hash: "n1",
      groupId: 0,
      signature: "sig2",
      createdAt: new Date(),
    });
    expect(await repos.nullifiers.isSpent("n1")).toBe(true);
  });
});
