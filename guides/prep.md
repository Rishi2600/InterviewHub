# Running interview prep

Candidates prepare on the **Prep** page, for any topic, in two ways:

- **Drills**: 10 multiple-choice questions on one topic and level, each
  checked the moment it's answered, with the reason. Questions come from a
  shared question bank that the AI fills; most drills need no AI at all.
- **Coach**: an AI tutor that asks, hints when the candidate is stuck,
  explains, and ends with a written recap. A coach session runs on the same
  screen as an AI practice interview. Candidates can also type a topic of
  their own here.

Below that, **Recommended for you** points at weak spots worked out from the
candidate's practice interviews, coach recaps, drills and interviewer reviews
of the last 90 days. Prep is private to the candidate, doesn't change their
candidate score, and each finished drill or coach session adds a square to
their activity graph.

## Get a key

Prep uses Groq's free tier, like AI practice (see `guides/ai-practice.md`
for signing up and turning on Zero Data Retention). Set `GROQ_API_KEY_PREP`
for a key of its own, or leave it empty to use `GROQ_API_KEY`.

A second key from the **same Groq organisation shares its limits**: Groq
counts per organisation and per model. Prep is kept apart from practice by
its **model** instead: `qwen/qwen3.8-27b`, which practice never uses.

Without any key, drills still work from the questions already in the bank;
new questions can't be written and the coach is off.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `GROQ_API_KEY_PREP` | empty (uses `GROQ_API_KEY`) | Prep's Groq key |
| `AI_PREP_MODELS` | `qwen/qwen3.8-27b` | Prep's model. Keep it off practice's list (`AI_MODELS`), or the two share a quota |
| `AI_PREP_DAILY_REQUESTS` | 900 | Prep's daily request budget |
| `AI_PREP_DAILY_TOKENS` | 180000 | Prep's daily token budget |
| `AI_PREP_TOKENS_PER_COACH` | 50000 | Set aside when a coach session starts; the unused rest is given back |
| `AI_PREP_MAX_RUNNING` | 2 | Coach sessions running at once |

Limits per candidate, per UTC day: 2 coach sessions (each up to 20 minutes
or 20 answers) and 10 drills. A coach session ended before any answer gives
its slot back.

## How much it can take

The prep model gets 1,000 requests a day and 8,000 tokens a minute on the
free tier (checked 2026-11-13). Measured with `check:prep`: a short coach
session uses about 4,000 to 5,000 tokens, a full one up to about 30,000;
writing a batch of 10 drill questions about 5,000. So prep carries roughly
**6 full coach sessions a day**, plus new questions, with **2 at once**.

The question bank is what keeps drills cheap: the AI writes a batch only
when a candidate has seen every question on their topic and level, and the
batch is saved for everyone after them. A drill that needs a new batch takes about 5 to 10 seconds
to start; one served from the bank starts at once.

Prep has one model, so when it hits its per-minute limit it waits (up to 30
seconds) instead of switching. A recap that still meets the limit is retried
by the every-minute job.

Admins can see today's prep use against its budget:

```sh
curl -H "Authorization: Bearer <admin token>" http://localhost:3000/prep/usage
```

## What is kept, and where data goes

- **Drill questions** are written from a topic and a level only, never from
  anything a candidate typed, and are shared by everyone. A question that two
  candidates flag as wrong is hidden.
- **Drill answers** are kept with the drill: which option, right or wrong.
- **The coach chat** is deleted once its recap is written, as with AI
  practice. **The recap** is kept until the candidate deletes it.
- **Interviewer reviews** (written by interviewers after a live interview)
  are seen only by that candidate and the reviewer. Prep reads them for the
  recommendations.
- **The AI provider** gets the conversation and the topic, never names,
  emails or profile data.

## Checking it

```sh
npm run test:e2e -- prep          # drills, coach, recommendations: fake AI, free
npm run check:prep                # in a real browser: about 6 AI requests
npm run eval:practice -- --coach  # the coach's three scripted learners (below)
```

`check:prep` needs the API (with a key) and the frontend running. It signs up
a new candidate, takes a drill (the AI writes its questions if the bank has
none left), reads the results and the recommendations, then runs a short
coach session and reads its recap.

The test set (`eval:practice`, see `guides/ai-practice.md`) includes three
learners for the coach: an eager one with a common mistake, one who only asks
to be told the answer, and one who tries to derail the tutor. A grader model
checks that the coach stays in role, hints before it explains, does explain
when the learner is stuck, stays patient, and writes a fair recap.

## When something goes wrong

| What you see | Why, and what to do |
|---|---|
| "The coach isn't set up on this server" | No key. Set `GROQ_API_KEY_PREP` or `GROQ_API_KEY` and restart the API |
| "No new questions right now" | The candidate has seen every saved question on that topic and level, and a new batch couldn't be written (no key, the day's budget, or the model at its limit) |
| "Coach sessions are full right now" | `AI_PREP_MAX_RUNNING` sessions are running. Wait a few minutes |
| "Today's coach sessions are used up" | Prep's daily budget is set aside. It resets at 00:00 UTC |
| "The coach couldn't start just now" | The model stayed at its per-minute limit for over 30 seconds. "Try again" works a minute later |
| `qwen/qwen3.8-27b: at its limit for N s` in the log | The per-minute limit; the client waits it out. Frequent ones mean too many sessions at once |
| Recap stays "being written" | Retried with growing waits for a day; the API log names the reason |
