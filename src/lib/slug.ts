import type { TSlug } from "./types.ts";

import { tryCatchSync } from "@eoussama/core";



/**
 * The slug a request path asks for, so that `/CV/` and `/cv` match the same link.
 *
 * @param pathname - The request URL's path, still percent-encoded
 * @returns The slug, lowercase and without surrounding slashes; empty for the root
 */
export function normalizeSlug(pathname: string): TSlug {
  const [, decoded] = tryCatchSync(() => decodeURIComponent(pathname));

  const path = decoded ?? pathname;

  // Trim slashes with a loop: a regex like /\/+$/ backtracks quadratically on long runs.
  let start = 0;
  let end = path.length;

  while (start < end && path[start] === "/") {
    start++;
  }

  while (end > start && path[end - 1] === "/") {
    end--;
  }

  return path.slice(start, end).toLowerCase() as TSlug;
}
