# The Supernatural World

Public-deployment-ready Node.js app for tracking the 339-item watch order.

## What changed for public hosting
- User accounts and watched-episode progress are stored in PostgreSQL (not on the web server's temporary disk).
- Login sessions are stored in PostgreSQL too.
- Passwords remain bcrypt-hashed; raw passwords are never stored.
- The app requires `DATABASE_URL` and a strong `SESSION_SECRET` before it starts.

## Run locally
1. Install Node.js 20 or newer.
2. Create a PostgreSQL database and obtain its connection string.
3. In PowerShell, set:
   ```powershell
   $env:DATABASE_URL="YOUR_POSTGRES_CONNECTION_STRING"
   $env:SESSION_SECRET="PUT_A_LONG_RANDOM_SECRET_HERE_AT_LEAST_32_CHARACTERS"
   ```
4. In this folder, run:
   ```powershell
   npm install
   npm start
   ```
5. Open http://localhost:3000

## Suggested public deployment (Render + Supabase)
1. Create a Supabase project and wait until its database is ready.
2. In Supabase, open **Connect** and copy the PostgreSQL connection string. Prefer the **Session pooler** string for a hosted Node service if the direct connection is not reachable from the host. Keep the password private.
3. Create a GitHub repository and upload the contents of this project folder (the files inside `supernatural-world`, not the outer ZIP folder).
4. In Render, create a **New Web Service** and connect that GitHub repository.
5. Configure:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Environment: `NODE_ENV` = `production`
   - `DATABASE_URL` = your Supabase PostgreSQL connection string
   - `SESSION_SECRET` = a unique random string of at least 32 characters
6. Deploy. Render will provide a public `onrender.com` address.
7. Test account creation, logout/login, and watched-episode progress from a second browser/device before sharing the link.

## Important notes
- Do not publish `DATABASE_URL` or `SESSION_SECRET`, and never paste them into public GitHub files or screenshots.
- A free web-service plan may sleep when idle; the first visit after inactivity can take longer. Check the host's current limits before choosing a plan.
- A free Supabase database may pause after a period of inactivity. Check current plan limits and backup options before inviting users to rely on the site.
- Google indexing is a separate step after the site is publicly deployed; appearing in search results is not immediate or guaranteed.
- This project labels standard episodes by show/season/episode code rather than official episode titles. The 339-item order is retained from the supplied project.
