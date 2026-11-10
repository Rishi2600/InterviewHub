// A two-person interview in real browsers: an interviewer and a candidate
// with fake cameras join a call, the candidate shares their screen and runs
// code, and ending the room ends the call. Needs the API and the frontend
// running, and the seeded users (npm run db:seed). Run: npm run check:call
// Screenshots go to the folder given as the first argument, if any.
import { chromium } from 'playwright-core'

const API = process.env.API_URL ?? 'http://localhost:3000'
const WEB = process.env.WEB_URL ?? 'http://localhost:5173'
const CHROME = process.env.CHROME_PATH ?? '/usr/bin/google-chrome'
const OUT = process.argv[2]
const PASSWORD = 'Seed@Pass123'

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

const hana = await api('/auth/login', { method: 'POST', body: { email: 'hana@seed.interviewhub.dev', password: PASSWORD } })
const ada = await api('/auth/login', { method: 'POST', body: { email: 'ada@seed.interviewhub.dev', password: PASSWORD } })
const room = await api('/rooms', { method: 'POST', token: hana.accessToken, body: { title: 'Browser call check' } })
await api(`/rooms/${room.code}/join`, { method: 'POST', token: ada.accessToken })
await api(`/rooms/${room._id}/state`, { method: 'PATCH', token: hana.accessToken, body: { state: 'active' } })
console.log('room', room._id, room.code)

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--auto-accept-this-tab-capture',
    '--auto-select-desktop-capture-source=Entire screen',
  ],
})

async function open(email, name) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['camera', 'microphone'] })
  const page = await context.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') console.log(`[${name}] ${m.type()}: ${m.text()}`)
  })
  await page.goto(`${WEB}/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL(`${WEB}/`)
  await page.goto(`${WEB}/rooms/${room._id}`)
  await page.getByRole('button', { name: 'Join call' }).waitFor()
  return page
}

const interviewer = await open('hana@seed.interviewhub.dev', 'hana')
const candidate = await open('ada@seed.interviewhub.dev', 'ada')

await interviewer.getByRole('button', { name: 'Join call' }).click()
await candidate.getByRole('button', { name: 'Join call' }).click()
await interviewer.getByText('Ada Okafor', { exact: true }).first().waitFor({ timeout: 15000 })
// Wait for the connection, then for the remote video to play.
await interviewer.waitForFunction(() => [...document.querySelectorAll('video')].some((v) => !v.muted && v.readyState >= 2), null, { timeout: 20000 })
console.log('call connected: interviewer plays the candidate camera')

// Candidate shares their screen.
await candidate.getByRole('button', { name: 'Share screen' }).first().click()
await interviewer.getByText("Ada Okafor's screen").waitFor({ timeout: 15000 })
console.log('screen share reached the interviewer')

// Run JavaScript in the candidate's editor.
await candidate.getByRole('button', { name: /Python/ }).click()
await candidate.getByRole('menuitemradio', { name: 'JavaScript' }).click()
await candidate.getByPlaceholder('What the program reads from stdin').fill('hello from stdin')
await candidate.getByRole('button', { name: /^Run/ }).click()
await candidate.getByText('Finished').waitFor({ timeout: 20000 })
console.log('run output:', JSON.stringify(await candidate.locator('pre').last().innerText()))

// Mute: the interviewer should see the candidate muted.
await candidate.getByRole('button', { name: 'Mute' }).click()
await interviewer.getByLabel('Muted').first().waitFor({ timeout: 10000 })
console.log('mute reached the interviewer')

await interviewer.waitForTimeout(1500)
if (OUT) {
  await interviewer.screenshot({ path: `${OUT}/room-interviewer.png` })
  await candidate.screenshot({ path: `${OUT}/room-candidate.png` })
}

// End the room: the candidate's call ends.
await interviewer.getByRole('button', { name: 'End room' }).first().click()
await interviewer.getByRole('alertdialog').getByRole('button', { name: 'End room' }).click()
await candidate.getByText('The room has ended, and so has its call.').waitFor({ timeout: 10000 })
console.log('ending the room ended the candidate call')
await browser.close()
