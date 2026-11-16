<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-dark.svg">
    <img width="100" src="./assets/logo-light.svg" alt="Redirector logo">
  </picture>
</p>

<h1 align="center">Redirector</h1>
<p align="center">Short links at <a href="https://to.ouss.es">to.ouss.es</a>.</p>

<p align="center">
    <img src="https://img.shields.io/github/v/tag/eoussama/redirector" alt="Latest tag" />
    <img src="https://img.shields.io/github/license/eoussama/redirector" alt="License" />
    <img src="https://img.shields.io/github/languages/code-size/eoussama/redirector" alt="Code size" />
</p>

## Description

A personal link redirector: a [Cloudflare Worker](https://developers.cloudflare.com/workers/) that sends hand-picked slugs, such as `to.ouss.es/github`, to their targets. A link is either a web page or a prefilled email. The links live in this repository, in [`src/links.json`](src/links.json), and are bundled into the Worker, so every change goes through git.

| Request | Response |
| --- | --- |
| `/<slug>` | `302` to the link's target (`301` when the link is `permanent`) |
| `/` | `302` to [ouss.es](https://ouss.es) |
| Any other path | `302` to `https://ouss.es/404?from=<slug>` |
| A method other than `GET` or `HEAD` | `405` |

Slugs match case-insensitively, and a trailing slash is ignored (`/GitHub/` is `/github`). A request's query string is passed on to web page targets (`/cv?ref=x` → `https://ouss.es/p/cv/?ref=x`). Nested paths such as `/github/repo` don't match a slug.

## Links

Every entry in `src/links.json` is an object, keyed by its slug: lowercase letters, digits and dashes, starting with a letter or digit.

```json
{
  "$schema": "./links.schema.json",
  "github": {
    "url": "https://github.com/eoussama"
  },
  "cv": {
    "url": "https://ouss.es/p/cv/",
    "permanent": true
  },
  "mail": {
    "mailto": "hi@ouss.es",
    "subject": "Hi Oussama",
    "body": "Hello!",
    "cc": ["someone@example.com"]
  }
}
```

| Field | Kind | Description |
| --- | --- | --- |
| `url` | web page | The target, an absolute `http` or `https` URL. |
| `permanent` | web page | Optional. Answer with `301`, which browsers cache, instead of `302`. Only use it for a link whose target will never change. Repeat clicks then skip the Worker, so they are not counted. |
| `mailto` | email | The recipient's address. |
| `subject`, `body` | email | Optional. Prefilled subject and body. |
| `cc`, `bcc` | email | Optional. One address, or a non-empty list of addresses. |

To add or change a link, edit `src/links.json` and push to `main`. `pnpm validate` (part of `pnpm check`) rejects a malformed entry before it can be deployed, and [`links.schema.json`](src/links.schema.json) gives editors autocompletion. Both come from one [Zod](https://zod.dev) schema in [`src/lib/schema.ts`](src/lib/schema.ts).

## Analytics

Each `GET` request writes one data point (`HEAD` requests, from link checkers and monitors, are not counted) to the `redirector_clicks` [Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/) dataset. It holds the slug, the outcome (`hit`, `miss` or `root`), the visitor's country and the host of the page they came from. **No IP address or user agent is ever recorded** (a referrer that is a bare IP address is left blank too), and Workers Logs and traces are turned off in [`wrangler.jsonc`](wrangler.jsonc) (Cloudflare turns them on by default). Data is kept for 90 days.

| Column | Value |
| --- | --- |
| `index1`, `blob1` | Slug (at most 96 and 256 bytes; longer ones are cut) |
| `blob2` | Outcome |
| `blob3` | Country (ISO code), empty when unknown |
| `blob4` | Referrer host, empty when none |
| `double1` | `1` |

To see the numbers, copy `.env.example` to `.env.stats` (not `.env`, which Wrangler would load into the local Worker), fill in your account ID and an API token with the *Account Analytics: Read* permission, then run:

```bash
pnpm stats                  # clicks per slug and outcome, last 30 days
pnpm stats --days 7         # over another period, up to 90 days
pnpm stats --by country     # per country (or --by referrer)
```

The script queries the [SQL API](https://developers.cloudflare.com/analytics/analytics-engine/sql-api/), which you can also call directly for other questions.

## Deployment

[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/) deploys every push to `main`:

1. In the Cloudflare dashboard, go to **Workers & Pages** > **Create** > **Import a repository**, and pick this repository.
2. Set the build command to `pnpm check` and the deploy command to `pnpm run deploy` (a bare `pnpm deploy` is a different, built-in pnpm command). Turn off **Preview builds**. A failing check stops the deploy.
3. Under **Branch control**, set the production branch to `main`.
4. The first deploy creates the `to.ouss.es` custom domain (its DNS record and certificate) from [`wrangler.jsonc`](wrangler.jsonc). The analytics dataset is created on its first write.

For development, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
