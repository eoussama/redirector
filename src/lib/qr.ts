import { encode } from "uqr";

import { logoElement } from "./brand.ts";



/** Modules of white space around the code, as the QR spec asks. */
const QUIET_ZONE = 4;

/** How much of the code's width the logo's white pad covers: about 6% of its area, far below the 30% that level H error correction recovers. */
const LOGO_SHARE = 0.25;

/**
 * A QR code for a URL, as an SVG with the logo in the center. It uses the highest error
 * correction (H), so the modules under the logo are recovered when scanning.
 *
 * @param text - What the code holds
 * @returns The SVG document
 */
export function qrSvg(text: string): string {
  const { size, data } = encode(text, { ecc: "H", border: QUIET_ZONE });

  // An odd number of modules, centered on the middle module, so the pad sits symmetrically.
  const codeSize = size - 2 * QUIET_ZONE;
  let pad = Math.round(codeSize * LOGO_SHARE);

  pad += pad % 2 === 0 ? 1 : 0;

  const padStart = (size - pad) / 2;
  const padEnd = padStart + pad;
  const isUnderPad = (x: number, y: number): boolean => x >= padStart && x < padEnd && y >= padStart && y < padEnd;

  let path = "";

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y]![x] && !isUnderPad(x, y)) {
        path += `M${x} ${y}h1v1h-1z`;
      }
    }
  }

  // The logo sits inside the pad with a one-module margin of white around it.
  const logo = logoElement(padStart + 1, padStart + 1, pad - 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`
    + `<rect width="${size}" height="${size}" fill="#fff"/>`
    + `<path fill="#000" shape-rendering="crispEdges" d="${path}"/>`
    + `${logo}</svg>`;
}
