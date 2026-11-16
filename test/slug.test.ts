import { describe, expect, it } from "vitest";

import { normalizeSlug } from "../src/lib/slug.ts";



describe("normalizeSlug", () => {
  it("returns an empty slug for the root", () => {
    expect(normalizeSlug("/")).toBe("");
    expect(normalizeSlug("")).toBe("");
    expect(normalizeSlug("//")).toBe("");
  });

  it("lowercases and trims slashes", () => {
    expect(normalizeSlug("/cv")).toBe("cv");
    expect(normalizeSlug("/CV/")).toBe("cv");
    expect(normalizeSlug("//GitHub//")).toBe("github");
  });

  it("keeps inner slashes, so nested paths never match a slug", () => {
    expect(normalizeSlug("/github/redirector")).toBe("github/redirector");
  });

  it("trims long runs of slashes in linear time", () => {
    const start = performance.now();

    expect(normalizeSlug(`/a${"/".repeat(50_000)}b`)).toBe(`a${"/".repeat(50_000)}b`);
    expect(normalizeSlug("/".repeat(50_000))).toBe("");
    expect(performance.now() - start).toBeLessThan(50);
  });

  it("treats encoded slashes like real ones", () => {
    expect(normalizeSlug("/cv%2F")).toBe("cv");
    expect(normalizeSlug("/%2Fcv")).toBe("cv");
    expect(normalizeSlug("/a%2Fb")).toBe("a/b");
  });

  it("decodes percent-encoding, and only lowercases malformed input", () => {
    expect(normalizeSlug("/%43V")).toBe("cv");
    expect(normalizeSlug("/%E0%A4%A")).toBe("%e0%a4%a");
  });
});
