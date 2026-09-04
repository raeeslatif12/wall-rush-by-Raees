# WallRush

WallRush is a Quoridor-style 1v1 game built with TanStack Start, React, Neon PostgreSQL, and Vercel-compatible server APIs.

## Development

```sh
npm install
npm run dev
```

Set `DATABASE_URL` and `JWT_SECRET` in `.env.local`. The database schema is in `db/schema.sql`; the API also creates it automatically on first request.

## Production

Configure `DATABASE_URL` and a long random `JWT_SECRET` as private Vercel environment variables, then deploy the project through GitHub.

For Vercel, set these variables in **Project Settings -> Environment Variables** with the **Production** environment selected:

```env
DATABASE_URL=your-Neon-connection-string
JWT_SECRET=long-random-session-secret
ADMIN_USERNAME=raees
ADMIN_PASSWORD_HASH=bcrypt-hash-for-your-admin-password
ADMIN_JWT_SECRET=another-long-random-secret
```

After deployment, verify `https://your-domain.example/api/health` returns `{"ok":true,"database":"neon","schema":"ready"}`. If it returns `503`, the Vercel function logs contain a request ID and the database-side cause without exposing credentials.

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Neon PostgreSQL
