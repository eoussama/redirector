import { env, exports } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";



/**
 * Send a request through the Worker, without following its redirect.
 *
 * @param path - The path and query
 * @param init - Extra request options
 * @returns The Worker's response
 */
async function call(path: string, init: RequestInit = {}): Promise<Response> {
  return exports.default.fetch(new Request(`https://to.ouss.es${path}`, { redirect: "manual", ...init }));
}

describe("worker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ["/cv", ["cv", "hit"]],
    ["/nope", ["nope", "miss"]],
    ["/", ["", "root"]],
  ])("counts a GET on %s as a click, with its outcome", async (path, blobs) => {
    const write = vi.spyOn(env.CLICKS, "writeDataPoint");

    await call(path);

    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0]?.[0]?.blobs?.slice(0, 2)).toEqual(blobs);
  });

  it("redirects a link, with the redirect headers", async () => {
    const response = await call("/GitHub/?tab=repositories");

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://github.com/eoussama?tab=repositories");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=0");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("redirects a mailto link", async () => {
    const response = await call("/mail");

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toMatch(/^mailto:hi@ouss\.es\?subject=/);
  });

  it("sends the root to the portfolio", async () => {
    const response = await call("/");

    expect(response.headers.get("Location")).toBe("https://ouss.es/");
  });

  it("falls back to the portfolio's 404 page", async () => {
    const response = await call("/does-not-exist");

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://ouss.es/404?from=does-not-exist");
  });

  it("answers HEAD like GET, without counting a click", async () => {
    const write = vi.spyOn(env.CLICKS, "writeDataPoint");
    const response = await call("/github", { method: "HEAD" });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://github.com/eoussama");
    expect(write).not.toHaveBeenCalled();
  });

  it("rejects other methods, without counting a click", async () => {
    const write = vi.spyOn(env.CLICKS, "writeDataPoint");
    const response = await call("/github", { method: "POST" });

    expect(write).not.toHaveBeenCalled();
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD");
  });
});
