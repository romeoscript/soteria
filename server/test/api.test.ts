import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp, type AppDeps } from "../src/app.js";
import { buildMemoryRepos } from "../src/repositories/memory.js";

const ADMIN = "test-admin-key-0123456789";

const relayBody = {
  groupId: 0,
  proof: {
    pi_a: ["1", "2", "1"],
    pi_b: [["1", "2"], ["3", "4"], ["1", "0"]],
    pi_c: ["5", "6", "1"],
  },
  publicSignals: ["10", "20", "30", "40"],
};

function fakeSolana(): AppDeps["solana"] {
  return {
    canRelay: true,
    canPublishRoot: true,
    groupPda: () => ({ toBase58: () => "Grp1111111111111111111111111111111111111111" }),
    nullifierPda: () => ({}),
    groupExists: async () => false,
    createGroup: async () => "sig-create",
    publishRoot: async () => "sig-publish",
    verifyProof: async () => "sig-verify",
  } as unknown as AppDeps["solana"];
}

describe("api", () => {
  it("reports health + capabilities", async () => {
    const res = await request(createApp({ repos: buildMemoryRepos(), solana: null })).get(
      "/health"
    );
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.capabilities).toBeDefined();
  });

  it("validates and stores announcements", async () => {
    const app = createApp({ repos: buildMemoryRepos(), solana: null });
    expect((await request(app).post("/announce").send({ viewTag: 1 })).status).toBe(400);
    const ok = await request(app)
      .post("/announce")
      .send({ ephemeralPub: "AAAA", viewTag: 7 });
    expect(ok.status).toBe(201);
    const list = await request(app).get("/announcements");
    expect(list.body.announcements).toHaveLength(1);
  });

  it("guards member-add with api key and recomputes the root", async () => {
    const app = createApp({ repos: buildMemoryRepos(), solana: null });
    expect(
      (await request(app).post("/sets/demo/members").send({ commitment: "123" })).status
    ).toBe(401);
    const ok = await request(app)
      .post("/sets/demo/members")
      .set("x-api-key", ADMIN)
      .send({ commitment: "123" });
    expect(ok.status).toBe(201);
    expect(ok.body.root).toMatch(/^\d+$/);
    const dup = await request(app)
      .post("/sets/demo/members")
      .set("x-api-key", ADMIN)
      .send({ commitment: "123" });
    expect(dup.status).toBe(409);
  });

  it("relays a proof and rejects double-spend", async () => {
    const repos = buildMemoryRepos();
    expect(
      (await request(createApp({ repos, solana: null })).post("/relay/verify").send(relayBody))
        .status
    ).toBe(503);

    const app = createApp({ repos, solana: fakeSolana() });
    const first = await request(app).post("/relay/verify").send(relayBody);
    expect(first.status).toBe(200);
    expect(first.body.signature).toBe("sig-verify");
    const replay = await request(app).post("/relay/verify").send(relayBody);
    expect(replay.status).toBe(409);
  });

  it("creates an on-chain group (admin + authority)", async () => {
    const app = createApp({ repos: buildMemoryRepos(), solana: fakeSolana() });
    expect((await request(app).post("/groups").send({ groupId: 5 })).status).toBe(401);
    const res = await request(app)
      .post("/groups")
      .set("x-api-key", ADMIN)
      .send({ groupId: 5, setId: "demo" });
    expect(res.status).toBe(201);
    expect(res.body.signature).toBe("sig-create");
  });
});
