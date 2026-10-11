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

- Home page destination and action cards: `app/page.tsx`
- HOA document listings: `app/documents/page.tsx`
- Neighborhood map and HOA tract gallery: `app/neighborhood-map/page.tsx`
- Colors and layout: `app/globals.css`
- Public PDFs: `public/documents/`
- Neighborhood imagery: `public/`
- Enhanced HOA tract images: `public/tracts/`
- Neighborhood map source link: `Info/MapLink.txt`
- Current Board/Officer saved roster and seat terms: `Info/Leadership2026.json`
- Live Board/Officer roster: Supabase leadership tables, managed through `/admin/`
- Historical Board records: `Info/Board.txt`
- Committee roster: `Info/Commitees.txt`
- Future event dates: `Info/Events.txt`

When replacing a PDF, keep its public filename the same so existing links continue to work. If you add a new document, copy it to `public/documents/` and add a matching entry to the appropriate list at the top of `app/page.tsx`.

Historical Board records use tab-separated columns for year, officer name, and position. The current five-seat roster and annual Officer appointments are maintained separately. Published Supabase records update the public pages in the browser; saved files provide the static fallback.

Committee membership is maintained in `Info/Commitees.txt`. Keep each committee heading on its own line and list each person below it as `Name, Role`. Committee descriptions and responsibilities are maintained on the Committees page.

Add future events to `Info/Events.txt`, one event per line, using tab-separated columns in this order: `YYYY-MM-DD`, time, event name, location, street address, and details. Past dates are automatically omitted from the Events page. When an event includes a street address, the page automatically displays a map preview and a Google Maps link.

## Cloudflare deployment from GitHub

The existing GitHub repository is connected to Cloudflare Workers Builds for the `plum-creek-hoa` service. Push to `main` to trigger that deployment; check the commit's **Workers Builds: plum-creek-hoa** status for the result. Keep the existing Cloudflare connection and build settings.

For a separate Cloudflare Pages deployment, use `pnpm build` as the build command and `out` as the output directory, then attach the HOA domain in Cloudflare.

The project generates a static export. Public content has a saved fallback; the homeowner portal and live roster connect to Supabase from the browser. Cloudflare rebuilds it automatically whenever the GitHub repository changes. `lib/supabase-public-config.json` supplies this website's public project URL and publishable key, so a GitHub build works without `.env.local`. Optional `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` build variables override those defaults; never use a service-role key.

Optional: add a `NEXT_PUBLIC_SITE_URL` build variable containing the final `https://` HOA domain so social-share image links use the custom domain. Without it, Cloudflare's automatically supplied deployment URL is used.

## Privacy note

`Houses Addresses.txt` is source material only and is intentionally not copied into the public website.

## Homeowner portal

`/portal/` provides sign-in and passcode-gated registration. `/members/` provides current contact details, ownership requests and approved properties. `/admin/` provides authorized leadership property reviews, occupancy management and system administrator appointment controls. MFA is enforced by the database for privileged actions. Historical homeowner imports do not grant access.

See [portal setup and table reference](docs/portal-setup-and-reference.md) for first-administrator activation, permissions, migrations and deployment configuration, and [the initial Supabase review](docs/supabase-development-review.md) for remaining rental storage work.
