import { Router } from "express";
import type { AppDeps } from "../app.js";
import { AppError, asyncHandler } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { relayVerifyBody } from "../schemas.js";
import { formatProof } from "../services/proof.js";
import { logger } from "../logger.js";

// Public: submit a proof; the relayer pays fees and signs, so the prover's
// wallet never appears on-chain. Does not custody funds.
export function relayRoutes({ repos, solana }: AppDeps): Router {
  const r = Router();

  r.post(
    "/relay/verify",
    validate({ body: relayVerifyBody }),
    asyncHandler(async (req, res) => {
      if (!solana || !solana.canRelay) {
        throw new AppError(503, "relayer keypair not configured", "relay_disabled");
      }
      const { groupId, proof, publicSignals } = req.body;
      const nullifierHash = publicSignals[0];

      if (await repos.nullifiers.isSpent(nullifierHash)) {
        throw new AppError(409, "nullifier already spent", "spent");
      }

      const formatted = formatProof(proof, publicSignals);
      let signature: string;
      try {
        signature = await solana.verifyProof(groupId, formatted);
      } catch (err) {
        const msg = String((err as Error)?.message ?? err);
        logger.warn({ err: msg, groupId }, "verify_proof submission failed");
        if (/already in use/i.test(msg)) {
          throw new AppError(409, "nullifier already spent", "spent");
        }
        if (/ScopeMismatch/.test(msg)) {
          throw new AppError(400, "external nullifier does not match scope", "scope_mismatch");
        }
        if (/UnknownRoot/.test(msg)) {
          throw new AppError(400, "merkle root is not a known recent root", "unknown_root");
        }
        if (/ProofVerificationFailed|MalformedProof/.test(msg)) {
          throw new AppError(400, "proof failed verification", "invalid_proof");
        }
        throw new AppError(502, "on-chain submission failed", "submission_failed");
      }

      await repos.nullifiers.markSpent({
        hash: nullifierHash,
        groupId,
        signature,
        createdAt: new Date(),
      });
      res.json({ ok: true, signature });
    })
  );

  return r;
}
