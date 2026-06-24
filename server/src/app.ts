import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { errorHandler, notFound } from "./middleware/error.js";
import type { Repositories } from "./repositories/types.js";
import type { SolanaService } from "./services/solana.js";
import { healthRoutes } from "./routes/health.js";
import { announcementRoutes } from "./routes/announcements.js";
import { setRoutes } from "./routes/sets.js";
import { groupRoutes } from "./routes/groups.js";
import { relayRoutes } from "./routes/relay.js";
import { poolRoutes } from "./routes/pool.js";
import { confidentialRoutes } from "./routes/confidential.js";

export interface AppDeps {
  repos: Repositories;
  solana: SolanaService | null;
}

export function createApp(deps: AppDeps): Express {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: "1mb" }));
  app.use(pinoHttp({ logger }));
  app.use(
    rateLimit({
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.use(healthRoutes(deps));
  app.use(announcementRoutes(deps));
  app.use(setRoutes(deps));
  app.use(groupRoutes(deps));
  app.use(relayRoutes(deps));
  app.use(confidentialRoutes(deps));
  app.use(poolRoutes(deps));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
