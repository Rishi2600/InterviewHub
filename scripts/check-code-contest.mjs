// A code contest in real browsers: the host's editor, an entrant's Run and
// Submit (judged by the separate judge process), and the results after the
// API's finalize job. Needs the API, the frontend and a judge running, the
// seeded users (npm run db:seed) and the dev database in Docker.
// Run: npm run check:code-contest
import { chromium } from 'playwright-core'
import { execFileSync } from 'node:child_process'

const API = process.env.API_URL ?? 'http://localhost:3000'
const WEB = process.env.WEB_URL ?? 'http://localhost:5173'
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome'
const MONGO_URI = process.env.MONGODB_URI
const OUT = process.argv[2]
const PASSWORD = 'Seed@Pass123'
if (!MONGO_URI) throw new Error('MONGODB_URI is not set')

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
const mongo = (script) =>
  execFileSync('docker', ['exec', 'interviewhub-mongo', 'mongosh', '--quiet', MONGO_URI, '--eval', script]).toString()

const hana = await api('/auth/login', { method: 'POST', body: { email: 'hana@seed.interviewhub.dev', password: PASSWORD } })
const ada = await api('/auth/login', { method: 'POST', body: { email: 'ada@seed.interviewhub.dev', password: PASSWORD } })

const contest = await api('/contests', { method: 'POST', token: hana.accessToken, body: { title: 'Browser code check', format: 'code' } })
await api(`/contests/${contest._id}`, {
  method: 'PATCH',
  token: hana.accessToken,
  body: { description: 'Two small problems.', startAt: new Date(Date.now() + 60 * 60_000).toISOString(), durationMinutes: 30 },
})
const merge = {
  kind: 'code',
  title: 'Merge intervals',
  prompt: 'The first line has n. Each of the next n lines has a start and an end. Print the merged intervals, one per line.',
  points: 40,
  timeLimitMs: 2000,
  starterCode: { python: '', javascript: "const lines = require('fs').readFileSync(0, 'utf8').trim().split('\\n')\n", typescript: '' },
  tests: [
    { input: '4\n1 3\n2 6\n8 10\n15 18', output: '1 6\n8 10\n15 18', visible: true },
    { input: '2\n1 4\n4 5', output: '1 5', visible: true },
    { input: '1\n5 5', output: '5 5', visible: false },
    { input: '3\n1 2\n2 3\n3 4', output: '1 4', visible: false },
    { input: '3\n6 8\n1 9\n2 4', output: '1 9', visible: false },
    { input: '2\n1 2\n3 4', output: '1 2\n3 4', visible: false },
  ],
  hostAnswer: { language: 'javascript', code: '// host answer' },
  explanation: 'Sort, then extend the last interval while the next one starts at or before its end.',
}
const sum = {
  kind: 'code',
  title: 'Sum',
  prompt: 'Print the sum of the numbers on the first line.',
  points: 20,
  timeLimitMs: 2000,
  starterCode: { python: '', javascript: '', typescript: '' },
  tests: [
    { input: '1 2', output: '3', visible: true },
    { input: '2 3', output: '5', visible: false },
  ],
  hostAnswer: null,
  explanation: '',
}
await api(`/contests/${contest._id}/questions`, { method: 'PUT', token: hana.accessToken, body: { questions: [merge, sum] } })
mongo(`db.host_usage.deleteMany({ hostId: ObjectId("${hana.user.id}") })`)
await api(`/contests/${contest._id}/publish`, { method: 'POST', token: hana.accessToken })
await api(`/contests/${contest._id}/join`, { method: 'POST', token: ada.accessToken })
// Live now: started a minute ago.
mongo(`db.contests.updateOne({ _id: ObjectId("${contest._id}") }, { $set: { startAt: new Date(Date.now() - 60000), endAt: new Date(Date.now() + 29 * 60000) } })`)
console.log('contest', contest._id)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
async function signIn(email) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 950 } })).newPage()
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('401')) console.log(`[${email}] ${m.text()}`)
  })
  await page.goto(`${WEB}/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(`${WEB}/`)
  return page
}

// The host's editor, with the first question open.
const host = await signIn('hana@seed.interviewhub.dev')
await host.goto(`${WEB}/contests/${contest._id}/edit`)
await host.getByText('Merge intervals').first().waitFor()
await host.waitForTimeout(1500)
if (OUT) await host.screenshot({ path: `${OUT}/code-editor.png`, fullPage: true })

// The entrant: Run with a bug, then Submit.
const entrant = await signIn('ada@seed.interviewhub.dev')
await entrant.goto(`${WEB}/contests/${contest._id}/play`)
await entrant.getByRole('tab', { name: /Merge intervals/ }).waitFor()
await entrant.getByRole('button', { name: /Python/ }).click()
await entrant.getByRole('menuitemradio', { name: 'JavaScript' }).click()
// Replace the editor's text: the bug (< instead of <=) fails touching intervals.
const BUGGY = [
  "const [n, ...rest] = require('fs').readFileSync(0, 'utf8').trim().split('\\n')",
  "const pairs = rest.slice(0, Number(n)).map((l) => l.split(' ').map(Number)).sort((a, b) => a[0] - b[0])",
  'const out = [pairs[0]]',
  'for (const [s, e] of pairs.slice(1)) {',
  '  const last = out[out.length - 1]',
  '  if (s < last[1]) last[1] = Math.max(last[1], e)',
  '  else out.push([s, e])',
  '}',
  "console.log(out.map((p) => p.join(' ')).join('\\n'))",
].join('\n')
const editor = entrant.locator('.cm-content').first()
await editor.click()
await entrant.keyboard.press('ControlOrMeta+a')
await entrant.keyboard.press('Delete')
await entrant.keyboard.insertText(BUGGY)
await entrant.getByRole('button', { name: /^Run/ }).click()
await entrant.getByText(/of 2 passed/).waitFor({ timeout: 30000 })
console.log('run:', await entrant.getByText(/of 2 passed/).innerText())
if (OUT) await entrant.screenshot({ path: `${OUT}/code-run.png` })

await entrant.getByRole('button', { name: 'Submit' }).click()
await entrant.getByText(/hidden tests passed/).first().waitFor({ timeout: 30000 })
console.log('judged:', await entrant.getByText(/hidden tests passed/).first().innerText())
await entrant.waitForTimeout(800)
if (OUT) await entrant.screenshot({ path: `${OUT}/code-judged.png` })

// End the contest; the API's minute job finalizes it.
mongo(`db.contests.updateOne({ _id: ObjectId("${contest._id}") }, { $set: { startAt: new Date(Date.now() - 31 * 60000), endAt: new Date(Date.now() - 60000) } })`)
for (let i = 0; i < 24; i++) {
  const done = mongo(`print(!!db.contests.findOne({ _id: ObjectId("${contest._id}") }).finalizedAt)`).trim()
  if (done === 'true') break
  await new Promise((r) => setTimeout(r, 5000))
}
await entrant.goto(`${WEB}/contests/${contest._id}/results`)
await entrant.getByText('Your questions').waitFor({ timeout: 15000 })
await entrant.waitForTimeout(800)
if (OUT) await entrant.screenshot({ path: `${OUT}/code-results.png`, fullPage: true })
console.log('results shown')
await browser.close()
