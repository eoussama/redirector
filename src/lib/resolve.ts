import type { TLinks, TResolution, TSlug } from "./types.ts";

import { truncateBytes } from "./analytics.ts";
import { buildMailto } from "./mailto.ts";
import { normalizeSlug } from "./slug.ts";



/** Where the bare root goes: the portfolio. */
export const HOME_URL = "https://ouss.es/";

/** Where an unknown slug goes: the portfolio's 404 page. */
export const NOT_FOUND_URL = "https://ouss.es/404";

/** How much of an unknown slug is passed on to the 404 page, in bytes, so a huge path cannot make a huge redirect. */
const FROM_BYTES = 256;

/**
 * The redirect a request URL resolves to.
 *
 * @param url - The request URL
 * @param links - The links, by slug
 * @returns The slug, the outcome, and the redirect's status and location
 */
export function resolve(url: URL, links: TLinks): TResolution {
  const slug: TSlug = normalizeSlug(url.pathname);

  if (slug.length === 0) {
    return { slug, outcome: "root", status: 302, location: HOME_URL };
  }

  const link = Object.hasOwn(links, slug) ? links[slug] : undefined;

  if (link === undefined) {
    const fallback = new URL(NOT_FOUND_URL);

    fallback.searchParams.set("from", truncateBytes(slug, FROM_BYTES));

    return { slug, outcome: "miss", status: 302, location: fallback.href };
  }

  if ("mailto" in link) {
    return { slug, outcome: "hit", status: 302, location: buildMailto(link) };
  }

  return { slug, outcome: "hit", status: link.permanent === true ? 301 : 302, location: forwardQuery(link.url, url) };
}

/**
 * The key of one raw `key=value` query segment, decoded.
 *
 * @param segment - The segment, still encoded
 * @returns Its key
 */
function segmentKey(segment: string): string {
  return new URLSearchParams(segment).keys().next().value ?? "";
}

/**
 * A link's URL with the request's query string added. The request wins over the target
 * for any key both have. Both queries are joined as raw text, so neither is re-encoded
 * (`%20` stays `%20`, a bare `?flag` stays bare).
 *
 * @param targetUrl - The link's URL
 * @param request - The request URL
 * @returns The URL to redirect to
 */
export function forwardQuery(targetUrl: string, request: URL): string {
  const target = new URL(targetUrl);
  const forwarded = request.search.slice(1).split("&").filter(segment => segment.length > 0);

  if (forwarded.length === 0) {
    return target.href;
  }

  const overridden = new Set(forwarded.map(segmentKey));
  const kept = target.search.slice(1).split("&").filter(segment => segment.length > 0 && !overridden.has(segmentKey(segment)));

  target.search = [...kept, ...forwarded].join("&");

  return target.href;
}
