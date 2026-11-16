import type { TBrand } from "@eoussama/core";
import type * as z from "zod/mini";

import type { linksSchema, mailtoLinkSchema } from "./schema.ts";



/**
 * A normalized slug: lowercase, without leading or trailing slashes.
 */
export type TSlug = TBrand<string, "Slug">;

/** A link that opens a prefilled email. */
export type TMailtoLink = z.infer<typeof mailtoLinkSchema>;

export type TLinks = Readonly<z.infer<typeof linksSchema>>;

/**
 * What a request resolved to: a known slug (`hit`, or `scan` when it came from a QR code),
 * an unknown one, a link past its `expires`, or the bare root.
 */
export type TOutcome = "hit" | "scan" | "miss" | "expired" | "root";

export interface TResolution {
  readonly slug: TSlug;
  readonly outcome: TOutcome;
  readonly status: 301 | 302;
  readonly location: string;
}
