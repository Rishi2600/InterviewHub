# Running AI practice interviews

Candidates can practise with an AI interviewer, by chat or voice, and get
written feedback with a score from 1 to 5 for each area. It's private to the
candidate and doesn't change their candidate score; each finished interview
adds a square to their activity graph.

The AI runs on Groq's free tier. Without a key the feature is switched off:
the page says "AI practice isn't set up on this server", and nothing else in
the app changes.

## Get a key

1. Sign up at [console.groq.com](https://console.groq.com). No card is needed.
2. Under **Settings → Data Controls**, turn on **Zero Data Retention**, so
   Groq keeps no prompts or replies.
3. Under **API Keys**, create a key. It is shown once.
4. Put it in the API's `.env` as `GROQ_API_KEY=...` and restart the API.

Leave billing off. The limits below are the free tier's, and the app keeps
itself under them.

## Settings

| Setting | Default | Meaning |
|---|---|---|
| `GROQ_API_KEY` | empty (off) | The Groq key |
| `AI_MODELS` | `openai/gpt-oss-120b,openai/gpt-oss-20b` | Tried in order; when one hits its limit, the next takes over |
| `AI_DAILY_REQUESTS` | 1800 | The app's daily request budget, across all models |
| `AI_DAILY_TOKENS` | 360000 | The app's daily token budget, across all models |
| `AI_TOKENS_PER_INTERVIEW` | 100000 | Set aside when an interview starts; the unused rest is given back |
| `AI_MAX_RUNNING` | 3 | Interviews running at once |

## How much it can take

Groq's free tier gives each model 1,000 requests and 200,000 tokens a day,
and 8,000 tokens a minute. It doesn't cache prompts, so every request counts
in full. A typical interview of about 20 answers uses 40,000 to 50,000
tokens, so the two default models carry about **8 to 10 interviews a day**,
with up to **3 at once**.

An interview starts only if a full-length one still fits in the day's budget
and fewer than `AI_MAX_RUNNING` are running, so a started interview is never
cut off for lack of quota. Otherwise the candidate sees "AI interviews are
full right now" (a few minutes) or "Today's AI interviews are used up"
(tomorrow, UTC). Each candidate also gets 3 interviews a calendar month;
one ended before any answer doesn't count.

Admins can see today's use against the budget:

```sh
curl -H "Authorization: Bearer <admin token>" http://localhost:3000/practice/usage
```

## What is kept, and where data goes

- **The chat** is kept only while the interview runs and its feedback is
  written, then deleted. If the feedback can't be written, it's retried for
  a day, then the chat is deleted anyway.
- **The feedback** is kept until the candidate deletes it. Interviewers and
  admins can't see it.
- **The AI provider** gets the conversation, never names, emails or profile
  data. With Zero Data Retention on, Groq doesn't keep it.
- **Voice** uses the browser's own speech. Listening works in Chrome, Edge
  and Safari; in Chrome the audio goes to Google to be turned into text.
  Speaking is done on the device. Typing always works.

## Checking it

```sh
npm run test:e2e -- practice     # end-to-end, with a fake AI: free, no key
npm run check:practice           # a real interview in a browser: ~6 AI requests
npm run eval:practice            # the test set: ~160 AI requests (below)
```

`check:practice` needs the API (with a key) and the frontend running. It
signs up a new candidate, runs a short interview with typed and spoken
answers and a coding question, ends it, and reads the feedback.

`eval:practice` is the test set: six scripted candidates (strong, weak,
silent, rude, one trying to get the answers or the AI's instructions, and
one coding), each played by a second model and interviewed through the real
API. It checks every reply (length, one question, no copied notes, no leaked
instructions) and the score against how the candidate was scripted; a third
model grades staying in role, giving no answers, relevant follow-ups,
politeness and fair feedback. It passes when every safety check passes and
at least 80% of the rest do. It also runs three learners for the prep
coach (see `guides/prep.md`). It uses most of a day's quota, and the grader
uses prep's model, so run it when the instructions or models change.
`--only strong,coder` runs some of them, `--coach` only the coach's; a path
ending in `.json` saves the full report.

## When something goes wrong

| What you see | Why, and what to do |
|---|---|
| "AI practice isn't set up on this server" | `GROQ_API_KEY` is empty. Add it and restart the API |
| "AI interviews are full right now" | `AI_MAX_RUNNING` interviews are running. Wait, or raise it if Groq's per-minute limit allows |
| "Today's AI interviews are used up" | The daily budget is set aside. It resets at 00:00 UTC |
| "The interviewer couldn't reply just now" | Every model was at its per-minute limit for more than a few seconds. The answer goes back in the box to send again |
| Feedback stays "being written" | Groq refused the feedback request; it's retried with growing waits for a day. The API log names the reason |
| `The AI refused the request (401)` in the log | The key is wrong or revoked |
