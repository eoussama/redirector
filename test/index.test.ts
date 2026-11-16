import { env, exports } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { qrSvg } from "../src/lib/qr.ts";



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
    expect(response.headers.get("Location")).toBe("https://ouss.es/404?from=%2Fdoes-not-exist");
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

  it("answers robots.txt and the favicon directly, without counting them", async () => {
    const write = vi.spyOn(env.CLICKS, "writeDataPoint");
    const robots = await call("/robots.txt");
    const favicon = await call("/favicon.ico");
    const faviconSvg = await call("/favicon.svg");

    expect(robots.status).toBe(200);
    expect(robots.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(robots.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(await robots.text()).toBe("User-agent: *\nAllow: /\n");

    for (const response of [favicon, faviconSvg]) {
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400");

      const body = await response.text();

      expect(body).toContain("prefers-color-scheme: dark");
      expect(body).toContain("class=\"a\"");
      expect(body).toContain("class=\"b\"");
      expect(body).toContain("<clipPath id=\"clip\">");
    }

    expect(write).not.toHaveBeenCalled();
  });

  it("serves a link's QR code, pointing at the HTTPS scan link, without counting it", async () => {
    const write = vi.spyOn(env.CLICKS, "writeDataPoint");
    const response = await exports.default.fetch(new Request("http://to.ouss.es/CV.qr"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(response.headers.get("Content-Disposition")).toBe("inline; filename=\"to.ouss.es-cv.svg\"");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await response.text()).toBe(qrSvg("https://to.ouss.es/cv?qr"));
    expect(write).not.toHaveBeenCalled();
  });

  it("sends the QR code of an unknown link to the 404 page, without counting it", async () => {
    const write = vi.spyOn(env.CLICKS, "writeDataPoint");
    const response = await call("/nope.qr");

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://ouss.es/404?from=%2Fnope");
    expect(write).not.toHaveBeenCalled();
  });

  it("never reads a decoded ? or # in a QR address as part of a URL", async () => {
    const write = vi.spyOn(env.CLICKS, "writeDataPoint");
    const cases: Array<[path: string, from: string]> = [["/cv%3F.qr", "cv?"], ["/cv%23x.qr", "cv#x"]];

    for (const [path, from] of cases) {
      const response = await call(path);

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(`https://ouss.es/404?from=${encodeURIComponent(`/${from}`)}`);
    }

    expect(write).not.toHaveBeenCalled();
  });

  it("treats a bare /.qr as an unknown path, not the root's QR code", async () => {
    const response = await call("/.qr");

    expect(response.headers.get("Location")).toBe("https://ouss.es/404?from=%2F.qr");
  });

  it("counts a scan as a scan", async () => {
    const write = vi.spyOn(env.CLICKS, "writeDataPoint");
    const response = await call("/github?qr");

    expect(response.headers.get("Location")).toBe("https://github.com/eoussama");
    expect(write.mock.calls[0]?.[0]?.blobs?.slice(0, 2)).toEqual(["github", "scan"]);
  });
});
