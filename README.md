# A-1 Drain Cleaning Field App

Private static/PWA field application for A-1 Drain Cleaning.

## Included

- Supabase email/password authentication.
- PostgreSQL Row Level Security so each account can access only its own jobs.
- Private job/invoice photo storage.
- IndexedDB local job storage for temporary offline work.
- Automatic sync when the connection returns.
- Customer authorization and signature capture.
- Compressed job photographs.
- Local PDF generation.
- Installable PWA shell.
- No database password or Supabase service-role key in browser code.

## Setup

1. Create a Supabase project.
2. Open Supabase SQL Editor and run `supabase.sql`.
3. Create the authorized field-app account in Supabase Auth, or use the app's Create account button during initial setup.
4. Put the Supabase Project URL and public anon key into `config.js`.
5. Deploy this repository over HTTPS.
6. Open the deployed app and sign in.

The browser may use the public Supabase URL and anon key. Do not put the database password or `service_role` key in `config.js`.

## Offline behavior

After the app has loaded and the user has an active session, a temporary loss of internet does not prevent a new job from being entered, signed, photographed, completed, and saved locally. When the connection returns, pending records are uploaded automatically.

The first load, account authentication, cloud sync, and cross-device access require internet access. Do not log out while working offline.

## Production security

Keep the Supabase bucket private and keep RLS enabled. Use a strong unique account password and enable MFA where available. If only one authorized operator should have access, disable public sign-up after the owner account is created and remove the Create Account control from the UI.

## Local test

Serve the repository over HTTP rather than opening `index.html` directly with `file://`:

    python3 -m http.server 8080

Then open `http://localhost:8080`.
