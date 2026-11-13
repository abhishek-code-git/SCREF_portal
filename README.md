# The Centennial School — Digital Operating Platform

Next.js (App Router) + Supabase. This is the same app and design as the earlier TanStack/Vite
version, moved to Next.js 15 with all Lovable tooling removed.

## 1. Connect your Supabase project

1. Create a project at [supabase.com](https://supabase.com) (or use an existing one).
2. Copy `.env.example` to `.env.local` and fill in, from **Project Settings → API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the publishable / anon key)
   - `SUPABASE_SERVICE_ROLE_KEY` — only for server code, never exposed to the browser
3. Create the database tables. Either:
   - **Supabase CLI:** `npx supabase link --project-ref <your-ref>` then `npx supabase db push`, or
   - **SQL editor:** run the files in `supabase/migrations/` in order (`…0000` to `…0005`).
4. In **Authentication → URL Configuration** set *Site URL* to your site (e.g. `http://localhost:3000`
   while developing) and add `<site>/reset-password` to *Redirect URLs*. Sign-up confirmation and
   password-reset emails link back to these.
5. Your first signed-up account becomes a normal centre owner. To make an account a central admin,
   insert a row in `public.memberships` for that user with role `central_super_admin` (SQL editor).

## 2. Run

```sh
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Needs Node.js 20+.

## Project layout

| Path | What it is |
| --- | --- |
| `src/app/**/page.tsx` | Routes (App Router). Each sets its page title/description and renders a view. |
| `src/views/*-page.tsx` | The page UIs (client components). |
| `src/components/` | App shell, shared kit, shadcn/ui components. |
| `src/hooks/` | Session, school-membership and workspace hooks. |
| `src/integrations/supabase/` | Browser client, server (service-role) client, route-handler auth helper, DB types. |
| `supabase/migrations/` | Database schema + row-level-security policies. |
| `supabase/tests/rls-isolation.sql` | Cross-school isolation test (run in the SQL editor; every line should say PASS). |

Routes: `/`, `/login`, `/reset-password`, `/dashboard`, `/principal`, `/teacher`, `/students`,
`/parents`, `/staff`, `/admissions`, `/attendance`, `/finance`, `/transport`, `/communication`,
`/academics`, `/reports`, `/support`, `/settings`.

## Notes

- Logo: `public/centennial-logo.png` is a 64 px copy of the crest taken from the favicon. Replace
  it with your full-resolution logo (same file name, or edit `src/components/brand.tsx`).
- After changing the database, regenerate `src/integrations/supabase/types.ts` with
  `npx supabase gen types typescript --project-id <your-ref> > src/integrations/supabase/types.ts`.
