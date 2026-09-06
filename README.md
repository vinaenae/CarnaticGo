# Ragify

AI-powered Carnatic vocal practice — shruti detection, tala simulation, and raga intelligence.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The product name shown in the app (tab title, header, auth) is **Ragify** — see `src/lib/site.ts`.

**Do not use [ragifyapp.com](https://ragifyapp.com) for local work** — that is the live production site on Vercel. Clone the repo, copy `.env.example` to `.env.local`, set `NEXT_PUBLIC_APP_URL=http://localhost:3000`, then run `npm run dev:web`.

If Google sign-in sends you to `ragifyapp.com` instead of localhost, ask the repo owner to add `http://localhost:3000/auth/callback` under Supabase → Authentication → URL configuration → Redirect URLs.

## Deploy

The Next.js app deploys on Vercel; Supabase backs auth and user data. See `docs/COLLABORATOR_GUIDE.md` for environment variables.
