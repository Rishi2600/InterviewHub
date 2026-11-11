// An AI practice interview in a real browser, against the real AI (Groq's
// free tier): the setup sentence, the greeting, answers, the coding question
// with a Run, ending, and the feedback report. Needs the API (with
// GROQ_API_KEY set) and the frontend running. Uses about 6 AI requests.
// Run: npm run check:practice [screenshot folder]
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

// A fresh candidate each run, so the monthly limit never gets in the way.
const stamp = Date.now().toString(36)
const email = `practice-${stamp}@check.interviewhub.dev`
await api('/auth/register', { method: 'POST', body: { username: `practice_${stamp}`, email, password: PASSWORD, role: 'candidate' } })

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 950 } })).newPage()
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('401')) console.log(`[browser] ${m.text()}`)
})
await page.goto(`${WEB}/login`)
await page.getByLabel('Email').fill(email)
await page.getByLabel('Password').fill(PASSWORD)
await page.getByRole('button', { name: 'Sign in' }).click()
await page.waitForURL(`${WEB}/`)

// The setup: a 15-minute technical Python interview with a coding question.
await page.getByRole('link', { name: 'AI practice' }).first().click()
await page.getByText('New practice interview').waitFor()
await page.getByRole('button', { name: /30 minutes/ }).click()
await page.getByRole('menuitemradio', { name: '15 minutes' }).click()
await shot(page, 'practice-setup')
await page.getByRole('button', { name: 'Start 15-minute interview' }).click()
await page.waitForURL(/\/practice\/[0-9a-f]{24}$/)
console.log('interview', page.url())

const answerBox = page.getByLabel('Your answer')
/** Waits until the interviewer has finished writing. */
const ready = () =>
  page.waitForFunction(
    () => document.querySelector('textarea[aria-label="Your answer"]')?.placeholder.startsWith('Your answer'),
    null,
    { timeout: AI_WAIT },
  )
async function say(text) {
  await answerBox.fill(text)
  await answerBox.press('Enter')
  await page.waitForTimeout(500)
  await ready()
}
const latestAi = () => page.locator('text=AI interviewer').last().locator('xpath=../..').innerText()

await ready()
console.log('greeting:', (await latestAi()).split('\n').slice(-1)[0])
await shot(page, 'practice-greeting')

await say('A list can change after it is made and a tuple cannot. I use tuples for fixed records, and they can be dictionary keys.')
console.log('reply:', (await latestAi()).split('\n').slice(-1)[0])

await say("I think we've covered that well. I'm ready for the coding question now.")
const question = page.getByRole('tab', { name: 'Question' })
const posed = await question.waitFor({ timeout: 5_000 }).then(() => true, () => false)
console.log('coding question posed:', posed)
if (posed) {
  await page.getByRole('button', { name: /^Run/ }).click()
  await page.getByText('You ran your code').waitFor({ timeout: 30_000 })
  await shot(page, 'practice-coding')
  await question.click()
  await shot(page, 'practice-question')
  await page.getByRole('tab', { name: 'Conversation' }).click()
}

// End, wait for the feedback, read it.
await page.getByRole('button', { name: /End interview|^End$/ }).click()
await page.getByRole('alertdialog').getByRole('button', { name: 'End interview' }).click()
await page.getByText("That's the interview done").waitFor()
await shot(page, 'practice-ending')
await page.getByRole('link', { name: 'View feedback' }).waitFor({ timeout: AI_WAIT })
await page.getByRole('link', { name: 'View feedback' }).click()
await page.getByText('What went well').waitFor()
const score = await page.locator('.font-heading.text-5xl').innerText()
console.log('feedback score:', score)
await shot(page, 'practice-feedback')

await page.goto(`${WEB}/practice`)
await page.getByText('Past interviews').waitFor()
await shot(page, 'practice-home')
await browser.close()
console.log('practice check passed')
