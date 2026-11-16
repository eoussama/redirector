# Contributing to Redirector

Thank you for your interest in contributing to **Redirector**! We appreciate your help in making the project better.

Before you start contributing, please take a moment to review this guide, which outlines the process for contributing and the community guidelines we follow.

## Code of Conduct

We have a [Code of Conduct](CODE_OF_CONDUCT.md) that we expect all contributors to adhere to. Please read it and make sure you understand and follow it in all your interactions within our project.

## Getting Started

- If you are new to our project, please review our [README](README.md) for an overview of the project and how to get started.

- Check our [Issues](https://github.com/eoussama/redirector/issues) to find tasks that need assistance or to report any bugs or feature requests.

- For security vulnerabilities, do **not** open an issue. Follow the [Security Policy](SECURITY.md) instead.

## How to Contribute

1. Fork the repository to your GitHub account.

2. Create a new branch for your contribution:

   ```bash
   git checkout -b feat/your-feature-name
   ```

3. Make your changes, keeping each commit focused on a single concern.

4. Commit your changes with a clear, descriptive message:

   ```bash
   git commit -m "feat: add your feature"
   ```

5. Push the branch to your fork:

   ```bash
   git push origin feat/your-feature-name
   ```

6. Open a pull request against the `main` branch and fill out the pull request template.

## Development

Requires Node.js 26 (pinned in `.nvmrc`, which Workers Builds also follows) and pnpm 12.

```bash
pnpm install
pnpm dev     # serve the Worker locally at http://localhost:8787
pnpm check   # what Workers Builds runs before every deploy: audit, lint, typecheck, links, tests and build
```

Other scripts: `pnpm lint`, `pnpm fix`, `pnpm typecheck`, `pnpm validate` (checks `src/links.json`, and that `src/links.schema.json` is current), `pnpm schema` (regenerates `src/links.schema.json` after a change to `src/lib/schema.ts`), `pnpm stats` (click counts, see the README), `pnpm test`, `pnpm build` (a dry-run bundle in `dist/`), `pnpm run deploy` (deploys by hand; `pnpm deploy` is a built-in pnpm command), and `pnpm types` (regenerates `worker-configuration.d.ts` after a change to `wrangler.jsonc`).

## Pull Request Guidelines

- The **Check** workflow runs `pnpm check` on every pull request: the same check Workers Builds runs before a deploy.
- Link the issue your pull request addresses, if any.
- Keep pull requests small and focused; split unrelated changes into separate pull requests.
- Update the documentation when your change affects behavior or usage.
- Be responsive to review feedback.
