# SizeSeize

Personal stock-monitoring dashboard. Sign in with Google, track product URLs with an optional desired size, get email alerts when that size (or the product overall) becomes available, and receive a daily stock summary.

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

1. **Site-specific** adapters (Nike, Adidas, Next, ASOS) when the host matches
2. **Shopify** layer (product `.js` / variant availability JSON)
3. **Structured data** layer (JSON-LD, embedded variant JSON, `__NEXT_DATA__`)
4. **Generic DOM** layer only when size controls and availability states are clear

If confidence is low, SizeSeize does **not** guess. The product is marked unsupported/unable to detect.

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
