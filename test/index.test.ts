import { env, exports } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";

import { qrSvg } from "../src/lib/qr.ts";



/*
 * The deployed Worker, end to end, with the real links.json and Analytics Engine binding.
 * Every route is tested in handler.test.ts, against links of its own.
 */

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

  it("redirects a link from links.json, and counts it in Analytics Engine", async () => {
    const write = vi.spyOn(env.CLICKS, "writeDataPoint");
    const response = await call("/cv");

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toMatch(/^https:\/\/ouss\.es\/.*utm_campaign=cv/);
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0]?.[0]?.blobs?.slice(0, 2)).toEqual(["cv", "hit"]);
  });

  it("sends an unknown path to the portfolio's 404 page", async () => {
    expect((await call("/does-not-exist")).headers.get("Location")).toBe("https://ouss.es/404?from=%2Fdoes-not-exist");
  });

  it("serves a QR code over HTTP too, pointing at the HTTPS link", async () => {
    const response = await exports.default.fetch(new Request("http://to.ouss.es/cv.qr"));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(qrSvg("https://to.ouss.es/cv?qr"));
  });

  it("answers robots.txt, and rejects other methods", async () => {
    expect((await call("/robots.txt")).status).toBe(200);
    expect((await call("/cv", { method: "POST" })).status).toBe(405);
  });
});
