# Development database

Two scripts manage test data in the local MongoDB from `docker-compose.yml`.
Both read `MONGODB_URI` from `.env`, and both refuse to run when
`NODE_ENV=production` or when the database is not on `localhost`.

## Seed test data

```sh
npm run db:seed
```

This adds:

- **18 users**: 1 admin, 3 interviewers and 14 candidates. All use the
  password `Seed@Pass123`, with emails like `ada@seed.interviewhub.dev`. The
  script prints the full list.
- **9 quiz contests**: 4 ended (scored, ranked and rated by the app's own
  finalize code, so results, leaderboards and candidate scores are real),
  1 live for three hours from the time you seed, 2 upcoming, 1 draft and
  1 cancelled.
- **3 rooms**: waiting, active (with a pinned question and chat) and ended.

Seeding never touches other data. Running it again replaces only what an
earlier run created, so run it again whenever the live contest has ended or
the upcoming ones have started.

## Wipe everything

```sh
npm run db:wipe            # asks you to type the database name
npm run db:wipe -- --yes   # no question
```

This deletes every document in every collection (the indexes stay) and every
uploaded file under `uploads/`. It cannot be undone.
