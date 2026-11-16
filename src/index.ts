import { logClick } from "./lib/analytics.ts";
import { links } from "./lib/links.ts";
import { resolve } from "./lib/resolve.ts";
import { methodNotAllowed, redirectResponse } from "./lib/response.ts";



export default {
  /**
   * Redirect a request to its link, the portfolio, or the portfolio's 404 page. Methods
   * other than GET and HEAD get a 405.
   *
   * @param request - The incoming request
   * @param env - The Worker's bindings
   * @returns The redirect
   */
  fetch(request, env): Response {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return methodNotAllowed();
    }

    const resolution = resolve(new URL(request.url), links);

    // HEAD requests come from link checkers and monitors, not people: not a click.
    if (request.method === "GET") {
      logClick(env.CLICKS, request, resolution);
    }

    return redirectResponse(resolution);
  },
} satisfies ExportedHandler<Env>;
