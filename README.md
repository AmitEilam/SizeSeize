# SizeSeize

Personal stock-monitoring dashboard. Sign in with Google, track product URLs with a desired size, get email alerts when that size becomes available, and receive a daily stock summary.

## Stack

- **Next.js (React)**: UI + API routes
- **Supabase**: Google auth, Postgres, RLS
- **Resend**: alert + summary emails
- **Vercel**: hosting + daily Hobby cron

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

## Project layout

- `app/`: pages, server actions, cron API
- `lib/adapters/`: expandable site adapters (Shopify + Israeli starters)
- `lib/monitoring/`: shared job + size matching (schedule-agnostic)
- `lib/email/`: Resend alert + summary templates
- `supabase/migrations/`: schema + RLS

## Adding a new store

1. Create `lib/adapters/yourstore.ts` implementing `ProductAdapter`
2. Register it in `lib/adapters/registry.ts` (specific hosts before Shopify)
3. No changes needed to cron, email, or dashboard CRUD
