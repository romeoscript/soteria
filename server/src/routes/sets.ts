import { Router } from "express";
import type { AppDeps } from "../app.js";
import { AppError, asyncHandler } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { requireApiKey } from "../middleware/auth.js";
import { addMemberBody, setIdParam } from "../schemas.js";
import { computeRoot } from "../services/merkle.js";

export function setRoutes({ repos }: AppDeps): Router {
  const r = Router();

  r.get(
    "/sets/:id",
    validate({ params: setIdParam }),
    asyncHandler(async (req, res) => {
      const id = req.params.id as string;
      const set = await repos.sets.get(id);
      if (!set) throw new AppError(404, "set not found", "not_found");
      const commitments = await repos.sets.getMembers(id);
      res.json({ ...set, commitments });
    })
  );

  // Privileged: appending a member redefines the allowlist, so the server
  // recomputes the canonical Poseidon root itself rather than trusting a client.
  r.post(
    "/sets/:id/members",
    requireApiKey,
    validate({ params: setIdParam, body: addMemberBody }),
    asyncHandler(async (req, res) => {
      const id = req.params.id as string;
      const index = await repos.sets.addMember(id, req.body.commitment);
      if (index === null) {
        throw new AppError(409, "commitment already in set", "duplicate");
      }
      const commitments = await repos.sets.getMembers(id);
      const root = await computeRoot(commitments);
      await repos.sets.setRoot(id, root);
      res.status(201).json({ ok: true, index, root, memberCount: commitments.length });
    })
  );

  return r;
}
