import dx from "@eoussama/dx";



export default dx({
  ignores: ["dist/**", ".wrangler/**", "worker-configuration.d.ts"],
}, {
  // Command-line tools report to the terminal.
  files: ["scripts/**"],
  rules: {
    "no-console": "off",
    "node/prefer-global/process": "off",
  },
});
