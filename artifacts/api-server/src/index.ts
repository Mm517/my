import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { initPush } from "./lib/push";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// No Socket.io server anymore: the client subscribes directly to Supabase
// Realtime (Postgres Changes on messages/message_reactions/poll_votes/
// chat_settings, all already added to the `supabase_realtime` publication
// in supabase/migrations/001_initial_schema.sql). This server only needs
// to write rows — Supabase streams the change to every connected client.
const httpServer = createServer(app);

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
  void initPush();
});

httpServer.on("error", (err) => {
  logger.error({ err }, "Error starting server");
  process.exit(1);
});
