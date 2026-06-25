# Deploy

Three pieces: the **program** (already on devnet), the **backend** (Railway), and
the **frontend** (Cloudflare Pages / Vercel). The SDK is published to npm
(`@soteria1/sdk`) and bundled into the frontend — nothing to host.

---

## 1. Backend → Railway

The backend is a Node process + Postgres that holds the relayer/authority keys
and signs transactions. It must stay awake (a sleeping relayer = failed
withdrawals), which is why Railway over a free-tier-that-sleeps host.

### Steps

1. **Create the project**
   - railway.com → *New Project* → *Deploy from GitHub repo* → pick this repo.
   - Railway reads `railway.json` at the root, so the build/start commands are
     already configured (build the SDK + server, run migrations, then start).

2. **Add Postgres**
   - In the project → *New* → *Database* → *PostgreSQL*. Railway injects a
     `DATABASE_URL` you'll reference below.

3. **Set environment variables** (project → your service → *Variables*):

   | Variable | Value |
   |----------|-------|
   | `NODE_ENV` | `production` |
   | `HOST` | `0.0.0.0` |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the PG service) |
   | `SOLANA_RPC_URL` | a **dedicated** RPC, e.g. Helius devnet (`https://devnet.helius-rpc.com/?api-key=…`) |
   | `RELAYER_SECRET_KEY` | base58 secret key of a **funded** devnet keypair |
   | `AUTHORITY_SECRET_KEY` | base58 secret key of a **funded** devnet keypair |
   | `ADMIN_API_KEY` | a strong random string (≥16 chars) — gates admin routes |
   | `CORS_ORIGINS` | your frontend URL (e.g. `https://soteria.pages.dev`); `*` only for testing |
   | `LOG_IP` | `false` (default — no client IP logging) |
   | `TRUST_PROXY` | `false` |
   | `POOL_MIN_ANONYMITY_SET` | optional, e.g. `1` |

   `PORT` is injected by Railway automatically — don't set it; the server reads it.

   > ⚠️ `RELAYER_SECRET_KEY` / `AUTHORITY_SECRET_KEY` are real keys that sign and
   > pay fees. Keep them only in Railway's variables (never commit), and fund both
   > pubkeys with devnet SOL.

4. **Deploy** — Railway builds and starts it. Confirm health:
   `https://<your-app>.up.railway.app/health` → `{"ok":true,...}`.

5. **Initialize a shielded pool** (one-time, after first deploy):
   ```bash
   curl -X POST https://<your-app>.up.railway.app/shielded \
     -H "content-type: application/json" -H "x-api-key: $ADMIN_API_KEY" \
     -d '{"shieldedId":0}'
   ```
   Note the `shieldedId` you pick — the frontend uses it.

### What Railway runs (from `railway.json`)
- **build:** `npm install && npm run build:sdk && npm -w server run build`
- **start:** `npm -w server run migrate:prod && npm -w server start`
  (migrations are idempotent, so running them on every boot is safe)

---

## 2. Frontend → Vercel

A static Vite build; the SDK is bundled in. `vercel.json` at the repo root
already sets the build command, output dir, and SPA rewrites.

### Steps

1. **Import the project**
   - vercel.com → *Add New… → Project* → import this GitHub repo.
   - **Root Directory:** leave it as the **repo root** (`./`), NOT `app/`. The
     build must run from the root so the `@soteria1/sdk` workspace resolves and
     gets built. (`vercel.json` handles the rest.)
   - Framework Preset: **Other** (vercel.json overrides it anyway).

2. **Environment variables** (Project → Settings → Environment Variables):

   | Variable | Value |
   |----------|-------|
   | `VITE_SOLANA_RPC` | same dedicated RPC as the backend (Helius devnet) |
   | `VITE_SOTERIA_SERVER` | your Railway backend URL (e.g. `https://soteria.up.railway.app`) |
   | `VITE_SOTERIA_SHIELDED_ID` | the pool id you created (e.g. `0`) |

   These are **build-time** (Vite inlines them), so redeploy after changing them.

3. **Deploy.** The app serves `transaction.wasm` (2.5 MB) and
   `transaction_final.zkey` (12 MB) from `app/public` — Vercel handles these fine.

4. **Wire CORS:** copy the Vercel URL and set it as the backend's `CORS_ORIGINS`
   on Railway, then redeploy the backend.

### What Vercel runs (from `vercel.json`)
- **build:** `npm install && npm run build:sdk && npm -w @soteria/app run build`
- **output:** `app/dist`

---

## 3. RPC

Don't use the public `api.devnet.solana.com` in production — it rate-limits the
relayer and **blocks `getProgramAccounts`** (breaks pool rehydration). Use a free
**Helius** / QuickNode devnet endpoint for both `SOLANA_RPC_URL` and
`VITE_SOLANA_RPC`.

---

## Notes

- **Mainnet:** everything here is devnet. Going to mainnet needs a program
  redeploy there, mainnet-funded keys, an **audit** of the circuits/program, and
  a real multi-party trusted-setup ceremony.
- **Privacy hardening:** to run the backend behind the Tor onion (no client IP at
  all), see `scripts/onion.sh` — that's a more advanced, self-hosted setup, not
  Railway.
