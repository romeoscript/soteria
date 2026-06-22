import { Router } from "express";
import type { AppDeps } from "../app.js";
import { asyncHandler } from "../middleware/error.js";
import { validate } from "../middleware/validate.js";
import { announceBody, announcementsQuery } from "../schemas.js";

// Stealth announcement registry: public, unlinkable data only (no funds move).
export function announcementRoutes({ repos }: AppDeps): Router {
  const r = Router();

  r.post(
    "/announce",
    validate({ body: announceBody }),
    asyncHandler(async (req, res) => {
      const a = await repos.announcements.add({
        ephemeralPub: req.body.ephemeralPub,
        viewTag: req.body.viewTag,
        stealthPub: req.body.stealthPub ?? null,
        slot: req.body.slot ?? null,
        signature: req.body.signature ?? null,
      });
      res.status(201).json({ ok: true, id: a.id });
    })
  );

  r.get(
    "/announcements",
    validate({ query: announcementsQuery }),
    asyncHandler(async (req, res) => {
      const { sinceSlot, limit } = req.query as unknown as {
        sinceSlot?: number;
        limit: number;
      };
      const announcements = await repos.announcements.list({ sinceSlot, limit });
      res.json({ announcements });
    })
  );

  return r;
}
