# Pantas website

The public marketing site for Pantas: Home, About, Roadmap, Programs, Careers and Contact.

It is a plain static site with no build step. Each page is a single HTML file with its styles inline, plus one small shared script (`assets/runtime.js`) that renders the page and runs its interactions and animations.

## Pages

| Route | File |
| --- | --- |
| `/` | `index.html` |
| `/about` | `about.html` |
| `/roadmap` | `roadmap.html` |
| `/programs` | `programs.html` |
| `/careers` | `careers.html` |
| `/contact` | `contact.html` |

`vercel.json` turns on clean URLs, so `/about` serves `about.html`. `404.html` is the not-found page.

## Deploy on Vercel

1. In Vercel, choose **Add New → Project** and import this repository.
2. Framework preset: **Other**. Leave the build command and output directory empty.
3. Deploy. Every push to `main` redeploys automatically.

## Run locally

Any static file server works, for example:

```sh
npx serve .
```

## Placeholders before launch

- The Google Play badge is a placeholder. Swap in the official badge and the Play Store link.
- "Join the community", "Contact Support" and the case-study link on About don't point anywhere yet.
- The Contact partnership form and the iOS launch-updates form validate input but don't send it anywhere yet. Connect them to a form backend or API before launch.

## Source of truth

Copy and design decisions live in the Pantas Master SSOT (Web & Copy). The designs were made in the Pantas Website canvas in Claude Design.
