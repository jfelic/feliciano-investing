import Imap from "imap";
import { simpleParser } from "mailparser";
import { parsePropertyEmail } from "./parser";
import type { ParsedProperty } from "./types";

export interface ImapConfig {
  user: string;
  password: string;
  host: string;
  port: number;
  tls: boolean;
}

/**
 * Fetch and parse property alert emails from inbox
 */
export async function fetchPropertyEmails(
  config: ImapConfig
): Promise<ParsedProperty[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap(config);
    const allProperties: ParsedProperty[] = [];

    imap.once("ready", () => {
      imap.openBox("INBOX", false, (err, box) => {
        if (err) {
          reject(err);
          return;
        }

        // Search for unread emails from real estate sources
        const searchCriteria = [
          "UNSEEN",
          [
            "OR",
            ["OR", "FROM", "zillow.com"],
            ["OR", "FROM", "redfin.com"],
            ["OR", "FROM", "realtor.com"],
            ["FROM", "land.com"],
          ],
        ];

        imap.search(searchCriteria, (searchErr, results) => {
          if (searchErr) {
            reject(searchErr);
            imap.end();
            return;
          }

          if (!results || results.length === 0) {
            console.log("No unread property emails found");
            resolve([]);
            imap.end();
            return;
          }

          console.log(`Found ${results.length} unread property emails`);

          const fetch = imap.fetch(results, { bodies: "" });

          fetch.on("message", (msg, seqno) => {
            msg.on("body", (stream) => {
              simpleParser(stream, async (parseErr, parsed) => {
                if (parseErr) {
                  console.error("Error parsing email:", parseErr);
                  return;
                }

                try {
                  const from = parsed.from?.text || "";
                  const html = parsed.html || "";

                  if (html) {
                    const result = parsePropertyEmail(html, from);

                    if (result.errors.length > 0) {
                      console.error("Parser errors:", result.errors);
                    }

                    allProperties.push(...result.properties);
                    console.log(
                      `Parsed ${result.properties.length} properties from email ${seqno}`
                    );
                  }
                } catch (error) {
                  console.error("Error processing email:", error);
                }
              });
            });
          });

          fetch.once("error", (fetchErr) => {
            console.error("Fetch error:", fetchErr);
            reject(fetchErr);
          });

          fetch.once("end", () => {
            console.log("Done fetching emails");
            imap.end();
          });
        });
      });
    });

    imap.once("error", (err) => {
      console.error("IMAP error:", err);
      reject(err);
    });

    imap.once("end", () => {
      console.log("IMAP connection ended");
      resolve(allProperties);
    });

    imap.connect();
  });
}

/**
 * Mark emails as read
 */
export async function markEmailsAsRead(
  config: ImapConfig,
  uids: number[]
): Promise<void> {
  return new Promise((resolve, reject) => {
    const imap = new Imap(config);

    imap.once("ready", () => {
      imap.openBox("INBOX", false, (err) => {
        if (err) {
          reject(err);
          return;
        }

        imap.addFlags(uids, ["\\Seen"], (flagErr) => {
          if (flagErr) {
            reject(flagErr);
          } else {
            resolve();
          }
          imap.end();
        });
      });
    });

    imap.once("error", (err) => {
      reject(err);
    });

    imap.connect();
  });
}
