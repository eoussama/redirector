import type { TBrand } from "@eoussama/core";
import type * as z from "zod/mini";

import type { linkSchema, linksSchema, mailtoLinkSchema, urlLinkSchema } from "./schema.ts";



/**
 * A normalized slug: lowercase, without leading or trailing slashes.
 */
export type TSlug = TBrand<string, "Slug">;

/** A link to a web page. */
export type TUrlLink = z.infer<typeof urlLinkSchema>;

/** A link that opens a prefilled email. */
export type TMailtoLink = z.infer<typeof mailtoLinkSchema>;

export type TLink = z.infer<typeof linkSchema>;

export type TLinks = Readonly<z.infer<typeof linksSchema>>;

/**
 * What a request resolved to: a known slug, an unknown one, or the bare root.
 */
export type TOutcome = "hit" | "miss" | "root";

export interface TResolution {
  readonly slug: TSlug;
  readonly outcome: TOutcome;
  readonly status: 301 | 302;
  readonly location: string;
}
