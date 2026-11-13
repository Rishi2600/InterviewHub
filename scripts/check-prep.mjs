// Interview prep in a real browser, against the real AI (Groq's free tier, on
// prep's own model): the prep page, a drill (its questions written by the AI
// if the bank has none left), the results, the recommendations, then a short
// coach session and its recap. Needs the API (with GROQ_API_KEY_PREP or
// GROQ_API_KEY set) and the frontend running. Uses about 6 AI requests.
// Run: npm run check:prep [screenshot folder]
import { chromium } from 'playwright-core'

const API = process.env.API_URL ?? 'http://localhost:3000'
const WEB = process.env.WEB_URL ?? 'http://localhost:5173'
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome'
const OUT = process.argv[2]
const PASSWORD = 'Quiet-river9'
const AI_WAIT = 90_000

async function api(path, { token, body, method = 'GET' } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${JSON.stringify(json)}`)
  return json.data
}
const shot = async (page, name) => OUT && page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true })
const check = (ok, what) => {
  if (!ok) throw new Error(`Check failed: ${what}`)
  console.log(`ok: ${what}`)
}

// A fresh candidate each run, so the daily limits never get in the way.
const stamp = Date.now().toString(36)
const email = `prep-${stamp}@check.interviewhub.dev`
await api('/auth/register', { method: 'POST', body: { username: `prep_${stamp}`, email, password: PASSWORD, role: 'candidate' } })

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('401')) console.log(`[browser] ${m.text()}`)
})
await page.goto(`${WEB}/login`)
await page.getByLabel('Email').fill(email)
await page.getByLabel('Password').fill(PASSWORD)
await page.getByRole('button', { name: 'Sign in' }).click()
await page.waitForURL(`${WEB}/`)

// The prep page, as a new candidate.
await page.getByRole('link', { name: 'Prep' }).first().click()
await page.getByText('Prepare for anything').waitFor()
await page.getByText('Nothing to suggest yet').waitFor()
await shot(page, 'prep-new')

// A drill on SQL at junior level (the default sentence).
const started = Date.now()
await page.getByRole('button', { name: 'Start drill' }).click()
await page.waitForURL(/\/prep\/drills\/[0-9a-f]{24}$/, { timeout: AI_WAIT })
console.log(`drill ready in ${((Date.now() - started) / 1000).toFixed(1)} s`)
await page.getByText('Question 1', { exact: true }).waitFor()
await shot(page, 'prep-drill-question')

// Answer every question with the first option, reading each explanation.
for (let n = 1; ; n++) {
  await page.keyboard.press('1')
  const explanation = page.locator('text=/^(Right|Not quite)/').first()
  await explanation.waitFor()
  if (n === 1) await shot(page, 'prep-drill-answered')
  const next = page.getByRole('button', { name: /^(Next question|See results)/ })
  const label = await next.innerText()
  await next.click()
  if (label.startsWith('See results')) break
}
await page.getByText(/drill done$/).waitFor()
const score = await page.locator('.font-heading.text-6xl').innerText()
console.log('drill score:', score.replace(/\s+/g, ''))
await shot(page, 'prep-drill-results')
const rows = await page.locator('details').count()
check(rows === 10, `the results list 10 answers (got ${rows})`)

// The recommendations now know about SQL.
await page.goto(`${WEB}/prep`)
await page.getByText('Recommended for you').waitFor()
await page.getByText('All your topics').click()
await shot(page, 'prep-after-drill')

// A short coach session: switch the sentence to Coach and start.
await page.getByRole('button', { name: /^Drill/ }).first().click()
await page.getByRole('menuitemradio', { name: /^Coach/ }).click()
await page.getByRole('button', { name: 'Start coaching' }).click()
await page.waitForURL(/\/practice\/[0-9a-f]{24}$/)
const answerBox = page.getByLabel('Your answer')
const ready = () =>
  page.waitForFunction(
    () => document.querySelector('textarea[aria-label="Your answer"]')?.placeholder.startsWith('Your answer'),
    null,
    { timeout: AI_WAIT },
  )
// The coach's latest chat bubble.
const latestAi = () => page.locator('.rounded-tl-md').last().innerText()
async function say(text) {
  await answerBox.fill(text)
  await answerBox.press('Enter')
  await page.waitForTimeout(500)
  await ready()
}
await page.locator('.rounded-tl-md').first().or(page.getByText("The coach couldn't start")).waitFor({ timeout: AI_WAIT })
check(!(await page.getByText("The coach couldn't start").isVisible()), 'the coach greets you')
await ready()
console.log('coach greeting:', await latestAi())
await shot(page, 'prep-coach')
await say('I know SELECT, WHERE and simple joins, but GROUP BY and HAVING confuse me.')
console.log('coach reply:', await latestAi())
await say("HAVING filters after grouping, I think? That helps, thanks. Let's stop here.")
console.log('coach reply:', await latestAi())

// End it, unless the coach already did, and read the recap.
const done = page.getByText("That's the session done")
const ended = await done.waitFor({ timeout: 5_000 }).then(() => true, () => false)
console.log('coach ended the session itself:', ended)
if (!ended) {
  await page.getByRole('button', { name: 'End session' }).first().click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'End session' }).click()
}
await page.getByText("That's the session done").waitFor({ timeout: AI_WAIT })
// A recap that meets the per-minute limit is retried by the every-minute job.
await page.getByRole('link', { name: 'View recap' }).waitFor({ timeout: 3 * 60_000 })
await page.getByRole('link', { name: 'View recap' }).click()
await page.getByText('What to review').waitFor()
await shot(page, 'prep-recap')

await page.goto(`${WEB}/prep`)
await page.getByText('Your drills and coach sessions').waitFor()
const sessions = await page.locator('a[href^="/prep/drills/"], a[href$="/feedback"]').count()
check(sessions >= 2, `the prep page lists the drill and the coach session (${sessions})`)
await shot(page, 'prep-home')
await browser.close()
console.log('prep check passed')
