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
| `/<slug>.qr` | The link's QR code, an SVG with the logo in the middle |
| `/` | `302` to [ouss.es](https://ouss.es) |
| `/robots.txt`, `/favicon.ico`, `/favicon.svg` | Answered directly, and not counted |
| Any other path, or an expired link | `302` to `https://ouss.es/404?from=<slug>` |
| A method other than `GET` or `HEAD` | `405` |

Slugs match case-insensitively, and a trailing slash is ignored (`/GitHub/` is `/github`). A request's query string is passed on to web page targets (`/github?tab=repositories` → `https://github.com/eoussama?tab=repositories`), except the `qr` key, which marks a scan. Nested paths such as `/github/repo` don't match a slug.

### QR codes

`to.ouss.es/cv.qr` returns a QR code for `to.ouss.es/cv`, ready for a printed CV or a slide. It is an SVG, so it stays sharp at any size, with the logo in the middle; the code uses the highest error correction (level H), so it scans even though the logo covers part of it. The code points to `to.ouss.es/cv?qr`, so scans are counted apart from clicks (outcome `scan`). There is no QR code for an unknown or expired link: its `.qr` address goes to the 404 page, and isn't counted either.

### UTM tags

Links to ouss.es (and its subdomains) get UTM tags, so the portfolio's analytics can tell where a visit came from: `utm_source=to.ouss.es`, `utm_medium=shortlink` (or `qr` for a scan) and `utm_campaign=<slug>`. Tags a link already has are kept, and a request's own tags win. Links to other sites are left as they are.

## Links

Apart from the `$schema` key (which points editors to the schema), every entry in `src/links.json` is an object, keyed by its slug: 1 to 32 lowercase letters, digits and dashes, starting with a letter or digit.

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
  "talk": {
    "url": "https://ouss.es/talks/2026",
    "expires": "2026-12-31"
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
| `permanent` | web page | Optional. Answer with `301`, which browsers cache, instead of `302`. Only use it for a link whose target will never change. Repeat clicks then skip the Worker, so they are not counted. Can't be combined with `expires`. |
| `mailto` | email | The recipient's address. |
| `subject`, `body` | email | Optional. Prefilled subject and body. |
| `cc`, `bcc` | email | Optional. One address, or a non-empty list of addresses. |
| `expires` | both | Optional. When the link stops working: a day (`2026-12-31`, which works through that whole day, UTC) or an exact time (`2026-12-31T18:00:00+01:00`). After that, it goes to the 404 page. `pnpm validate` warns about links that have expired. |

To add or change a link, edit `src/links.json` and push to `main`. `pnpm validate` (part of `pnpm check`) rejects a malformed entry before it can be deployed, and [`links.schema.json`](src/links.schema.json) gives editors autocompletion. Both come from one [Zod](https://zod.dev) schema in [`src/lib/schema.ts`](src/lib/schema.ts).

## Analytics

Each `GET` redirect writes one data point (`HEAD` requests, from link checkers and monitors, are not counted, nor are QR code images, `robots.txt` or the favicon) to the `redirector_clicks` [Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/) dataset. It holds the slug, the outcome (`hit`, `scan` for a QR code scan, `miss`, `expired` or `root`), the visitor's country and the host of the page they came from. **No IP address or user agent is ever recorded** (a referrer that is a bare IP address is left blank too), and Workers Logs and traces are turned off in [`wrangler.jsonc`](wrangler.jsonc) (Cloudflare turns them on by default). Data is kept for 90 days.

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
