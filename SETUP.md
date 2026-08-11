# SizeSeize Setup Guide

Follow these steps in order. Stop after each external-service section, complete the dashboard work, then continue.

---

## Phase 0 - Local project (already scaffolded)

```bash
cd /Users/amiteilam/Desktop/SizeSeize
cp .env.example .env.local
npm install
npm run dev
```

Keep `.env.local` private. Never commit secrets.

---

## Phase 1 - Supabase project

### 1. Create the project

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click **New project**
3. Choose your org, name it `SizeSeize`, set a strong DB password, pick a region close to you
4. Wait until the project is ready

### 2. Copy API keys

1. In the project, go to **Project Settings → API**
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (server only)

### 3. Apply the database migration

1. Go to **SQL Editor → New query**
2. Paste the full contents of [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql)
3. Click **Run**
4. Confirm tables exist under **Table Editor**: `profiles`, `monitored_products`
5. Also run [`supabase/migrations/002_product_image.sql`](supabase/migrations/002_product_image.sql) if your project was created before product images were added

### How to verify

- Tables appear with RLS enabled
- No SQL errors in the editor history
- `monitored_products` includes `product_image_url`

---

## Phase 2 - Google OAuth + Supabase Auth

### 1. Create Google OAuth credentials

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project (e.g. `SizeSeize`)
3. Go to **APIs & Services → OAuth consent screen**
   - User type: **External** (unless you use Workspace internal)
   - App name: `SizeSeize`
   - Support email: your email
   - Save
4. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `SizeSeize Web`
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:3000`
   - Your future production URL (e.g. `https://sizeseize.vercel.app`) when known
6. Under **Authorized redirect URIs**, add the Supabase callback:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

Replace `YOUR_PROJECT_REF` with the subdomain from your Supabase Project URL.

7. Click **Create**
8. Copy **Client ID** and **Client Secret**

### 2. Enable Google in Supabase

1. Supabase → **Authentication → Providers → Google**
2. Enable Google
3. Paste **Client ID** and **Client Secret**
4. Save

### 3. Configure auth redirect URLs in Supabase

1. Supabase → **Authentication → URL Configuration**
2. **Site URL**: `http://localhost:3000` (change to production URL after deploy)
3. **Redirect URLs** include:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR_VERCEL_DOMAIN/auth/callback` (after deploy)

### 4. Local env

In `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### How to verify

1. Run `npm run dev`
2. Open `http://localhost:3000/login`
3. Click **Continue with Google**
4. Complete OAuth
5. You should land on `/dashboard`
6. Supabase → **Authentication → Users** should show your user
7. `profiles` should contain your email (via trigger)

---

## Phase 3 - Resend email

### 1. Create API key

1. Open [https://resend.com](https://resend.com) and sign in
2. Go to **API Keys → Create API Key**
3. Permission: **Sending access**
4. Copy the key → `RESEND_API_KEY` in `.env.local`

### 2. Sender address

**Quick start (testing):**

```env
EMAIL_FROM=SizeSeize <onboarding@resend.dev>
```

Resend test sender can only deliver to **your Resend account email** until a domain is verified.

**Production (recommended):**

1. Resend → **Domains → Add Domain**
2. Add the DNS records Resend shows (SPF/DKIM) at your DNS provider
3. Wait until domain status is **Verified**
4. Set:

```env
EMAIL_FROM=SizeSeize <alerts@yourdomain.com>
```

### How to verify

After deploy (or locally with keys set), trigger a product check that becomes available, or wait for the daily cron. Check Resend → **Emails** for delivery logs.

---

## Phase 4 - Vercel deploy + daily cron (Hobby)

### 1. Push the repo to GitHub

Create a GitHub repo and push this project (do not commit `.env.local`).

### 2. Import on Vercel

1. Open [https://vercel.com](https://vercel.com)
2. **Add New → Project** → import the SizeSeize repo
3. Framework: Next.js (auto-detected)

### 3. Environment variables (Vercel → Project → Settings → Environment Variables)

Add for **Production** (and Preview if you want):

| Name | Notes |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as local |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR_PROJECT.vercel.app` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only |
| `RESEND_API_KEY` | Server only |
| `EMAIL_FROM` | Verified sender |
| `CRON_SECRET` | Long random string (e.g. `openssl rand -hex 32`) |

### 4. Cron schedule

[`vercel.json`](vercel.json) already defines:

```json
{
  "crons": [{ "path": "/api/cron/monitor", "schedule": "0 11 * * *" }]
}
```

That is **11:00 UTC daily** = **2:00 PM Israel summer time (IDT)**. In winter (IST, UTC+2) the same cron runs at **1:00 PM** Israel time. Hobby allows at most one run per day.

Users can set a preferred local check time and email toggles on **Settings** (`profiles` notification columns from migration `004_notification_preferences.sql`). If today's scheduled check already ran, a new preferred time is queued and applies from tomorrow. Availability alerts still fire only on unavailable → available transitions; daily summary and alert emails can be disabled independently.

Keep `vercel.json` aligned with `PLATFORM_CRON_UTC_HOUR` in `lib/monitoring/schedule.ts` (currently 11). On a plan that allows hourly crons, set `CRON_STRICT_HOUR=true` so the job waits until each user's preferred local time.

### Browser fallback

When cheaper detectors fail, SizeSeize renders the product page in headless Chromium (`puppeteer-core` + `@sparticuz/chromium`) and reads the live size UI. This is free but slower, and may approach Hobby time limits if many products need it in one cron run. Disable with `BROWSER_FALLBACK=0`.

Vercel automatically sends:

```http
Authorization: Bearer <CRON_SECRET>
```

### 5. Update Google + Supabase for production URLs

1. Google OAuth client → add production origin + keep Supabase callback URI
2. Supabase Auth URL config → Site URL + redirect `https://YOUR_DOMAIN/auth/callback`

### 6. Deploy

Click **Deploy**. After success:

1. Sign in at the production URL
2. Add a product
3. Optionally click **Check now** on a card
4. Manually invoke cron (optional):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR_DOMAIN/api/cron/monitor
```

5. Vercel → **Logs** / cron history should show a 200 response

### Later: hourly monitoring

When you leave Hobby / enable more frequent crons, change only the schedule in `vercel.json` (e.g. `0 * * * *`). The monitoring core in `lib/monitoring/runDailyJob.ts` does not need a redesign. Optionally split alert checks and the evening summary into two routes later.

---

## Security checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET` are server-only
- [ ] `.env.local` is gitignored
- [ ] RLS policies applied from migration
- [ ] Cron route returns 401 without the bearer secret
