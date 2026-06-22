import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "crypto";
import { config } from "../config.js";
import { AppError } from "./error.js";

// Guards admin / mutating routes with a static API key (x-api-key header).
// If ADMIN_API_KEY is unset the route is disabled rather than left open.
export function requireApiKey(req: Request, _res: Response, next: NextFunction) {
  const expected = config.ADMIN_API_KEY;
  if (!expected) {
    throw new AppError(503, "admin auth not configured", "auth_disabled");
  }
  const provided = req.header("x-api-key") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError(401, "invalid or missing api key", "unauthorized");
  }
  next();
}
