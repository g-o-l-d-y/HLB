# High Low Buffalo

High Low Buffalo is a private, daily reflection tracker for recording a **High**, **Low**, and **Buffalo** entry. The app combines a FastAPI backend, a responsive static frontend, and Supabase authentication and database storage.

## Features

- Email/password authentication
- One daily entry per account and date
- Private data protected by Supabase Row Level Security
- Dashboard for creating and updating entries
- Overview table of saved entries
- HTTP-only session cookies
- Local and Vercel deployment support
- Health check endpoint at `/api/health`

## Technology

- Python 3 + FastAPI
- httpx
- Supabase Auth and Postgres
- HTML, CSS, and vanilla JavaScript
- Vercel serverless deployment

## Project structure

```text
api/index.py       FastAPI application and API routes
public/index.html  Application shell
public/app.js      Frontend application and API calls
public/styles.css  Responsive application styles
tests/test_app.py  Application tests
vercel.json        Vercel build and route configuration
requirements.txt   Python dependencies
.env.example       Local environment template
```

## Prerequisites

- Python 3.10 or newer
- A Supabase project
- A Vercel account for production hosting (optional for local use)

## Local development

1. Create and activate a virtual environment:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

2. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

3. Set these values in `.env`:

   ```dotenv
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
   ```

   Use a Supabase publishable key. Never add a secret key or legacy service-role key to a browser environment or this server-side application.

4. Start the API and frontend:

   ```bash
   set -a
   source .env
   set +a
   uvicorn api.index:app --reload --host 0.0.0.0 --port 8000
   ```

5. Open `http://localhost:8000`.

## Supabase configuration

### 1. Create the project

Create a Supabase project, then copy:

- the Project URL as `SUPABASE_URL`
- the publishable API key as `SUPABASE_PUBLISHABLE_KEY`

Both values are available from **Project Settings → API Keys**.

### 2. Create the table and policies

Run the following SQL in the Supabase SQL Editor:

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
  on public.daily_entries
  for select
  using (auth.uid() = user_id);

create policy "Users can create their own entries"
  on public.daily_entries
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own entries"
  on public.daily_entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.daily_entries to authenticated;
```

The primary key `(user_id, entry_date)` ensures that saving a date twice updates that user's existing entry instead of creating a duplicate.

### 3. Configure Auth URLs

In Supabase under **Authentication → URL Configuration**, set:

- **Site URL** to the production URL, such as `https://your-domain.vercel.app`
- **Redirect URLs** to the production domain and, if needed, `http://localhost:8000`

If email confirmation is enabled, a new user must confirm the email before signing in.

## Production deployment

### Deploy to Vercel

1. Push the repository to GitHub.
2. In Vercel, select **Add New → Project** and import the repository.
3. Use the included `vercel.json` configuration; no framework preset or custom build command is required.
4. Add these environment variables to the Vercel project:

   | Variable | Value |
   |---|---|
   | `SUPABASE_URL` | Supabase project URL |
   | `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |

5. Add the variables to each required environment: Production, Preview, and Development.
6. Deploy the project. Future pushes to the connected branch trigger redeployment.

After deployment:

- Verify `/api/health` returns `{"status":"ok"}`.
- Sign up or sign in with a test account.
- Create an entry and confirm it persists after signing out and back in.
- Confirm only the authenticated user's entries are visible.

## API routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Public health check |
| `GET` | `/api/session` | Return the current authenticated user |
| `POST` | `/api/auth/signup` | Create an account |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | Sign out and remove the session cookie |
| `GET` | `/api/entries` | List entries for the current user |
| `PUT` | `/api/entries` | Create or update a daily entry |

## Security notes

- Supabase access uses a publishable key and the authenticated user's bearer token.
- The access token is stored in an HTTP-only, SameSite Lax cookie.
- Cookies use the Secure flag in Vercel production environments.
- Row Level Security is the final authorization boundary in Supabase.
- Server environment variables must never be committed to source control.
- `.env` and virtual environments should remain excluded by `.gitignore`.

## Testing

Run the test suite with:

```bash
python -m unittest discover -s tests -v
```

The suite covers frontend serving, the health endpoint, protected entry access, and HTTP-only session cookie behavior.

## Maintenance

- Review Supabase Auth settings when changing domains or enabling confirmation.
- Rotate Supabase credentials through the Supabase and Vercel dashboards if a key is exposed.
- Use the Vercel deployment logs and `/api/health` for initial production troubleshooting.
- Back up the Supabase database using the project's configured backup or export process.
