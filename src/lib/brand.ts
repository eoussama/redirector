/*
 * The portfolio's logo (the same mark as ouss.es/favicon.svg), for the favicon and the
 * center of QR codes.
 */

/**
 * The logo's shapes on its 64×64 grid, with the two colors left open.
 *
 * @param ink - The color of the ring and the arrow
 * @param accent - The color of the crescent
 * @returns The SVG elements, to wrap in an `<svg>` with a `0 0 64 64` viewBox
 */
export function logoShapes(ink: string, accent: string): string {
  return `<clipPath id="clip"><circle cx="32" cy="32" r="31.81"/></clipPath>
  <mask id="cut" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
    <rect width="64" height="64" fill="#fff"/>
    <ellipse cx="38.7" cy="32" rx="24.77" ry="24.05" fill="#000"/>
  </mask>
  <mask id="moon" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
    <rect width="64" height="64" fill="#fff"/>
    <ellipse cx="34.42" cy="32" rx="20.99" ry="19.8" fill="#000"/>
  </mask>
  <circle fill="${ink}" cx="32" cy="32" r="31.81" mask="url(#cut)"/>
  <g clip-path="url(#clip)">
    <ellipse fill="${accent}" cx="38.7" cy="32" rx="24.54" ry="23.83" mask="url(#moon)"/>
    <path fill="${ink}" d="M-1 23.8L44.1 32L-1 40.2Z"/>
  </g>`;
}

/** The favicon: dark ink on light pages, light ink on dark ones. */
export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <style>
    .a { fill: #1e2230; }
    .b { fill: #5b4bc4; }
    @media (prefers-color-scheme: dark) {
      .a { fill: #eceaf3; }
      .b { fill: #b8aef5; }
    }
  </style>
  ${logoShapes("#1e2230", "#5b4bc4").replace(/fill="#1e2230"/g, "class=\"a\"").replace(/fill="#5b4bc4"/g, "class=\"b\"")}
</svg>`;

/**
 * The logo as a nested SVG element, in fixed colors (a QR code is always dark on light).
 *
 * @param x - Left edge, in the parent's units
 * @param y - Top edge, in the parent's units
 * @param size - Width and height, in the parent's units
 * @returns The `<svg>` element
 */
export function logoElement(x: number, y: number, size: number): string {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 64 64">${logoShapes("#1e2230", "#5b4bc4")}</svg>`;
}
