import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { linksJsonSchema } from "../src/lib/schema.ts";



/*
 * Writes src/links.schema.json from the Zod schema. `pnpm validate` fails when it is stale.
 */

const path = join(import.meta.dirname, "../src/links.schema.json");

await writeFile(path, `${JSON.stringify(linksJsonSchema(), null, 2)}\n`);

console.log("✔ src/links.schema.json written");
