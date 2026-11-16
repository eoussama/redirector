import type { TResolution } from "./types.ts";

import { tryCatchSync } from "@eoussama/core";



/** Analytics Engine's limit on an index, in bytes. */
export const INDEX_BYTES = 96;

/** How much of a slug is kept in a blob, in bytes: plenty for real slugs, and far under the 16 KB per data point. */
export const SLUG_BYTES = 256;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * A string cut to at most a number of UTF-8 bytes, without splitting a character.
 *
 * @param value - The string
 * @param bytes - The most bytes to keep
 * @returns The string, cut if needed
 */
export function truncateBytes(value: string, bytes: number): string {
  const encoded = encoder.encode(value);

  if (encoded.length <= bytes) {
    return value;
  }

  // Never cut inside a character: back off to the start of the one the cut would split.
  let end = bytes;

  while (end > 0 && (encoded[end]! & 0b1100_0000) === 0b1000_0000) {
    end--;
  }

  return decoder.decode(encoded.subarray(0, end));
}

/**
 * The host a visitor came from, without its path or query. A host that is an IP address
 * (a page served from a bare IPv4 or IPv6 address) is left out, so no IP is ever stored.
 *
 * @param referer - The request's `Referer` header
 * @returns The host, or an empty string when there is none, it does not parse, or it is an IP address
 */
export function referrerHost(referer: string | null): string {
  if (referer === null) {
    return "";
  }

  const [, url] = tryCatchSync(() => new URL(referer));

  if (url === null || url.hostname.startsWith("[") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname)) {
    return "";
  }

  return url.host;
}

/**
 * Count a click in Analytics Engine: the slug, the outcome, the visitor's country and the
 * host they came from. Never the IP address or the user agent. `writeDataPoint` does not
 * block (Cloudflare sends the data after the response), and a failure never stands in the
 * way of the redirect.
 *
 * @param dataset - The Analytics Engine binding
 * @param request - The incoming request
 * @param resolution - What the request resolved to
 */
export function logClick(dataset: AnalyticsEngineDataset, request: Request, resolution: TResolution): void {
  const country = typeof request.cf?.country === "string" ? request.cf.country : "";

  tryCatchSync(() => dataset.writeDataPoint({
    indexes: [truncateBytes(resolution.slug, INDEX_BYTES)],
    blobs: [truncateBytes(resolution.slug, SLUG_BYTES), resolution.outcome, country, truncateBytes(referrerHost(request.headers.get("Referer")), SLUG_BYTES)],
    doubles: [1],
  }));
}
