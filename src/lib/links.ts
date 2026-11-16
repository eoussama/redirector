import type { TLinks } from "./types.ts";

import raw from "../links.json" with { type: "json" };
import { validateLinks } from "./schema.ts";



/** The links this Worker serves, checked once when the Worker starts. */
export const links: TLinks = validateLinks(raw);
