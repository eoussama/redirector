import type { TMailtoLink } from "./types.ts";

import { isDefined } from "@eoussama/core";



/**
 * A subject or body, percent-encoded, with every line break as CRLF (`%0D%0A`), which
 * RFC 6068 requires in a mailto body.
 *
 * @param text - The text
 * @returns The encoded text
 */
function encodeText(text: string): string {
  return encodeURIComponent(text.replace(/\r\n|\r|\n/g, "\r\n"));
}

/**
 * An email address, percent-encoded but with its `@` kept readable.
 *
 * @param address - The address
 * @returns The encoded address
 */
function encodeAddress(address: string): string {
  return encodeURIComponent(address).replace(/%40/g, "@");
}

/**
 * A `mailto:` URL for a link (RFC 6068), with its fields percent-encoded (spaces as `%20`,
 * not `+`, which mail clients would show as is). Several `cc` or `bcc` addresses are
 * separated by plain commas.
 *
 * @param link - The mailto link
 * @returns The `mailto:` URL
 */
export function buildMailto(link: TMailtoLink): string {
  const addresses = (value: string | readonly string[] | undefined): string | undefined =>
    value === undefined ? undefined : (typeof value === "string" ? [value] : value).map(encodeAddress).join(",");

  const fields: Array<[string, string | undefined]> = [
    ["subject", link.subject === undefined ? undefined : encodeText(link.subject)],
    ["body", link.body === undefined ? undefined : encodeText(link.body)],
    ["cc", addresses(link.cc)],
    ["bcc", addresses(link.bcc)],
  ];

  const query = fields
    .filter((field): field is [string, string] => isDefined(field[1]))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  const address = encodeAddress(link.mailto);

  return query.length > 0 ? `mailto:${address}?${query}` : `mailto:${address}`;
}
