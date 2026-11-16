import { handle } from "./lib/handler.ts";
import { links } from "./lib/links.ts";



export default {
  /**
   * Answer a request: see `handle`.
   *
   * @param request - The incoming request
   * @param env - The Worker's bindings
   * @returns The response
   */
  fetch(request, env): Response {
    return handle(request, env.CLICKS, links, Date.now());
  },
} satisfies ExportedHandler<Env>;
