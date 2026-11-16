import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { toError, tryCatch } from "@eoussama/core";

import { linksJsonSchema, validateLinks } from "../src/lib/schema.ts";



/*
 * Checks src/links.json, so a broken link fails the build before it is deployed, and that
 * src/links.schema.json still matches the Zod schema it is generated from.
 */

const root = join(import.meta.dirname, "../src");

const [error, links] = await tryCatch(async () => validateLinks(JSON.parse(await readFile(join(root, "links.json"), "utf8"))));

if (error !== null) {
  console.error(`✖ ${toError(error).message}`);
  process.exit(1);
}

console.log(`✔ links.json: ${Object.keys(links).length} links`);

const committed = await readFile(join(root, "links.schema.json"), "utf8");

if (committed !== `${JSON.stringify(linksJsonSchema(), null, 2)}\n`) {
  console.error("✖ links.schema.json is out of date: run `pnpm schema`");
  process.exit(1);
}

console.log("✔ links.schema.json is up to date");
