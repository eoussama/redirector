import { parseArgs } from "node:util";

import { toError, tryCatch, tryCatchSync } from "@eoussama/core";



/*
 * Prints click counts from the redirector_clicks Analytics Engine dataset, using the
 * credentials in .env.stats (see .env.example).
 *
 *   pnpm stats                   clicks per slug and outcome, last 30 days
 *   pnpm stats --days 7          over the last 7 days (at most 90: data is kept for 90 days)
 *   pnpm stats --by country      clicks per country instead (or --by referrer)
 */

const DATASET = "redirector_clicks";
const GROUPS = { slug: ["blob1 AS slug", "blob2 AS outcome"], country: ["blob3 AS country"], referrer: ["blob4 AS referrer"] } as const;

/**
 * Print an error and stop.
 *
 * @param message - What went wrong
 */
function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

interface TSqlResponse {
  data?: Array<Record<string, string | number>>;
}

// `pnpm stats -- --days 7` passes a leading `--` through: drop it.
const args = process.argv.slice(2);

const [argsError, parsed] = tryCatchSync(() => parseArgs({
  args: args[0] === "--" ? args.slice(1) : args,
  options: {
    days: { type: "string", default: "30" },
    by: { type: "string", default: "slug" },
  },
}));

if (argsError !== null) {
  fail(`${toError(argsError).message}. Usage: pnpm stats [--days 1-90] [--by slug|country|referrer]`);
}

const { values } = parsed;

const accountId = process.env.STATS_ACCOUNT_ID;
const token = process.env.STATS_API_TOKEN;
const days = Number(values.days);

if (!Number.isInteger(days) || days < 1 || days > 90) {
  fail("--days must be a whole number from 1 to 90.");
}

if (!Object.hasOwn(GROUPS, values.by)) {
  fail(`--by must be one of: ${Object.keys(GROUPS).join(", ")}.`);
}

if (!accountId || !token) {
  fail("Set STATS_ACCOUNT_ID and STATS_API_TOKEN in .env.stats (see .env.example).");
}

const columns = GROUPS[values.by as keyof typeof GROUPS];
const names = columns.map(column => column.split(" AS ")[1]).join(", ");

// Analytics Engine samples at high volume: SUM(_sample_interval) is the true count.
const query = `
  SELECT ${columns.join(", ")}, SUM(_sample_interval) AS clicks
  FROM ${DATASET}
  WHERE timestamp > NOW() - INTERVAL '${days}' DAY
  GROUP BY ${names}
  ORDER BY clicks DESC
  FORMAT JSON
`;

const [error, response] = await tryCatch(fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: query,
}));

if (error !== null) {
  fail(`Could not reach Cloudflare: ${toError(error).message}`);
}

if (!response.ok) {
  fail(`Cloudflare answered ${response.status}: ${await response.text()}`);
}

const { data = [] } = await response.json() as TSqlResponse;

console.log(`Clicks over the last ${days} days, by ${values.by}:`);

if (data.length === 0) {
  console.log("  (none)");
}
else {
  console.table(data.map(row => ({ ...row, clicks: Number(row.clicks) })));
}
