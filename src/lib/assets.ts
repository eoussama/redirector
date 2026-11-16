import { FAVICON_SVG } from "./brand.ts";
import { DAY_SECONDS } from "./time.ts";



/** Lets every crawler in, so link previews (Twitter, Slack, LinkedIn) still work; `X-Robots-Tag` keeps the redirects out of search results. */
const ROBOTS_TXT = "User-agent: *\nAllow: /\n";

/**
 * The response for the few files a browser or crawler asks any site for, so they are
 * answered directly instead of being redirected to the 404 page and counted as misses.
 *
 * @param pathname - The request URL's path
 * @returns The response, or `null` when the path is not one of them
 */
export function assetResponse(pathname: string): Response | null {
  switch (pathname) {
    case "/robots.txt":
      return new Response(ROBOTS_TXT, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": `public, max-age=${DAY_SECONDS}` } });

    case "/favicon.ico":

    case "/favicon.svg":
      return new Response(FAVICON_SVG, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": `public, max-age=${DAY_SECONDS}` } });

    default:
      return null;
  }
}
