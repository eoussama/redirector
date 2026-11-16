import type { TLinks, TSlug } from "../src/lib/types.ts";

import { describe, expect, it } from "vitest";

import { findLink, forwardQuery, HOME_URL, resolve, withUtm } from "../src/lib/resolve.ts";



const links: TLinks = {
  cv: { url: "https://ouss.es/p/cv/" },
  github: { url: "https://github.com/eoussama", permanent: true },
  search: { url: "https://example.com/find?q=default&lang=en" },
  mail: { mailto: "hi@ouss.es", subject: "Hi Oussama" },
  event: { url: "https://example.com/event", expires: "2026-11-20" },
  launch: { url: "https://example.com/launch", expires: "2026-11-20T18:00:00+01:00" },
};

/** The portfolio CV's URL with the tags a click adds. */
const CV = "https://ouss.es/p/cv/?utm_source=to.ouss.es&utm_medium=shortlink&utm_campaign=cv";

/**
 * Resolve a URL on the redirector's host.
 *
 * @param path - The path and query
 * @param now - The time to resolve at, in milliseconds since the epoch (defaults to now)
 * @returns The resolution
 */
function at(path: string, now?: number): ReturnType<typeof resolve> {
  return resolve(new URL(path, "https://to.ouss.es"), links, now);
}

describe("resolve", () => {
  it("sends the root to the portfolio", () => {
    expect(at("/")).toEqual({ slug: "", outcome: "root", status: 302, location: HOME_URL });
  });

  it("redirects a known slug with 302", () => {
    expect(at("/cv")).toMatchObject({ outcome: "hit", status: 302, location: CV });
  });

  it("uses 301 for permanent links", () => {
    expect(at("/github")).toMatchObject({ outcome: "hit", status: 301, location: "https://github.com/eoussama" });
  });

  it("matches case-insensitively and ignores a trailing slash", () => {
    expect(at("/CV/").location).toBe(CV);
  });

  it("forwards the query string, the request's values winning", () => {
    expect(at("/cv?ref=x").location).toBe(`${CV}&ref=x`);
    expect(at("/search?q=mine&tag=a&tag=b").location).toBe("https://example.com/find?lang=en&q=mine&tag=a&tag=b");
  });

  it("builds mailto links without forwarding the query", () => {
    expect(at("/mail?ref=x")).toMatchObject({ outcome: "hit", status: 302, location: "mailto:hi@ouss.es?subject=Hi%20Oussama" });
  });

  it("sends unknown slugs to the portfolio's 404 page", () => {
    expect(at("/nope")).toMatchObject({ slug: "nope", outcome: "miss", status: 302, location: "https://ouss.es/404?from=nope" });
  });

  it("treats nested paths as unknown", () => {
    expect(at("/github/redirector").location).toBe("https://ouss.es/404?from=github%2Fredirector");
  });

  it("caps the slug passed on to the 404 page", () => {
    const from = new URL(at(`/${"a".repeat(5000)}`).location).searchParams.get("from");

    expect(from).toBe("a".repeat(256));
  });

  it("counts a QR scan apart, and never passes the marker on", () => {
    expect(at("/cv?qr")).toMatchObject({ outcome: "scan", location: "https://ouss.es/p/cv/?utm_source=to.ouss.es&utm_medium=qr&utm_campaign=cv" });
    expect(at("/github?qr&ref=x")).toMatchObject({ outcome: "scan", location: "https://github.com/eoussama?ref=x" });
    expect(at("/mail?qr").outcome).toBe("scan");
  });

  it("keeps a day-only link working through that whole day, UTC", () => {
    expect(at("/event", Date.parse("2026-11-20T23:59:59Z")).outcome).toBe("hit");
    expect(at("/event", Date.parse("2026-11-21T00:00:00Z"))).toMatchObject({ outcome: "expired", status: 302, location: "https://ouss.es/404?from=event" });
  });

  it("expires a link at an exact time, with its offset", () => {
    expect(at("/launch", Date.parse("2026-11-20T16:59:59Z")).outcome).toBe("hit");
    expect(at("/launch", Date.parse("2026-11-20T17:00:00Z")).outcome).toBe("expired");
  });

  it("never matches inherited object keys", () => {
    expect(at("/constructor").outcome).toBe("miss");
    expect(at("/__proto__").outcome).toBe("miss");
  });
});

describe("forwardQuery", () => {
  const target = "https://a.com/x?q=a%20b&z=1#top";

  /**
   * Forward a request query to the test target.
   *
   * @param query - The request's query string
   * @returns The redirect URL
   */
  function forward(query: string): string {
    return forwardQuery(target, new URL(`https://to.ouss.es/cv${query}`));
  }

  it("leaves the target untouched without a request query", () => {
    expect(forward("")).toBe(target);
    expect(forward("?")).toBe(target);
    expect(forwardQuery("https://a.com/x?", new URL("https://to.ouss.es/cv"))).toBe("https://a.com/x?");
  });

  it("never re-encodes either query", () => {
    expect(forward("?a")).toBe("https://a.com/x?q=a%20b&z=1&a#top");
    expect(forward("?x=%20+y")).toBe("https://a.com/x?q=a%20b&z=1&x=%20+y#top");
  });

  it("replaces the target's value for a key the request also has", () => {
    expect(forward("?q=new")).toBe("https://a.com/x?z=1&q=new#top");
    expect(forward("?z=2&z=3")).toBe("https://a.com/x?q=a%20b&z=2&z=3#top");
  });
});

describe("withUtm", () => {
  const slug = "cv" as TSlug;

  it("tags links on ouss.es and its subdomains", () => {
    expect(withUtm("https://ouss.es/p/cv/", slug, "shortlink")).toBe(CV);
    expect(withUtm("https://blog.ouss.es/post", slug, "qr")).toBe("https://blog.ouss.es/post?utm_source=to.ouss.es&utm_medium=qr&utm_campaign=cv");
  });

  it("leaves other sites alone, including look-alikes", () => {
    expect(withUtm("https://github.com/eoussama", slug, "shortlink")).toBe("https://github.com/eoussama");
    expect(withUtm("https://notouss.es/x", slug, "shortlink")).toBe("https://notouss.es/x");
    expect(withUtm("https://ouss.es.evil.com/x", slug, "shortlink")).toBe("https://ouss.es.evil.com/x");
  });

  it("keeps tags the link already has, and its own query as written", () => {
    expect(withUtm("https://ouss.es/x?utm_source=cv-pdf&q=a%20b#top", slug, "shortlink"))
      .toBe("https://ouss.es/x?utm_source=cv-pdf&q=a%20b&utm_medium=shortlink&utm_campaign=cv#top");
  });

  it("lets a request's own tags win", () => {
    expect(at("/cv?utm_source=newsletter").location)
      .toBe("https://ouss.es/p/cv/?utm_medium=shortlink&utm_campaign=cv&utm_source=newsletter");
  });
});

describe("findLink", () => {
  const noon = Date.parse("2026-11-20T12:00:00Z");

  it("finds a live link, and marks one past its expires", () => {
    expect(findLink(links, "cv", noon)).toEqual({ link: links.cv, expired: false });
    expect(findLink(links, "event", noon)?.expired).toBe(false);
    expect(findLink(links, "event", Date.parse("2026-11-21T00:00:00Z"))?.expired).toBe(true);
  });

  it("finds nothing for an unknown slug or an inherited key", () => {
    expect(findLink(links, "nope", noon)).toBeUndefined();
    expect(findLink(links, "constructor", noon)).toBeUndefined();
  });
});
