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
| `/<slug>`, `/<slug>/<child>` | `302` to the link's target (`301` when the link is `permanent`) |
| `/<slug>.qr`, `/<slug>/<child>.qr` | The link's QR code, an SVG with the logo in the middle |
| `/` | `302` to [ouss.es](https://ouss.es) |
| `/robots.txt`, `/favicon.ico`, `/favicon.svg` | Answered directly, and not counted |
| Any other path, or an expired link | `302` to `https://ouss.es/404?from=/<slug>` (the portfolio's 404 page shows it as the address asked for) |
| A method other than `GET` or `HEAD` | `405` |

Slugs match case-insensitively, and a trailing slash is ignored (`/GitHub/` is `/github`). A request's query string is passed on to web page targets (`/github?tab=repositories` → `https://github.com/eoussama?tab=repositories`), except the `qr` key, which marks a scan. Nested paths such as `/github/dx` work when `links.json` defines them; any other nested path goes to the 404 page.

Redirects carry `X-Robots-Tag: noindex`, so search engines don't list them. A `302` is sent with `Cache-Control: private, max-age=0`, so a changed link takes effect at once; a `301` is left for browsers to cache. QR code images are cached for a day, or until their link expires if that comes sooner.

### QR codes

`to.ouss.es/cv.qr` returns a QR code for `to.ouss.es/cv`, ready for a printed CV or a slide. It is an SVG, so it stays sharp at any size, with the logo in the middle; the code uses the highest error correction (level H), so it scans even though the logo covers part of it. The code points to `to.ouss.es/cv?qr`, so scans are counted apart from clicks (outcome `scan`). There is no QR code for an unknown or expired link: its `.qr` address goes to the 404 page, and isn't counted either.

### UTM tags

Links to ouss.es (and its subdomains) get UTM tags, so the portfolio's analytics can tell where a visit came from: `utm_source=to.ouss.es`, `utm_medium=shortlink` (or `qr` for a scan) and `utm_campaign=<slug>`. Tags a link already has are kept, and a request's own tags win. Links to other sites are left as they are.

## Links

`src/links.json` is a tree. Each key in it is one of three things:

- **A link field** (`url`, `mailto` and the fields below): the link at that spot.
- **A child**: lowercase letters, digits and dashes, starting with a letter or digit. It adds a part to the short path, so `github` → `dx` is `to.ouss.es/github/dx`. A key can be a link and hold children at the same time, or only hold children (then its own path has no link).
- **A group**, in parentheses like `(design)`: it only organizes the file and never appears in the URL, so `(design)` → `dribbble` is still `to.ouss.es/dribbble`.

```json
{
  "$schema": "./links.schema.json",
  "(portfolio)": {
    "cv": { "url": "https://ouss.es/p/cv/" },
    "talk": { "url": "https://ouss.es/talks/2026", "expires": "2026-12-31" }
  },
  "github": {
    "url": "https://github.com/eoussama",
    "dx": { "url": "https://github.com/eoussama/dx" }
  },
  "(design)": {
    "dribbble": {
      "url": "https://dribbble.com/EOussama",
      "dx-logo": { "url": "https://dribbble.com/shots/27890164-DX-Logo" }
    }
  },
  "npm": {
    "dx": { "url": "https://www.npmjs.com/package/@eoussama/dx" }
  },
  "mail": { "mailto": "hi@ouss.es", "subject": "Hi Oussama" }
}
```

That gives `to.ouss.es/cv`, `/talk`, `/github`, `/github/dx`, `/dribbble`, `/dribbble/dx-logo`, `/npm/dx` and `/mail`. `/npm` alone has no link, so it goes to the 404 page. A whole short path can be at most 32 characters (it keeps QR codes small and reliable), and the same path can't be defined twice, even through different groups. Only the paths written in the file exist: `to.ouss.es/github/anything-else` goes to the 404 page.

| Field | Kind | Description |
| --- | --- | --- |
| `url` | web page | The target, an absolute `http` or `https` URL. |
| `permanent` | web page | Optional. Answer with `301`, which browsers cache, instead of `302`. Only use it for a link whose target will never change. Repeat clicks then skip the Worker, so they are not counted. Can't be combined with `expires`. |
| `mailto` | email | The recipient's address. |
| `subject`, `body` | email | Optional. Prefilled subject and body. |
| `cc`, `bcc` | email | Optional. One address, or a non-empty list of addresses. |
| `expires` | both | Optional. When the link stops working: a day (`2026-12-31`, which works through that whole day, UTC) or an exact time (`2026-12-31T18:00:00+01:00`). After that, it goes to the 404 page. `pnpm validate` warns about links that have expired. |

To add or change a link, edit `src/links.json` and push to `main`. `pnpm validate` (part of `pnpm check`) rejects a malformed entry before it can be deployed, listing every problem at once with where it is in the file (such as `(design).dribbble.url`), and [`links.schema.json`](src/links.schema.json) gives editors autocompletion. Both come from one [Zod](https://zod.dev) schema in [`src/lib/schema.ts`](src/lib/schema.ts).

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

1. Once per account, enable Analytics Engine in the Cloudflare dashboard (**Workers & Pages** > **Analytics Engine**). It is free, and without it the deploy fails with error 10089.
2. Go to **Workers & Pages** > **Create** > **Import a repository**, and pick this repository.
3. Set the build command to `pnpm check` and the deploy command to `pnpm run deploy` (a bare `pnpm deploy` is a different, built-in pnpm command). Turn off **Preview builds**. A failing check stops the deploy.
4. Under **Branch control**, set the production branch to `main`.
5. The first deploy creates the `to.ouss.es` custom domain (its DNS record and certificate) from [`wrangler.jsonc`](wrangler.jsonc). The analytics dataset is created on its first write.

For development, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
