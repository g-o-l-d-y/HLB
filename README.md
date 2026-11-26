# High Low Buffalo

A Python web app for keeping private daily High, Low, and Buffalo entries. FastAPI provides the API, Supabase provides email/password authentication and persistent storage, and the static frontend is deployed alongside it on Vercel.

## Run locally

Create and activate a virtual environment, install dependencies, and add your Supabase credentials:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` in `.env`, then run:

```bash
set -a
source .env
set +a
uvicorn api.index:app --reload
```

Open [http://localhost:8000](http://localhost:8000). FastAPI serves the frontend and API on the same origin during local development.

## Supabase setup

1. Create a Supabase project and copy its project URL and **publishable key** (`sb_publishable_...`).
2. In **Project Settings → API Keys**, configure those as `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Do not use a secret key (`sb_secret_...`) or the legacy service-role key: those have elevated access and bypass row-level security.
3. In the Supabase SQL editor, run:

```sql
create table public.daily_entries (
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  high text not null default '',
  low text not null default '',
  buffalo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_date)
);

alter table public.daily_entries enable row level security;

create policy "Users can view their own entries"
  on public.daily_entries for select
  using (auth.uid() = user_id);

create policy "Users can create their own entries"
  on public.daily_entries for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own entries"
  on public.daily_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.daily_entries to authenticated;
```

Each user can read or change only their own rows. Saving another entry for the same date updates that day's existing entry.

## Deploy from GitHub to Vercel

1. Push this project to a GitHub repository.
2. In Vercel, choose **Add New → Project**, import the repository, and keep the included `vercel.json` configuration.
3. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` under **Project Settings → Environment Variables** for the environments you use.
4. Deploy. Vercel redeploys when you push commits to the connected repository.

If Supabase email confirmation is enabled, new users will need to confirm their email before signing in. Configure the Supabase Auth site URL and redirect URLs for your local and Vercel domains.
