import type { TResolution, TSlug } from "../src/lib/types.ts";

import { describe, expect, it } from "vitest";

import { ALLOWED_METHODS, methodNotAllowed, qrResponse, redirectResponse } from "../src/lib/response.ts";



const resolution = (status: 301 | 302): TResolution => ({ slug: "cv" as TSlug, outcome: "hit", status, location: "https://ouss.es/p/cv/" });

describe("redirectResponse", () => {
  it("answers a 302 with headers that keep browsers from caching it", () => {
    const response = redirectResponse(resolution(302));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://ouss.es/p/cv/");
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=0");
  });

  it("leaves a 301 cacheable, on purpose", () => {
    const response = redirectResponse(resolution(301));

    expect(response.status).toBe(301);
    expect(response.headers.get("Cache-Control")).toBeNull();
  });

  it.each([301, 302] as const)("keeps a %i out of search engines and limits the referrer", (status) => {
    const response = redirectResponse(resolution(status));

    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
});

describe("methodNotAllowed", () => {
  it("answers 405 with the allowed methods", () => {
    const response = methodNotAllowed();

    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe(ALLOWED_METHODS);
  });
});

describe("qrResponse", () => {
  it("caches the image for a day, or until the link expires if sooner", () => {
    expect(qrResponse("<svg/>", "cv").headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(qrResponse("<svg/>", "cv", 3600.9).headers.get("Cache-Control")).toBe("public, max-age=3600");
    expect(qrResponse("<svg/>", "cv", -5).headers.get("Cache-Control")).toBe("public, max-age=0");
  });

  it("serves an SVG that search engines skip, with a file name", () => {
    const response = qrResponse("<svg/>", "cv");

    expect(response.headers.get("Content-Type")).toBe("image/svg+xml");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(response.headers.get("Content-Disposition")).toBe("inline; filename=\"to.ouss.es-cv.svg\"");
  });

  it("turns a nested path into a valid file name", () => {
    expect(qrResponse("<svg/>", "core/source").headers.get("Content-Disposition")).toBe("inline; filename=\"to.ouss.es-core-source.svg\"");
  });
});
