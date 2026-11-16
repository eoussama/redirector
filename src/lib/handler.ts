import type { TLinks, TSlug } from "./types.ts";

import { logClick } from "./analytics.ts";
import { assetResponse } from "./assets.ts";
import { qrSvg } from "./qr.ts";
import { findLink, notFoundResolution, QR_MARKER, resolve } from "./resolve.ts";
import { methodNotAllowed, qrResponse, redirectResponse } from "./response.ts";
import { expiresAt } from "./schema.ts";
import { normalizeSlug } from "./slug.ts";



/** The address QR codes point to: always HTTPS, whatever the request for the image used. */
const PUBLIC_ORIGIN = "https://to.ouss.es";

/** The path suffix that asks for a link's QR code instead of the redirect: `/cv.qr`. */
const QR_SUFFIX = ".qr";

/** QR codes already drawn by this isolate. A code depends only on its short path, and only known links get one, so this stays small. */
const qrCache = new Map<string, string>();

/**
 * Redirect a request to its link, the portfolio, or the portfolio's 404 page; answer
 * `/<path>.qr` with the link's QR code, and `/robots.txt` and the favicon (`/favicon.ico`,
 * `/favicon.svg`) directly. Methods other than GET and HEAD get a 405.
 *
 * @param request - The incoming request
 * @param clicks - Where clicks are counted
 * @param links - The links, by short path
 * @param now - The current time, in milliseconds since the epoch
 * @returns The response
 */
export function handle(request: Request, clicks: AnalyticsEngineDataset, links: TLinks, now: number): Response {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return methodNotAllowed();
  }

  const url = new URL(request.url);
  const path = normalizeSlug(url.pathname);
  const asset = assetResponse(path);

  if (asset !== null) {
    return asset;
  }

  // `/cv.qr` → the QR code for `/cv`. Short paths can't contain dots, so this never hides
  // a link. Images aren't counted (scans are): an unknown or expired link's code goes to
  // the 404 page, uncounted.
  if (path.length > QR_SUFFIX.length && path.endsWith(QR_SUFFIX)) {
    const slug = path.slice(0, -QR_SUFFIX.length) as TSlug;
    const found = findLink(links, slug, now);

    if (found === undefined || found.expired) {
      return redirectResponse(notFoundResolution(path, found !== undefined));
    }

    let svg = qrCache.get(slug);

    if (svg === undefined) {
      svg = qrSvg(`${PUBLIC_ORIGIN}/${slug}?${QR_MARKER}`);
      qrCache.set(slug, svg);
    }

    return qrResponse(svg, slug, (expiresAt(found.link.expires) - now) / 1000);
  }

  const resolution = resolve(url, links, now);

  // HEAD requests come from link checkers and monitors, not people: not a click.
  if (request.method === "GET") {
    logClick(clicks, request, resolution);
  }

  return redirectResponse(resolution);
}
