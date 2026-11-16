import { describe, expect, it } from "vitest";

import logoDark from "../assets/logo-dark.svg?raw";
import logoLight from "../assets/logo-light.svg?raw";
import { logoShapes } from "../src/lib/brand.ts";



/**
 * The logo as a standalone file, in two colors.
 *
 * @param ink - The ring and arrow's color
 * @param accent - The crescent's color
 * @returns The SVG document
 */
function logoFile(ink: string, accent: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">\n  ${logoShapes(ink, accent)}\n</svg>\n`;
}

describe("logo", () => {
  it("is the same mark in the README's logos as in the favicon and QR codes", () => {
    expect(logoLight).toBe(logoFile("#1e2230", "#5b4bc4"));
    expect(logoDark).toBe(logoFile("#eceaf3", "#b8aef5"));
  });
});
