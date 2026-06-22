import { Router } from "express";
import type { AppDeps } from "../app.js";
import { AppError, asyncHandler } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { requireApiKey } from "../middleware/auth.js";
import { createGroupBody, setIdParam } from "../schemas.js";

// Admin: on-chain group lifecycle, gated on a configured authority keypair.
export function groupRoutes({ repos, solana }: AppDeps): Router {
  const r = Router();

  const requireAuthority = () => {
    if (!solana || !solana.canPublishRoot) {
      throw new AppError(503, "authority keypair not configured", "authority_disabled");
    }
    return solana;
  };

  r.post(
    "/groups",
    requireApiKey,
    validate({ body: createGroupBody }),
    asyncHandler(async (req, res) => {
      const svc = requireAuthority();
      const { groupId, setId } = req.body as { groupId: number; setId?: string };
      if (await svc.groupExists(groupId)) {
        throw new AppError(409, "group already exists on-chain", "duplicate");
      }
      const signature = await svc.createGroup(groupId);
      if (setId) {
        await repos.sets.getOrCreate(setId);
        await repos.sets.setGroupId(setId, groupId);
      }
      res.status(201).json({
        ok: true,
        groupId,
        groupPda: svc.groupPda(groupId).toBase58(),
        signature,
      });
    })
  );

  // Publish a set's current root into its on-chain group's ring buffer.
  r.post(
    "/sets/:id/publish",
    requireApiKey,
    validate({ params: setIdParam }),
    asyncHandler(async (req, res) => {
      const svc = requireAuthority();
      const set = await repos.sets.get(req.params.id as string);
      if (!set) throw new AppError(404, "set not found", "not_found");
      if (set.groupId === null) {
        throw new AppError(409, "set is not linked to an on-chain group", "no_group");
      }
      if (!set.root) throw new AppError(409, "set has no root yet", "no_root");
      const signature = await svc.publishRoot(set.groupId, set.root);
      res.json({ ok: true, groupId: set.groupId, root: set.root, signature });
    })
  );

  return r;
}
