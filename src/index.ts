import type { TSlug } from "./lib/types.ts";

import { logClick } from "./lib/analytics.ts";
import { assetResponse } from "./lib/assets.ts";
import { links } from "./lib/links.ts";
import { qrSvg } from "./lib/qr.ts";
import { findLink, notFoundResolution, QR_MARKER, resolve } from "./lib/resolve.ts";
import { methodNotAllowed, qrResponse, redirectResponse } from "./lib/response.ts";
import { expiresAt } from "./lib/schema.ts";
import { normalizeSlug } from "./lib/slug.ts";



/** The address QR codes point to: always HTTPS, whatever the request for the image used. */
const PUBLIC_ORIGIN = "https://to.ouss.es";

/** The path suffix that asks for a link's QR code instead of the redirect: `/cv.qr`. */
const QR_SUFFIX = ".qr";

/** QR codes already drawn by this isolate. The links are fixed for its lifetime, so this stays small. */
const qrCache = new Map<string, string>();

export default {
  /**
   * Redirect a request to its link, the portfolio, or the portfolio's 404 page; answer
   * `/<slug>.qr` with the link's QR code, and `/robots.txt` and the favicon (`/favicon.ico`,
   * `/favicon.svg`) directly. Methods other than GET and HEAD get a 405.
   *
   * @param request - The incoming request
   * @param env - The Worker's bindings
   * @returns The response
   */
  fetch(request, env): Response {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return methodNotAllowed();
    }

    const url = new URL(request.url);
    const asset = assetResponse(url.pathname);

    if (asset !== null) {
      return asset;
    }

    const now = Date.now();
    const path = normalizeSlug(url.pathname);

    // `/cv.qr` → the QR code for `/cv`. Slugs can't contain dots, so this never hides a
    // link. Images aren't counted (scans are): an unknown or expired link's code goes to
    // the 404 page, uncounted.
    if (path.length > QR_SUFFIX.length && path.endsWith(QR_SUFFIX)) {
      const slug = path.slice(0, -QR_SUFFIX.length) as TSlug;
      const found = findLink(links, slug, now);

      if (found === undefined || found.expired) {
        return redirectResponse(notFoundResolution(slug, found !== undefined));
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
      logClick(env.CLICKS, request, resolution);
    }

    return redirectResponse(resolution);
  },
} satisfies ExportedHandler<Env>;
