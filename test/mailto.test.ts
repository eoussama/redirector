import { describe, expect, it } from "vitest";

import { buildMailto } from "../src/lib/mailto.ts";



describe("buildMailto", () => {
  it("builds a bare address", () => {
    expect(buildMailto({ mailto: "hi@ouss.es" })).toBe("mailto:hi@ouss.es");
  });

  it("encodes spaces as %20 and escapes reserved characters", () => {
    expect(buildMailto({ mailto: "hi@ouss.es", subject: "Hi & hello?", body: "Line one\nLine two" }))
      .toBe("mailto:hi@ouss.es?subject=Hi%20%26%20hello%3F&body=Line%20one%0D%0ALine%20two");
  });

  it("writes every kind of line break as CRLF, as RFC 6068 requires", () => {
    expect(buildMailto({ mailto: "hi@ouss.es", body: "a\nb\r\nc\rd" })).toBe("mailto:hi@ouss.es?body=a%0D%0Ab%0D%0Ac%0D%0Ad");
  });

  it("joins cc and bcc lists with plain commas", () => {
    expect(buildMailto({ mailto: "hi@ouss.es", cc: ["a@x.io", "b+tag@x.io"], bcc: "c@x.io" }))
      .toBe("mailto:hi@ouss.es?cc=a@x.io,b%2Btag@x.io&bcc=c@x.io");
  });

  it("escapes characters in the address itself", () => {
    expect(buildMailto({ mailto: "a+b@ouss.es" })).toBe("mailto:a%2Bb@ouss.es");
  });
});
