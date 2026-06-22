import { config } from "./config.js";
import { logger } from "./logger.js";
import { createDb } from "./db/client.js";
import { buildMemoryRepos } from "./repositories/memory.js";
import { buildPostgresRepos } from "./repositories/postgres.js";
import { SolanaService } from "./services/solana.js";
import type { AppDeps } from "./app.js";

export function buildDeps(): AppDeps {
  let repos;
  if (config.DATABASE_URL) {
    repos = buildPostgresRepos(createDb(config.DATABASE_URL));
    logger.info("using postgres persistence");
  } else {
    repos = buildMemoryRepos();
    logger.warn("DATABASE_URL not set — using non-durable in-memory storage");
  }

  const solana = new SolanaService();
  logger.info(
    { canRelay: solana.canRelay, canPublishRoot: solana.canPublishRoot },
    "solana service initialized"
  );

  return { repos, solana };
}
