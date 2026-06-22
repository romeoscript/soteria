import { config } from "./config.js";
import { logger } from "./logger.js";
import { createApp } from "./app.js";
import { buildDeps } from "./deps.js";
import { closePool } from "./db/client.js";

const app = createApp(buildDeps());

const server = app.listen(config.PORT, () => {
  logger.info(`soteria server listening on http://localhost:${config.PORT}`);
});

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  server.close(async () => {
    await closePool().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
