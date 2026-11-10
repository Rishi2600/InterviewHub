# Running the code judge

Code contests are judged by a separate process, not the API. The API writes
each submission to the `code_submissions` collection as a job; the judge takes
jobs from there, runs the program against the question's hidden tests in
WebAssembly, and writes the verdicts back. Until a judge runs, submissions
stay "Judging…" and code contests wait to be finalized (for up to 10 minutes
after their end).

## Start it

```sh
npm run build
npm run runtimes:python      # once: downloads and checks CPython for WebAssembly
JUDGE_MONGODB_URI=... npm run start:judge
```

`npm run runtimes:python` downloads a pinned CPython 3.15 build, checks its
SHA-256, and writes it to `runtimes/python` (for the judge) and
`frontend/public/runtimes/python` (for Run in the browser). Both folders are
ignored by git. Without it, JavaScript and TypeScript still work, and Python
programs get "Python is not available on this judge".

| Setting | Default | Meaning |
|---|---|---|
| `JUDGE_MONGODB_URI` | required | The judge's own database login (below) |
| `JUDGE_WORKERS` | CPU cores − 1 | Programs run at the same time |
| `JUDGE_POLL_MS` | 500 | How often it looks for work when idle |
| `LOG_LEVEL` | info | |

The judge reads nothing else. Start it with only these variables, never with
the API's `.env`: the programs it runs are untrusted, and the less this process
holds, the less there is to take.

## Give it its own database user

In production the judge should not use the API's login. Create a user that
can read questions and read and update submissions, and nothing else:

```js
// mongosh, as an admin
use interviewhub
db.createRole({
  role: 'codeJudge',
  privileges: [
    { resource: { db: 'interviewhub', collection: 'contest_questions' }, actions: ['find'] },
    { resource: { db: 'interviewhub', collection: 'code_submissions' }, actions: ['find', 'update'] },
  ],
  roles: [],
})
db.createUser({ user: 'judge', pwd: passwordPrompt(), roles: ['codeJudge'] })
```

Then `JUDGE_MONGODB_URI=mongodb://judge:<password>@<host>/interviewhub?authSource=interviewhub`.

## How many to run

One judge with `JUDGE_WORKERS` threads is enough for most contests. More
judges can run against the same database: each job is claimed atomically, so
two judges never take the same one, and a job whose judge dies is picked up
again after 3 minutes. A job that fails 3 times is marked failed, logged, and
never counted against the entrant; their previous judged submission counts
instead.

## What it enforces

| Limit | Value |
|---|---|
| Time per test | Set per question, 1 to 5 seconds |
| Memory | 256 MB |
| Output | 64 KB |
| Code size | 64 KB |
| Submissions | 10 a minute per person, one waiting at a time |

Programs have no network, no files of ours, no environment variables and no
way to start processes. See the sandbox notes in the developer docs for how.
