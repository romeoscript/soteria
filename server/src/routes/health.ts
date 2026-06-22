import { Router } from "express";
import { config } from "../config.js";
import type { AppDeps } from "../app.js";

export function healthRoutes(_deps: AppDeps): Router {
  const r = Router();
  r.get("/health", (_req, res) =>
    res.json({
      ok: true,
      service: "soteria",
      capabilities: config.capabilities,
    })
  );
  return r;
}
