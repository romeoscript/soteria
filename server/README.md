# Soteria backend

Express + TypeScript service backing the three primitives. It is the off-chain
half of the ZK + stealth flows and the **only component that holds keys**:

- **Stealth announcement registry** — senders publish ephemeral keys + view tags;
  recipients scan. Public, unlinkable data only.
- **Member sets** — stores Poseidon identity commitments per set, recomputes the
  canonical Merkle root server-side, and (with an authority key) publishes it into
  the on-chain group's root ring buffer.
- **Proof relay** — accepts a snarkjs proof + public signals, formats the bytes,
  and submits `verify_proof` on-chain with a **relayer** key (with a compute-budget
  bump) so the prover's wallet never appears.

## Architecture

```
src/
  config.ts            zod-validated env + capability flags
  app.ts               createApp(deps) — helmet, CORS, rate-limit, pino, routes
  deps.ts              wires repos (pg|memory) + SolanaService
  index.ts             bootstrap + graceful shutdown
  middleware/          auth (x-api-key), validate (zod), error handler
  routes/              health · announcements · sets · groups · relay
  repositories/        interfaces + Postgres (drizzle) + in-memory impls
  services/
    merkle.ts          server-side Poseidon root (matches the circuit/SDK)
    proof.ts           snarkjs → on-chain byte formatting (matches prover.ts)
    solana.ts          connection + anchor program + tx senders
  db/                  drizzle schema, pg client, SQL migrator
drizzle/               ordered .sql migrations
```

Dependencies are injected (`AppDeps`), so routes are tested against in-memory
fakes; Postgres and on-chain features degrade gracefully when unconfigured (the
server still boots — see `GET /health` `capabilities`).

## Run

```bash
cp server/.env.example server/.env      # fill in DATABASE_URL + keys as needed
npm install
npm -w server run migrate               # if DATABASE_URL is set
npm -w server run dev                    # http://localhost:8787
npm -w server test                       # vitest
```

## API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | – | status + capability flags |
| POST | `/announce` | – | publish a stealth announcement |
| GET | `/announcements?sinceSlot&limit` | – | scan announcements |
| GET | `/sets/:id` | – | set metadata + commitments |
| POST | `/sets/:id/members` | api key | add commitment, recompute root |
| POST | `/groups` | api key + authority | create on-chain group, link a set |
| POST | `/sets/:id/publish` | api key + authority | publish current root on-chain |
| POST | `/relay/verify` | – (needs relayer) | format + submit `verify_proof` |

Admin routes require `x-api-key: $ADMIN_API_KEY`. On-chain routes return `503`
until the relevant keypair is configured.
