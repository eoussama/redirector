import type { TResolution, TSlug } from "../src/lib/types.ts";

import { describe, expect, it, vi } from "vitest";

import { INDEX_BYTES, logClick, referrerHost, SLUG_BYTES, truncateBytes } from "../src/lib/analytics.ts";



const hit: TResolution = { slug: "cv" as TSlug, outcome: "hit", status: 302, location: "https://ouss.es/p/cv/" };

/**
 * A stand-in Analytics Engine dataset that records what is written.
 *
 * @returns The dataset and its spy
 */
function fakeDataset(): { dataset: AnalyticsEngineDataset; write: ReturnType<typeof vi.fn> } {
  const write = vi.fn();

  return { dataset: { writeDataPoint: write }, write };
}

describe("truncateBytes", () => {
  it("keeps short strings as they are", () => {
    expect(truncateBytes("cv", 96)).toBe("cv");
  });

  it("counts UTF-8 bytes, not characters, and never splits a character", () => {
    const cut = truncateBytes("مرحبا".repeat(20), 95);

    expect(new TextEncoder().encode(cut).length).toBeLessThanOrEqual(95);
    expect(cut).toBe("مرحبا".repeat(20).slice(0, 47));
    expect(truncateBytes("😀😀", 5)).toBe("😀");
  });

  it("keeps a replacement character that was in the input", () => {
    expect(truncateBytes("a\uFFFD\uFFFD", 4)).toBe("a\uFFFD");
  });
});

describe("referrerHost", () => {
  it("keeps only the host", () => {
    expect(referrerHost("https://www.linkedin.com/in/someone?trk=abc")).toBe("www.linkedin.com");
  });

  it("keeps the port", () => {
    expect(referrerHost("https://a.com:8080/x")).toBe("a.com:8080");
  });

  it("never returns an IP address", () => {
    expect(referrerHost("http://203.0.113.7:3000/")).toBe("");
    expect(referrerHost("http://[2001:db8::1]/page")).toBe("");
    expect(referrerHost("https://1.example.com/")).toBe("1.example.com");
  });

  it("is empty for a missing or malformed referer", () => {
    expect(referrerHost(null)).toBe("");
    expect(referrerHost("not a url")).toBe("");
  });
});

describe("logClick", () => {
  it("writes the slug, outcome, country and referrer host, and nothing identifying", () => {
    const { dataset, write } = fakeDataset();
    const request = new Request("https://to.ouss.es/cv", {
      headers: {
        "Referer": "https://news.ycombinator.com/item?id=1",
        "CF-Connecting-IP": "203.0.113.7",
        "X-Forwarded-For": "203.0.113.7",
        "User-Agent": "Mozilla/5.0 Test",
      },
    });

    Object.defineProperty(request, "cf", { value: { country: "MA" } });

    logClick(dataset, request, hit);

    expect(write).toHaveBeenCalledWith({
      indexes: ["cv"],
      blobs: ["cv", "hit", "MA", "news.ycombinator.com"],
      doubles: [1],
    });
    expect(JSON.stringify(write.mock.calls)).not.toMatch(/203\.0\.113\.7|Mozilla/);
  });

  it("cuts a long slug to the index and blob limits, counting bytes", () => {
    const { dataset, write } = fakeDataset();
    const bytes = (value: unknown): number => new TextEncoder().encode(value as string).length;

    logClick(dataset, new Request("https://to.ouss.es/x"), { ...hit, slug: "a".repeat(600) as TSlug, outcome: "miss" });
    logClick(dataset, new Request("https://to.ouss.es/x"), { ...hit, slug: "مرحبا".repeat(60) as TSlug, outcome: "miss" });

    const [ascii, arabic] = write.mock.calls.map(([point]) => point as AnalyticsEngineDataPoint);

    expect(bytes(ascii!.indexes![0])).toBe(INDEX_BYTES);
    expect(bytes(ascii!.blobs![0])).toBe(SLUG_BYTES);
    expect(bytes(arabic!.indexes![0])).toBeLessThanOrEqual(INDEX_BYTES);
    expect(bytes(arabic!.blobs![0])).toBeLessThanOrEqual(SLUG_BYTES);
    expect(bytes(arabic!.blobs![0])).toBeGreaterThan(INDEX_BYTES);
  });

  it("cuts a long referrer host to the blob limit", () => {
    const { dataset, write } = fakeDataset();

    logClick(dataset, new Request("https://to.ouss.es/cv", { headers: { Referer: `https://${"a".repeat(300)}.com/` } }), hit);

    const [point] = write.mock.calls[0] as [AnalyticsEngineDataPoint];

    expect(new TextEncoder().encode(point.blobs![3] as string).length).toBe(SLUG_BYTES);
  });

  it("never throws when the write fails", () => {
    const dataset: AnalyticsEngineDataset = {
      writeDataPoint: () => {
        throw new Error("down");
      },
    };

    expect(() => logClick(dataset, new Request("https://to.ouss.es/cv"), hit)).not.toThrow();
  });
});
