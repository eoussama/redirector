import type { TLinks } from "../src/lib/types.ts";

import { describe, expect, it } from "vitest";

import { forwardQuery, HOME_URL, resolve } from "../src/lib/resolve.ts";



const links: TLinks = {
  "cv": { url: "https://ouss.es/p/cv/" },
  "github": { url: "https://github.com/eoussama", permanent: true },
  "search": { url: "https://example.com/find?q=default&lang=en" },
  "mail": { mailto: "hi@ouss.es", subject: "Hi Oussama" },
  "constructor-like": { url: "https://ouss.es/x" },
};

/**
 * Resolve a URL on the redirector's host.
 *
 * @param path - The path and query
 * @returns The resolution
 */
function at(path: string): ReturnType<typeof resolve> {
  return resolve(new URL(path, "https://to.ouss.es"), links);
}

describe("resolve", () => {
  it("sends the root to the portfolio", () => {
    expect(at("/")).toEqual({ slug: "", outcome: "root", status: 302, location: HOME_URL });
  });

  it("redirects a known slug with 302", () => {
    expect(at("/cv")).toMatchObject({ outcome: "hit", status: 302, location: "https://ouss.es/p/cv/" });
  });

  it("uses 301 for permanent links", () => {
    expect(at("/github")).toMatchObject({ outcome: "hit", status: 301, location: "https://github.com/eoussama" });
  });

  it("matches case-insensitively and ignores a trailing slash", () => {
    expect(at("/CV/").location).toBe("https://ouss.es/p/cv/");
  });

  it("forwards the query string, the request's values winning", () => {
    expect(at("/cv?ref=x").location).toBe("https://ouss.es/p/cv/?ref=x");
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
