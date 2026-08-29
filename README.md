# Month-End Njangi

Rebuilt PWA — contribution tracker for a savings group. React + Vite + TypeScript, Supabase backend, deployable to Netlify.

## 1. Install dependencies

```bash
npm install
```

## 2. Run locally

```bash
npm run dev
```

Visit the printed local URL (default `http://localhost:5173`).

## 3. Supabase tables

Your Supabase project is already wired in (`src/supabaseClient.ts` and `public/sw.js`).
If any tables are missing, recreate them with this SQL in the Supabase SQL editor:

```sql
create table members (
  id bigint generated always as identity primary key,
  name text not null,
  paid boolean default false
);

create table month_payments (
  id bigint generated always as identity primary key,
  member_id bigint references members(id) on delete cascade,
  month_key text not null,
  paid boolean default false,
  unique (member_id, month_key)
);

create table chat_messages (
  id bigint generated always as identity primary key,
  sender text not null,
  role text not null,
  message text,
  image_b64 text,
  created_at timestamptz default now()
);

create table ledger (
  id bigint generated always as identity primary key,
  month_key text unique not null,
  beneficiary text not null,
  notes text
);

alter table members disable row level security;
alter table month_payments disable row level security;
alter table chat_messages disable row level security;
alter table ledger disable row level security;
```

Also enable Realtime on `chat_messages` (Database → Replication) so the live chat updates
without waiting for the 20s service-worker poll.

## 4. Login credentials

- Treasurer: `treasurer` / `boss2026`
- Member: `member` / `member123`

(Hardcoded client-side in `src/App.tsx` — matches the original app's design. Since RLS is
disabled, anyone with the anon key has full read/write access regardless of login — the
login screen is a UI gate, not a security boundary.)

## 5. Deploy to Netlify

```bash
npm run build
```

This outputs a `dist/` folder. On Netlify:
- **Build command:** `npm run build`
- **Publish directory:** `dist`

Or drag-and-drop the `dist/` folder into Netlify's manual deploy UI.

## 6. App icon

`public/icon.png` is your actual Njangi logo, already wired into `manifest.json` and
`index.html` (including `apple-touch-icon` for iOS). No further action needed there.

## 7. Turning this into an Android APK (optional)

Once deployed to Netlify, see the separate Bubblewrap/TWA build guide provided earlier in
this project — it wraps this same Netlify URL into a signed installable APK.

## Notes

- Push notifications require the user to accept the browser permission prompt (requested
  automatically after login). This only works over HTTPS, so it won't fire on `localhost`
  — test it on the deployed Netlify URL.
- Images sent in chat are compressed client-side (max 900px, JPEG ~60% quality) before
  being stored as base64 in `chat_messages.image_b64` — no Supabase Storage bucket needed.
- Chat uses Supabase Realtime for instant updates when the app is open, and the service
  worker's 20s poll for notifications when the app is backgrounded/closed.
