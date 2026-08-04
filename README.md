# Plum Creek Homeowners Association website

The public website for Plum Creek HOA. It includes neighborhood information and downloadable governing documents and plat maps.

## Local development

Requires Node.js 22 or newer.

```bash
pnpm install
pnpm dev
```

Open the local address shown in the terminal. To verify a production build:

```bash
pnpm build
```

## Updating content

- Main page copy and document listings: `app/page.tsx`
- Colors and layout: `app/globals.css`
- Public PDFs: `public/documents/`
- Neighborhood imagery: `public/`
- Neighborhood map source link: `Info/MapLink.txt`
- Board roster and history: `Info/Board.txt`
- Future event dates: `Info/Events.txt`

When replacing a PDF, keep its public filename the same so existing links continue to work. If you add a new document, copy it to `public/documents/` and add a matching entry to the appropriate list at the top of `app/page.tsx`.

Board records use tab-separated columns for year, officer name, and position. The website automatically treats the latest year in `Info/Board.txt` as the current roster.

Add future events to `Info/Events.txt`, one event per line, using tab-separated columns in this order: `YYYY-MM-DD`, time, event name, location, street address, and details. Past dates are automatically omitted from the Events page. When an event includes a street address, the page automatically displays a map preview and a Google Maps link.

## Cloudflare deployment from GitHub

1. Push this repository to GitHub.
2. In Cloudflare, create a new Pages project and connect the GitHub repository.
3. Use `pnpm build` as the build command.
4. Use `out` as the build output directory.
5. After the first deployment, attach the HOA domain to the Pages project in Cloudflare.

The project generates a fully static export with no server or database required. Cloudflare rebuilds it automatically whenever the GitHub repository changes.

Optional: add a `NEXT_PUBLIC_SITE_URL` build variable containing the final `https://` HOA domain so social-share image links use the custom domain. Without it, Cloudflare's automatically supplied deployment URL is used.

## Privacy note

`Houses Addresses.txt` is source material only and is intentionally not copied into the public website.
