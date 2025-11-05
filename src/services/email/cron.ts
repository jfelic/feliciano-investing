import cron from "node-cron";
import { processPropertyEmails, cleanup } from "./processor";
import type { ImapConfig } from "./fetcher";

/**
 * Set up cron job to fetch and process property emails
 * @param schedule - Cron schedule (default: every 4 hours)
 * @param config - IMAP configuration
 * @param runImmediately - Whether to run immediately on startup (default: false)
 */
export function setupEmailCron(
  config: ImapConfig,
  schedule: string = "0 */4 * * *",
  runImmediately: boolean = false
) {
  console.log(`Setting up email cron job with schedule: ${schedule}`);

  // Run immediately on startup if requested
  if (runImmediately) {
    runEmailJob(config);
  }

  // Schedule recurring job
  const task = cron.schedule(schedule, async () => {
    await runEmailJob(config);
  });

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("Stopping email cron job...");
    task.stop();
    await cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("Stopping email cron job...");
    task.stop();
    await cleanup();
    process.exit(0);
  });

  return task;
}

/**
 * Run the email processing job
 */
async function runEmailJob(config: ImapConfig) {
  console.log(`[${new Date().toISOString()}] Running email processing job...`);

  try {
    const result = await processPropertyEmails(config);

    console.log(
      `[${new Date().toISOString()}] Email job completed: ${result.created} created, ${result.updated} updated`
    );

    if (result.errors.length > 0) {
      console.error(`Errors during processing:`, result.errors);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Email job failed:`, error);
  }
}

/**
 * Get IMAP config from environment variables
 */
export function getImapConfigFromEnv(): ImapConfig {
  const user = process.env.IMAP_USER;
  const password = process.env.IMAP_PASSWORD;
  const host = process.env.IMAP_HOST || "imap.gmail.com";
  const port = parseInt(process.env.IMAP_PORT || "993", 10);
  const tls = process.env.IMAP_TLS !== "false";

  if (!user || !password) {
    throw new Error("IMAP_USER and IMAP_PASSWORD must be set in .env");
  }

  return { user, password, host, port, tls };
}
