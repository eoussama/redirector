import type { TResolution } from "./types.ts";



/** The methods the Worker answers; anything else gets a 405. */
export const ALLOWED_METHODS = "GET, HEAD";

/**
 * The HTTP response for a resolved request: a redirect that search engines don't index.
 * A 302 can be retargeted at any time, so browsers must not keep it; a 301 is cached on
 * purpose.
 *
 * @param resolution - What the request resolved to
 * @returns The redirect
 */
export function redirectResponse(resolution: TResolution): Response {
  const headers = new Headers({
    "Location": resolution.location,
    "X-Robots-Tag": "noindex",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });

  if (resolution.status === 302) {
    headers.set("Cache-Control", "private, max-age=0");
  }

  return new Response(null, { status: resolution.status, headers });
}

/**
 * The response for a method the Worker doesn't answer.
 *
 * @returns A 405 that lists the allowed methods
 */
export function methodNotAllowed(): Response {
  return new Response(null, { status: 405, headers: { Allow: ALLOWED_METHODS } });
}
