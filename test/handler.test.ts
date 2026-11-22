import { describe, expect, it, vi } from "vitest";

import { handle } from "../src/lib/handler.ts";
import { qrSvg } from "../src/lib/qr.ts";
import { validateLinks } from "../src/lib/schema.ts";



/** Links for these tests, apart from the real links.json, so editing it never breaks them. */
const links = validateLinks({
  "cv": { url: "https://ouss.es/p/cv/" },
  "(dev)": { github: { url: "https://github.com/eoussama" } },
  "(design)": { dribbble: { url: "https://dribbble.com/EOussama" } },
  "(projects)": {
    "core": {
      url: "https://ouss.es/p/projects/core/",
      source: { url: "https://github.com/eoussama/core" },
      npm: { url: "https://www.npmjs.com/package/@eoussama/core" },
    },
    "anusic-api": { source: { url: "https://github.com/eoussama/anusic-api" } },
    "nitfree": { url: "https://ouss.es/p/projects/nitfree/", live: { url: "https://nitfree.ouss.es/" } },
  },
  "home": { url: "https://example.com/", permanent: true },
  "mail": { mailto: "hi@ouss.es", subject: "Hi Oussama" },
  "event": { url: "https://example.com/event", expires: "2026-11-20" },
});

/** Noon on the day `event` expires at the end of: 12 hours left. */
const NOON = Date.parse("2026-11-20T12:00:00Z");

/**
 * Send a request through the handler, with a fresh click counter.
 *
 * @param path - The path and query
 * @param init - Extra request options
 * @param now - The time to answer at
 * @returns The response, and the click counter's calls
 */
function call(path: string, init: RequestInit = {}, now = NOON): { response: Response; clicks: Array<AnalyticsEngineDataPoint | undefined> } {
  const writeDataPoint = vi.fn<(point?: AnalyticsEngineDataPoint) => void>();
  const response = handle(new Request(`https://to.ouss.es${path}`, init), { writeDataPoint }, links, now);

  return { response, clicks: writeDataPoint.mock.calls.map(([point]) => point) };
}

/**
 * Where a request redirects to.
 *
 * @param path - The path and query
 * @param now - The time to answer at
 * @returns The `Location` header
 */
function location(path: string, now?: number): string | null {
  return call(path, {}, now).response.headers.get("Location");
}

describe("handle", () => {
  it.each([
    ["/cv", ["cv", "hit"]],
    ["/cv?qr", ["cv", "scan"]],
    ["/Core/Source/", ["core/source", "hit"]],
    ["/mail?qr", ["mail", "scan"]],
    ["/nope", ["nope", "miss"]],
    ["/", ["", "root"]],
  ])("counts a GET on %s once, with its path and outcome", (path, blobs) => {
    const { clicks } = call(path);

    expect(clicks).toHaveLength(1);
    expect(clicks[0]?.blobs?.slice(0, 2)).toEqual(blobs);
    expect(clicks[0]?.indexes).toEqual([blobs[0]]);
  });

  it("counts a link past its expires as expired, and sends it to the 404 page", () => {
    const { response, clicks } = call("/event", {}, Date.parse("2026-11-21T00:00:00Z"));

    expect(clicks[0]?.blobs?.slice(0, 2)).toEqual(["event", "expired"]);
    expect(response.headers.get("Location")).toBe("https://ouss.es/404?from=%2Fevent");
  });

  it("redirects a link, with the redirect headers", () => {
    const { response } = call("/GitHub/?tab=repositories");

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://github.com/eoussama?tab=repositories");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=0");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("answers a permanent link with a 301 that browsers may cache", () => {
    const { response } = call("/home");

    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe("https://example.com/");
    expect(response.headers.has("Cache-Control")).toBe(false);
  });

  it("redirects a mailto link, without the request's query", () => {
    expect(location("/mail?ref=x")).toBe("mailto:hi@ouss.es?subject=Hi%20Oussama");
  });

  it("sends the root to the portfolio, and unknown paths to its 404 page", () => {
    expect(location("/")).toBe("https://ouss.es/");
    expect(location("/does-not-exist")).toBe("https://ouss.es/404?from=%2Fdoes-not-exist");
  });

  it("keeps groups out of the URL", () => {
    expect(location("/dribbble")).toBe("https://dribbble.com/EOussama");
    expect(location("/design/dribbble")).toBe("https://ouss.es/404?from=%2Fdesign%2Fdribbble");
    expect(location("/core/npm")).toBe("https://www.npmjs.com/package/@eoussama/core");
    expect(location("/projects/core/npm")).toBe("https://ouss.es/404?from=%2Fprojects%2Fcore%2Fnpm");
  });

  it("has no link where a key only holds others", () => {
    expect(location("/anusic-api")).toBe("https://ouss.es/404?from=%2Fanusic-api");
    expect(location("/anusic-api/source")).toBe("https://github.com/eoussama/anusic-api");
  });

  it("tags ouss.es targets, with the full path as the campaign", () => {
    expect(location("/nitfree")).toBe("https://ouss.es/p/projects/nitfree/?utm_source=to.ouss.es&utm_medium=shortlink&utm_campaign=nitfree");
    expect(location("/nitfree/live?qr")).toBe("https://nitfree.ouss.es/?utm_source=to.ouss.es&utm_medium=qr&utm_campaign=nitfree%2Flive");
  });

  it("passes an unknown path to the 404 page percent-encoded, so it can't read as a sentence", () => {
    const from = new URL(location("/%20has%20moved%20to%20evil.example/caf%C3%A9")!).searchParams.get("from");

    expect(from).toBe("/%20has%20moved%20to%20evil.example/caf%C3%A9");
  });

  it("answers HEAD like GET, without counting a click", () => {
    const { response, clicks } = call("/github", { method: "HEAD" });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://github.com/eoussama");
    expect(clicks).toHaveLength(0);
  });

  it.each(["/github", "/github.qr", "/robots.txt"])("rejects other methods on %s, without counting a click", (path) => {
    const { response, clicks } = call(path, { method: "POST" });

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("GET, HEAD");
    expect(clicks).toHaveLength(0);
  });

  it.each(["/robots.txt", "/ROBOTS.TXT", "/robots.txt/"])("answers %s directly, without counting it", async (path) => {
    const { response, clicks } = call(path);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(await response.text()).toBe("User-agent: *\nAllow: /\n");
    expect(clicks).toHaveLength(0);
  });

  it.each(["/favicon.ico", "/favicon.svg", "/Favicon.ICO"])("answers %s with the logo, without counting it", async (path) => {
    const { response, clicks } = call(path);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400");

    const body = await response.text();

    expect(body).toContain("prefers-color-scheme: dark");
    expect(body).toContain("class=\"a\"");
    expect(body).toContain("class=\"b\"");
    expect(clicks).toHaveLength(0);
  });
});

describe("handle, for QR codes", () => {
  it("serves a link's QR code, pointing at the HTTPS scan link, without counting it", async () => {
    const { response, clicks } = call("/CV.QR/");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(response.headers.get("Content-Disposition")).toBe("inline; filename=\"to.ouss.es-cv.svg\"");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(await response.text()).toBe(qrSvg("https://to.ouss.es/cv?qr"));
    expect(clicks).toHaveLength(0);
  });

  it("serves the QR code of a nested link, a mailto link and a HEAD request", async () => {
    const nested = call("/core/source.qr").response;

    expect(nested.headers.get("Content-Disposition")).toBe("inline; filename=\"to.ouss.es-core-source.svg\"");
    expect(await nested.text()).toBe(qrSvg("https://to.ouss.es/core/source?qr"));
    expect(await call("/mail.qr").response.text()).toBe(qrSvg("https://to.ouss.es/mail?qr"));

    const head = call("/cv.qr", { method: "HEAD" });

    expect(head.response.status).toBe(200);
    expect(head.clicks).toHaveLength(0);
  });

  it("caches an expiring link's code only until it expires", () => {
    expect(call("/event.qr").response.headers.get("Cache-Control")).toBe("public, max-age=43200");
    expect(call("/event.qr", {}, Date.parse("2026-11-20T23:59:59.500Z")).response.headers.get("Cache-Control")).toBe("public, max-age=0");
  });

  it.each([
    ["an unknown link", "/nope.qr", NOON, "/nope.qr"],
    ["an expired link", "/event.qr", Date.parse("2026-11-21T00:00:00Z"), "/event.qr"],
    ["a decoded ?", "/cv%3F.qr", NOON, "/cv?.qr"],
    ["a decoded #", "/cv%23x.qr", NOON, "/cv#x.qr"],
  ])("sends the code of %s to the 404 page, without counting it", (_, path, now, from) => {
    const { response, clicks } = call(path, {}, now);

    expect(response.status).toBe(302);
    expect(new URL(response.headers.get("Location")!).searchParams.get("from")).toBe(from);
    expect(clicks).toHaveLength(0);
  });

  it("treats a bare /.qr as an unknown path, not the root's QR code", () => {
    const { response, clicks } = call("/.qr");

    expect(response.headers.get("Location")).toBe("https://ouss.es/404?from=%2F.qr");
    expect(clicks[0]?.blobs?.slice(0, 2)).toEqual([".qr", "miss"]);
  });
});
