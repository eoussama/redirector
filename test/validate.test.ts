import { describe, expect, it } from "vitest";

import { linksJsonSchema, validateLinks } from "../src/lib/schema.ts";
import raw from "../src/links.json" with { type: "json" };
import committedSchema from "../src/links.schema.json" with { type: "json" };



describe("validateLinks", () => {
  it("accepts the repository's links.json", () => {
    expect(() => validateLinks(raw)).not.toThrow();
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
