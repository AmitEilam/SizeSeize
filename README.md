# SizeSeize

Personal stock-monitoring dashboard. Sign in with Google, track product URLs with an optional desired size, get email alerts when that size (or the product overall) becomes available, and receive a daily stock summary. Dashboard settings control preferred daily check time and which email types to send.

## Stack

- **Next.js (React)** - UI + API routes
- **Supabase** - Google auth, Postgres, RLS
- **Resend** - alert + summary emails
- **Vercel** - hosting + daily Hobby cron

## Quick start

1. Follow **[SETUP.md](SETUP.md)** for Supabase, Google OAuth, Resend, and Vercel.
2. Copy env template:

```bash
cp .env.example .env.local
```

3. Install and run:

```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |

## Detection architecture

Monitoring calls `detectProductAvailability(url)` only. Website details stay inside adapters.

Detection order:

1. **Shopify** layer (product `.js` / variant availability JSON)
2. **Structured data** layer (JSON-LD, embedded variant JSON, `__NEXT_DATA__`)
3. **Generic DOM** layer on the initial HTML response (only when confidence is clear)
4. **Site-specific** adapters (Nike, Adidas, Next, ASOS) when the host matches
5. **Headless browser** fallback (`puppeteer-core` + `@sparticuz/chromium`) — renders the page, runs JavaScript, then inspects the live DOM

Cheaper HTTP layers always run first. The browser fallback is used only when they fail. If confidence is still low after the browser pass, SizeSeize does **not** guess.

Set `BROWSER_FALLBACK=0` to disable the browser layer (useful for debugging).

## Project layout

- `app/` - pages, server actions, cron API
- `lib/adapters/` - layered detectors + site-specific adapters
- `lib/monitoring/` - shared job + size matching (schedule-agnostic)
- `lib/email/` - Resend alert + summary templates
- `supabase/migrations/` - schema + RLS

## Adding a new store

1. Create `lib/adapters/brands/yourstore.ts` implementing `ProductAdapter.detect`
2. Register it in `lib/adapters/detect.ts` under `siteSpecificAdapters`
3. No changes needed to cron, email, or dashboard CRUD
