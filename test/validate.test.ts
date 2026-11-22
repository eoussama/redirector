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

  it("nests a link's children into its short path", () => {
    const links = validateLinks({ dx: { url: "https://ouss.es/p/projects/dx/", source: { url: "https://github.com/eoussama/dx" } } });

    expect(Object.keys(links)).toEqual(["dx", "dx/source"]);
  });

  it("lets a key without a url only hold links, so its own path doesn't exist", () => {
    expect(Object.keys(validateLinks({ "anusic-api": { source: { url: "https://github.com/eoussama/anusic-api" } } }))).toEqual(["anusic-api/source"]);
  });

  it("keeps groups out of the short path, at any depth", () => {
    const links = validateLinks({
      "(projects)": { dx: { "url": "https://ouss.es/p/projects/dx/", "(design)": { dribbble: { url: "https://dribbble.com/shots/27890164-DX-Logo" } } } },
    });

    expect(Object.keys(links)).toEqual(["dx", "dx/dribbble"]);
  });

  it.each([
    ["a group that is a link", { "(design)": { url: "https://ouss.es" } }, /group only organizes/],
    ["a link at the top level", { url: "https://ouss.es" }, /top level can't be a link/],
    ["the same path twice, through a group", { "cv": { url: "https://ouss.es" }, "(site)": { cv: { url: "https://ouss.es/p/cv/" } } }, /"cv" is defined twice/],
    ["a nested path over 32 characters", { github: { url: "https://github.com", ["a".repeat(26)]: { url: "https://github.com/a" } } }, /at most 32 characters.*is 33/],
    ["an empty key", { dx: {} }, /Must be a link .* or hold other links/],
    ["a field name used as a key", { github: { url: "https://github.com", subject: { url: "https://github.com/x" } } }, /at github/],
    ["a group name in capitals", { "(Design)": { cv: { url: "https://ouss.es" } } }, /lowercase letters/],
  ])("rejects %s", (_, input, message) => {
    expect(() => validateLinks(input)).toThrow(message);
  });

  it("reports every problem at once, each with its place", () => {
    expect(() => validateLinks({ "a": { url: "nope" }, "(b)": { c: { mailto: "nope" } } }))
      .toThrow(/at a\.url[\s\S]*at \(b\)\.c\.mailto/);
  });

  it.each([
    ["a bad expires", { a: { url: "https://ouss.es", expires: "tomorrow" } }, /Must be a date[^\n]*\n {2}→ at a\.expires/],
    ["a non-boolean permanent", { a: { url: "https://ouss.es", permanent: "yes" } }, /Must be true or false\.\n {2}→ at a\.permanent/],
    ["a field of the other kind", { a: { mailto: "hi@ouss.es", permanent: true } }, /Not a field of this kind of link: "permanent"\.\n {2}→ at a$/],
    ["both url and mailto", { a: { url: "https://ouss.es", mailto: "hi@ouss.es" } }, /either a url or a mailto, not both/],
    ["neither url nor mailto", { a: { expires: "2026-12-31" } }, /needs a url or a mailto/],
    ["a misspelled field", { a: { url: "https://ouss.es", permanant: true } }, /Link fields are url, permanent[^\n]*\n {2}→ at a\.permanant/],
    ["a cc that is neither", { a: { mailto: "hi@ouss.es", cc: 1 } }, /an email address, or a list of them/],
    ["an uppercase scheme", { a: { url: "HTTPS://ouss.es" } }, /in lowercase/],
    ["an empty group", { "(g)": {} }, /A group must hold links/],
    ["a $schema that isn't a path", { $schema: 1 }, /path to links\.schema\.json\.\n {2}→ at \$schema/],
  ])("says exactly what is wrong with %s", (_, input, message) => {
    expect(() => validateLinks(input)).toThrow(message);
  });

  it("reports each problem of one link, and a long path along with bad fields", () => {
    const run = (): unknown => validateLinks({
      a: { mailto: "hi@ouss.es", cc: ["hi@ouss.es", "nope"], bcc: [], subject: 1 },
      ["b".repeat(33)]: { url: "nope" },
    });

    for (const place of [/at a\.subject$/m, /at a\.bcc$/m, /at a\.cc\[1\]$/m, /is 33\.\n {2}→ at b{33}$/m, /at b{33}\.url$/m]) {
      expect(run).toThrow(place);
    }
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

  it("allows the $schema key, children and groups, and keeps field names out of keys", () => {
    const schema = linksJsonSchema() as { properties: Record<string, unknown>; patternProperties: Record<string, unknown> };
    const [child, group] = Object.keys(schema.patternProperties).map(source => new RegExp(source));

    expect(schema.properties.$schema).toEqual({ type: "string" });
    expect(child!.test("github")).toBe(true);
    expect(child!.test("url")).toBe(false);
    expect(child!.test("(design)")).toBe(false);
    expect(group!.test("(design)")).toBe(true);
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
