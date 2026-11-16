import { describe, expect, it } from "vitest";

import { expiredLinks, linksJsonSchema, validateLinks } from "../src/lib/schema.ts";
import raw from "../src/links.json" with { type: "json" };
import committedSchema from "../src/links.schema.json" with { type: "json" };



describe("validateLinks", () => {
  it("accepts the repository's links.json", () => {
    expect(() => validateLinks(raw)).not.toThrow();
  });

  it("accepts a slug of 32 characters", () => {
    expect(() => validateLinks({ ["a".repeat(32)]: { url: "https://ouss.es" } })).not.toThrow();
  });

  it("says why a permanent link can't expire", () => {
    expect(() => validateLinks({ cv: { url: "https://ouss.es", permanent: true, expires: "2026-12-31" } })).toThrow(/at cv\.permanent/);
  });

  it("accepts expires as a day or an exact time, on both kinds of link", () => {
    expect(() => validateLinks({
      a: { url: "https://ouss.es", expires: "2026-12-31" },
      b: { url: "https://ouss.es", expires: "2026-12-31T18:00:00Z" },
      c: { mailto: "hi@ouss.es", expires: "2026-12-31T18:00:00+01:00" },
    })).not.toThrow();
  });

  it("accepts url and mailto links, and skips $schema", () => {
    const links = validateLinks({
      "$schema": "./links.schema.json",
      "cv": { url: "https://ouss.es/p/cv/", permanent: true },
      "say-hi": { mailto: "hi@ouss.es", subject: "Hi", cc: ["a@x.io"] },
    });

    expect(Object.keys(links)).toEqual(["cv", "say-hi"]);
    expect(Object.isFrozen(links)).toBe(true);
  });

  it.each([
    ["a non-object root", []],
    ["an uppercase slug", { CV: { url: "https://ouss.es" } }],
    ["a slug with a slash", { "a/b": { url: "https://ouss.es" } }],
    ["a slug starting with a dash", { "-cv": { url: "https://ouss.es" } }],
    ["a string entry", { cv: "https://ouss.es" }],
    ["both url and mailto", { cv: { url: "https://ouss.es", mailto: "hi@ouss.es" } }],
    ["neither url nor mailto", { cv: { permanent: true } }],
    ["an unknown key", { cv: { url: "https://ouss.es", title: "CV" } }],
    ["a relative url", { cv: { url: "/cv.pdf" } }],
    ["a non-http url", { cv: { url: "javascript:alert(1)" } }],
    ["an ftp url", { cv: { url: "ftp://ouss.es/cv" } }],
    ["an expires that is not a date", { cv: { url: "https://ouss.es", expires: "tomorrow" } }],
    ["an impossible date", { cv: { url: "https://ouss.es", expires: "2026-13-01" } }],
    ["a time without an offset", { cv: { url: "https://ouss.es", expires: "2026-12-31T18:00:00" } }],
    ["a permanent link that expires", { cv: { url: "https://ouss.es", permanent: true, expires: "2026-12-31" } }],
    ["a slug over 32 characters", { ["a".repeat(33)]: { url: "https://ouss.es" } }],
    ["a non-boolean permanent", { cv: { url: "https://ouss.es", permanent: "yes" } }],
    ["permanent on a mailto link", { mail: { mailto: "hi@ouss.es", permanent: true } }],
    ["an invalid email", { mail: { mailto: "not-an-email" } }],
    ["a non-string subject", { mail: { mailto: "hi@ouss.es", subject: 1 } }],
    ["a non-string cc", { mail: { mailto: "hi@ouss.es", cc: [1] } }],
    ["a cc that is not an email", { mail: { mailto: "hi@ouss.es", cc: "someone" } }],
    ["a bcc list with a non-email", { mail: { mailto: "hi@ouss.es", bcc: ["a@x.io", "nope"] } }],
    ["an empty cc list", { mail: { mailto: "hi@ouss.es", cc: [] } }],
    ["a subject with a lone surrogate", { mail: { mailto: "hi@ouss.es", subject: "\uD800" } }],
    ["a body with a lone surrogate", { mail: { mailto: "hi@ouss.es", body: "a\uDFFFb" } }],
  ])("rejects %s", (_, input) => {
    expect(() => validateLinks(input)).toThrow();
  });

  it("rejects a __proto__ key from JSON", () => {
    expect(() => validateLinks(JSON.parse("{\"__proto__\": {\"url\": \"https://ouss.es\"}}"))).toThrow(/lowercase/);
  });

  it("names the bad field and says what is wrong", () => {
    expect(() => validateLinks({ cv: { url: "nope" } })).toThrow(/at cv\.url/);
    expect(() => validateLinks({ CV: { url: "https://ouss.es" } })).toThrow(/lowercase letters, digits and dashes/);
  });
});

describe("linksJsonSchema", () => {
  it("matches the committed links.schema.json", () => {
    expect(linksJsonSchema()).toEqual(committedSchema);
  });

  it("allows the $schema key next to the slugs", () => {
    const schema = linksJsonSchema() as { properties: Record<string, unknown>; propertyNames: { anyOf: unknown[] } };

    expect(schema.properties.$schema).toEqual({ type: "string" });
    expect(schema.propertyNames.anyOf).toContainEqual({ const: "$schema" });
  });
});

describe("expiredLinks", () => {
  const links = validateLinks({
    forever: { url: "https://ouss.es" },
    day: { url: "https://ouss.es", expires: "2026-11-20" },
    exact: { mailto: "hi@ouss.es", expires: "2026-11-20T12:00:00Z" },
  });

  it("lists only the links whose expires has passed, at the exact moment", () => {
    expect(expiredLinks(links, Date.parse("2026-11-20T11:59:59Z"))).toEqual([]);
    expect(expiredLinks(links, Date.parse("2026-11-20T12:00:00Z"))).toEqual([["exact", "2026-11-20T12:00:00Z"]]);
    expect(expiredLinks(links, Date.parse("2026-11-21T00:00:00Z"))).toEqual([["day", "2026-11-20"], ["exact", "2026-11-20T12:00:00Z"]]);
  });
});
