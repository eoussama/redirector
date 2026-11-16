import type { TLinks, TResolution, TSlug } from "./types.ts";

import { truncateBytes } from "./analytics.ts";
import { buildMailto } from "./mailto.ts";
import { expiresAt } from "./schema.ts";
import { normalizeSlug } from "./slug.ts";



/** Where the bare root goes: the portfolio. */
export const HOME_URL = "https://ouss.es/";

/** Where an unknown or expired slug goes: the portfolio's 404 page. */
const NOT_FOUND_URL = "https://ouss.es/404";

/** The query key QR codes add, so scans can be told apart. It is never passed on to a target. */
export const QR_MARKER = "qr";

/** How much of an unknown slug is passed on to the 404 page, in bytes, so a huge path cannot make a huge redirect. */
const FROM_BYTES = 256;

/**
 * The 404 page's URL for a slug.
 *
 * @param slug - The slug that has no working link
 * @returns The URL
 */
function notFound(slug: TSlug): string {
  const fallback = new URL(NOT_FOUND_URL);

  // The 404 page shows `ouss.es` followed by `from`, so it is passed as a path.
  fallback.searchParams.set("from", `/${truncateBytes(slug, FROM_BYTES)}`);

  return fallback.href;
}

/**
 * The redirect to the 404 page for a slug that has no working link.
 *
 * @param slug - The slug
 * @param expired - Whether the link exists but has expired
 * @returns The resolution
 */
export function notFoundResolution(slug: TSlug, expired: boolean): TResolution {
  return { slug, outcome: expired ? "expired" : "miss", status: 302, location: notFound(slug) };
}

/**
 * A slug's link, and whether it has expired.
 *
 * @param links - The links, by slug
 * @param slug - The slug
 * @param now - The current time, in milliseconds since the epoch
 * @returns The link and its state, or `undefined` when there is no such link
 */
export function findLink(links: TLinks, slug: string, now: number): { link: TLinks[string]; expired: boolean } | undefined {
  const link = Object.hasOwn(links, slug) ? links[slug] : undefined;

  return link === undefined ? undefined : { link, expired: expiresAt(link.expires) <= now };
}

/**
 * The redirect a request URL resolves to.
 *
 * @param url - The request URL
 * @param links - The links, by slug
 * @param now - The current time, in milliseconds since the epoch
 * @returns The slug, the outcome, and the redirect's status and location
 */
export function resolve(url: URL, links: TLinks, now: number = Date.now()): TResolution {
  const slug: TSlug = normalizeSlug(url.pathname);

  if (slug.length === 0) {
    return { slug, outcome: "root", status: 302, location: HOME_URL };
  }

  const found = findLink(links, slug, now);

  if (found === undefined || found.expired) {
    return notFoundResolution(slug, found !== undefined);
  }

  const { link } = found;

  const scanned = url.searchParams.has(QR_MARKER);
  const outcome = scanned ? "scan" : "hit";

  if ("mailto" in link) {
    return { slug, outcome, status: 302, location: buildMailto(link) };
  }

  const target = withUtm(link.url, slug, scanned ? "qr" : "shortlink");

  return { slug, outcome, status: link.permanent === true ? 301 : 302, location: forwardQuery(target, url) };
}

/**
 * Whether a URL is on ouss.es, where its UTM tags can be read.
 *
 * @param url - The URL
 * @returns Whether its host is ouss.es or one of its subdomains
 */
function isOwnSite(url: URL): boolean {
  return url.hostname === "ouss.es" || url.hostname.endsWith(".ouss.es");
}

/**
 * A link's URL with UTM tags, so the portfolio's analytics can tell where a visit came
 * from. Only ouss.es targets are tagged (other sites' analytics aren't readable), and tags
 * the link already has are kept. A request's own UTM tags still win, through
 * `forwardQuery`.
 *
 * @param targetUrl - The link's URL
 * @param slug - The link's slug, as the campaign
 * @param medium - `shortlink`, or `qr` for a scan
 * @returns The URL, tagged when it is on ouss.es
 */
export function withUtm(targetUrl: string, slug: TSlug, medium: "shortlink" | "qr"): string {
  const target = new URL(targetUrl);

  if (!isOwnSite(target)) {
    return targetUrl;
  }

  const tags = { utm_source: "to.ouss.es", utm_medium: medium, utm_campaign: slug };
  const added = Object.entries(tags)
    .filter(([key]) => !target.searchParams.has(key))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`);

  const existing = target.search.slice(1);

  target.search = [existing, ...added].filter(part => part.length > 0).join("&");

  return target.href;
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
 * for any key both have, and the QR marker is dropped. Both queries are joined as raw
 * text, so neither is re-encoded (`%20` stays `%20`, a bare `?flag` stays bare).
 *
 * @param targetUrl - The link's URL
 * @param request - The request URL
 * @returns The URL to redirect to
 */
export function forwardQuery(targetUrl: string, request: URL): string {
  const target = new URL(targetUrl);
  const forwarded = request.search.slice(1).split("&").filter(segment => segment.length > 0 && segmentKey(segment) !== QR_MARKER);

  if (forwarded.length === 0) {
    return target.href;
  }

  const overridden = new Set(forwarded.map(segmentKey));
  const kept = target.search.slice(1).split("&").filter(segment => segment.length > 0 && !overridden.has(segmentKey(segment)));

  target.search = [...kept, ...forwarded].join("&");

  return target.href;
}
