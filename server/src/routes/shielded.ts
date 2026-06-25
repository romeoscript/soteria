import { Router } from "express";
import { PublicKey } from "@solana/web3.js";
import type { AppDeps } from "../app.js";
import { AppError, asyncHandler } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { requireApiKey } from "../middleware/auth.js";
import {
  createShieldedBody,
  shieldedDepositNotifyBody,
  shieldedIdParam,
  shieldedRelayBody,
} from "../schemas.js";
import { computeRoot } from "../services/merkle.js";
import { logger } from "../logger.js";

// In-memory operator state for the hidden-amount pool. v1: the encrypted note
// secrets live only here (lost on restart) — production persists them and
// rebuilds the tree from Transacted events.
interface Record {
  commitment: string;
  encryptedSecret: string;
  leafIndex: number;
}
interface ShieldedState {
  commitments: string[];
  records: Record[];
  spentNullifiers: string[];
  root: string | null;
}

const nfKey = (bytes: number[]) => bytes.join(",");

export function shieldedRoutes({ repos, solana }: AppDeps): Router {
  const r = Router();
  const pools = new Map<number, ShieldedState>();

  // Rebuild the in-memory state for one pool from persisted records.
  async function buildState(id: number): Promise<ShieldedState | null> {
    const { records, nullifiers } = await repos.shielded.load(id);
    if (records.length === 0 && solana && !(await solana.shieldedExists(id))) {
      return null;
    }
    const sorted = [...records].sort((a, b) => a.leafIndex - b.leafIndex);
    const commitments = sorted.map((x) => x.commitment);
    const state: ShieldedState = {
      commitments,
      records: sorted.map((x) => ({ commitment: x.commitment, encryptedSecret: x.encryptedSecret, leafIndex: x.leafIndex })),
      spentNullifiers: nullifiers,
      root: commitments.length ? await computeRoot(commitments) : null,
    };
    pools.set(id, state);
    return state;
  }

  // Rehydrate every persisted pool on startup so a restart loses nothing.
  repos.shielded
    .listIds()
    .then(async (ids) => {
      for (const id of ids) await buildState(id);
      logger.info({ pools: ids.length }, "rehydrated shielded pools from storage");
    })
    .catch((err) => logger.warn({ err: String(err) }, "shielded rehydrate failed"));

  const requireAuthority = () => {
    if (!solana || !solana.canPublishRoot) {
      throw new AppError(503, "authority keypair not configured", "authority_disabled");
    }
    return solana;
  };
  const getPool = async (id: number): Promise<ShieldedState> => {
    const cached = pools.get(id);
    if (cached) return cached;
    const built = await buildState(id);
    if (!built) throw new AppError(404, "shielded pool not found", "not_found");
    return built;
  };

  // Insert the two outputs, mirror their encrypted secrets, mark inputs spent,
  // and publish the new root on-chain.
  async function recordOutputs(
    id: number,
    pool: ShieldedState,
    commitments: string[],
    encryptedSecrets: string[],
    nullifiers: number[][]
  ): Promise<{ leafIndexStart: number; root: string }> {
    const leafIndexStart = pool.commitments.length;
    const newRecords = commitments.map((c, k) => ({
      shieldedId: id,
      commitment: c,
      encryptedSecret: encryptedSecrets[k],
      leafIndex: leafIndexStart + k,
    }));
    const nfKeys = nullifiers.map(nfKey);

    // Persist first so a crash mid-publish doesn't lose the encrypted notes.
    await repos.shielded.addRecords(newRecords);
    await repos.shielded.addNullifiers(id, nfKeys);

    for (const rec of newRecords) {
      pool.commitments.push(rec.commitment);
      pool.records.push({ commitment: rec.commitment, encryptedSecret: rec.encryptedSecret, leafIndex: rec.leafIndex });
    }
    pool.spentNullifiers.push(...nfKeys);
    pool.root = await computeRoot(pool.commitments);
    await requireAuthority().publishShieldedRoot(id, pool.root);
    return { leafIndexStart, root: pool.root };
  }

  // Admin: create the on-chain shielded pool and start mirroring.
  r.post(
    "/shielded",
    requireApiKey,
    validate({ body: createShieldedBody }),
    asyncHandler(async (req, res) => {
      const svc = requireAuthority();
      const id = req.body.shieldedId as number;
      if (await svc.shieldedExists(id)) {
        await getPool(id).catch(() => undefined); // cache it for use
        throw new AppError(409, "shielded pool already exists on-chain", "duplicate");
      }
      const signature = await svc.initShielded(id);
      pools.set(id, { commitments: [], records: [], spentNullifiers: [], root: null });
      res.status(201).json({
        ok: true,
        shieldedId: id,
        shieldedPda: svc.shieldedPda(id).toBase58(),
        relayer: svc.relayerPubkey,
        signature,
      });
    })
  );

  // State for scanning + building proofs.
  r.get(
    "/shielded/:id",
    validate({ params: shieldedIdParam }),
    asyncHandler(async (req, res) => {
      const id = Number(req.params.id);
      const pool = await getPool(id);
      res.json({
        shieldedId: id,
        root: pool.root,
        relayer: solana?.relayerPubkey ?? null,
        records: pool.records,
        spentNullifiers: pool.spentNullifiers,
      });
    })
  );

  // Deposit: client signed + sent the transact tx; mirror its outputs.
  r.post(
    "/shielded/:id/deposit-notify",
    validate({ params: shieldedIdParam, body: shieldedDepositNotifyBody }),
    asyncHandler(async (req, res) => {
      requireAuthority();
      const id = Number(req.params.id);
      const pool = await getPool(id);
      const { signature, commitments, encryptedSecrets, nullifiers } = req.body;

      if (solana && !(await solana.transactionHitsProgram(signature))) {
        throw new AppError(409, "deposit transaction not found or not for this program", "no_tx");
      }
      const out = await recordOutputs(id, pool, commitments, encryptedSecrets, nullifiers);
      res.status(201).json({ ok: true, ...out });
    })
  );

  // Withdraw / internal transfer: the relayer signs so the spender stays hidden.
  r.post(
    "/shielded/:id/relay",
    validate({ params: shieldedIdParam, body: shieldedRelayBody }),
    asyncHandler(async (req, res) => {
      if (!solana || !solana.canRelay) {
        throw new AppError(503, "relayer keypair not configured", "relay_disabled");
      }
      const id = Number(req.params.id);
      const pool = await getPool(id);
      const { proof, extAmount, fee, recipient, outputs } = req.body;

      let signature: string;
      try {
        signature = await solana.relayTransact(
          id,
          { ...proof, extAmount, fee },
          new PublicKey(recipient)
        );
      } catch (err) {
        const msg = String((err as Error)?.message ?? err);
        logger.warn({ err: msg, shieldedId: id }, "shielded relay failed");
        if (/already in use/i.test(msg)) throw new AppError(409, "note already spent", "spent");
        if (/PublicAmountMismatch|ExtDataHashMismatch/.test(msg))
          throw new AppError(400, "proof bindings do not match the request", "binding_mismatch");
        if (/ProofVerificationFailed|MalformedProof/.test(msg))
          throw new AppError(400, "proof failed verification", "invalid_proof");
        if (/UnknownRoot/.test(msg)) throw new AppError(400, "root is not recent", "unknown_root");
        if (/InsufficientVault/.test(msg)) throw new AppError(400, "vault balance too low", "insufficient");
        throw new AppError(502, "on-chain submission failed", "submission_failed");
      }

      const out = await recordOutputs(id, pool, outputs.commitments, outputs.encryptedSecrets, proof.nullifiers);
      res.json({ ok: true, signature, ...out });
    })
  );

  return r;
}
