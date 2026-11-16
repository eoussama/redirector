declare namespace Cloudflare {
  interface GlobalProps {
    // Types `exports.default` from "cloudflare:workers" as this Worker's handler.
    mainModule: typeof import("../src/index.ts");
  }
}

declare module "*?raw" {
  const content: string;

  export default content;
}
