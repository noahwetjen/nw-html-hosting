import { getConfig } from './config.js';
import { Database } from './db.js';
import { createHttpApp } from './http.js';

async function main() {
  const config = getConfig();
  const db = new Database(config);
  await db.migrate();

  const app = createHttpApp(config, db);
  const server = app.listen(config.port, () => {
    console.log(`Shareable Agent HTML server listening on port ${config.port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
