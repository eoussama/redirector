import { encode } from "uqr";
import { describe, expect, it } from "vitest";

import { qrSvg } from "../src/lib/qr.ts";



const text = "https://to.ouss.es/github?qr";

/**
 * The parts of a QR code SVG the tests look at.
 *
 * @param svg - The SVG
 * @returns The code's size, the logo's box and the set of drawn modules
 */
function parse(svg: string): { size: number; logo: { x: number; size: number }; modules: Set<string> } {
  const size = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1]);
  const [, x, , width] = /<svg x="([\d.]+)" y="([\d.]+)" width="([\d.]+)"/.exec(svg) ?? [];
  const modules = new Set([...svg.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)]
    .flatMap(([, mx, my, run]) => Array.from({ length: Number(run) }, (_, i) => `${Number(mx) + i},${my}`)));

  return { size, logo: { x: Number(x), size: Number(width) }, modules };
}

describe("qrSvg", () => {
  it("draws the code at the highest error correction, with a 4-module quiet zone", () => {
    const qr = encode(text, { ecc: "H", border: 4 });
    const { size, modules } = parse(qrSvg(text));

    expect(size).toBe(qr.size);
    // A finder pattern's dark corner sits right after the 4-module quiet zone; level H is
    // what makes the code this size for this text.
    expect(modules.has("4,4")).toBe(true);
    expect(modules.has("3,3")).toBe(false);
    expect(qr.size).toBeGreaterThan(encode(text, { ecc: "M", border: 4 }).size);
  });

  it("draws every dark module outside the logo's pad, black on white, with crisp edges", () => {
    const svg = qrSvg(text);
    const { size, logo, modules } = parse(svg);
    const { data } = encode(text, { ecc: "H", border: 4 });
    const pad = { start: logo.x - 1, end: logo.x + logo.size + 1 };

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const underPad = x >= pad.start && x < pad.end && y >= pad.start && y < pad.end;

        expect(modules.has(`${x},${y}`)).toBe(data[y]![x]! && !underPad);
      }
    }

    expect(svg).toContain(`<rect width="${size}" height="${size}" fill="#fff"/>`);
    expect(svg).toContain(`<path fill="#000" shape-rendering="crispEdges" d="`);
  });

  it("centers an odd-sized pad, with a one-module margin around the logo", () => {
    const { size, logo } = parse(qrSvg(text));
    const pad = logo.size + 2;

    expect(pad % 2).toBe(1);
    expect(logo.x - 1).toBe((size - pad) / 2);
  });

  it("keeps the pad between 4% and 10% of the code: visible, and far below the 30% level H recovers", () => {
    const { size, logo } = parse(qrSvg(text));
    const share = (logo.size + 2) ** 2 / (size - 8) ** 2;

    expect(share).toBeGreaterThan(0.04);
    expect(share).toBeLessThan(0.1);
  });

  it("draws the logo in its own colors, on its 64-unit grid", () => {
    const svg = qrSvg(text);

    expect(svg).toContain("viewBox=\"0 0 64 64\"");
    expect(svg).toContain("<clipPath id=\"clip\">");
    expect(svg).toContain("fill=\"#1e2230\"");
    expect(svg).toContain("fill=\"#5b4bc4\"");
    expect(svg).not.toContain("class=");
  });

  it("never covers a finder or alignment pattern, up to the longest short path", () => {
    for (let length = 1; length <= 32; length++) {
      const code = `https://to.ouss.es/${"a".repeat(length)}?qr`;
      const { version, size } = encode(code, { ecc: "H", border: 4 });
      const { logo } = parse(qrSvg(code));
      const padEnd = logo.x + logo.size + 1;
      // Up to version 6 the one alignment pattern away from the finders is centered 7 modules
      // in from the bottom-right corner of the code, and spans 2 modules either side.
      const alignmentStart = size - 4 - 7 - 2;
      const finderEnd = 4 + 8;

      expect(version).toBeLessThanOrEqual(6);
      expect(logo.x - 1).toBeGreaterThanOrEqual(finderEnd);
      expect(padEnd).toBeLessThanOrEqual(alignmentStart);
    }
  });

  it("is the same for the same text", () => {
    expect(qrSvg(text)).toBe(qrSvg(text));
  });
});
