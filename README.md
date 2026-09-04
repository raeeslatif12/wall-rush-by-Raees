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

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Neon PostgreSQL
