import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { chromium } from 'playwright-core'

const baseUrl = process.env.QA_URL || 'http://127.0.0.1:5173'
const executablePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const outputDir = 'artifacts/auth'
const errors = []
const results = []
const requests = { login: 0, reset: 0 }
const email = 'qa@financemy.test'
const uid = 'financemy-auth-qa'
const mobileOptions = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Jakarta' }

function token() {
  const now = Math.floor(Date.now() / 1000)
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    sub: uid, user_id: uid, email, email_verified: true, iat: now, exp: now + 3600, auth_time: now,
    firebase: { sign_in_provider: 'password', identities: { email: [email] } },
  })}.qa`
}

// Exercise the real Firebase SDK and browser storage without using a real account.
async function mockFirebase(context) {
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)))
  await context.route('https://identitytoolkit.googleapis.com/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let response
    if (path.endsWith('accounts:signInWithPassword')) {
      requests.login++
      response = { localId: uid, email, displayName: 'Auth QA', registered: true, idToken: token(), refreshToken: 'qa-refresh-token', expiresIn: '3600' }
    } else if (path.endsWith('accounts:lookup')) {
      response = { users: [{ localId: uid, email, displayName: 'Auth QA', emailVerified: true, passwordUpdatedAt: Date.now() - 86400000, providerUserInfo: [{ providerId: 'password', email, federatedId: email }] }] }
    } else if (path.endsWith('accounts:sendOobCode')) {
      requests.reset++
      response = { email }
    } else {
      throw new Error(`Unexpected Firebase Auth request: ${path}`)
    }
    await route.fulfill({ json: response })
  })
  await context.route('https://securetoken.googleapis.com/**', (route) => route.fulfill({ json: {
    access_token: token(), id_token: token(), refresh_token: 'qa-refresh-token', expires_in: '3600', token_type: 'Bearer', user_id: uid,
  } }))
  await context.route('https://firestore.googleapis.com/**', (route) => route.fulfill({
    status: 403, json: { error: { code: 403, status: 'PERMISSION_DENIED', message: 'Production data is blocked during auth QA.' } },
  }))
}

async function visit(page, path) {
  await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' })
}

async function loginVisible(page) {
  await page.getByRole('heading', { name: 'Masuk ke akunmu', exact: true }).waitFor()
}

async function dashboardVisible(page) {
  await page.waitForURL('**/dashboard')
  await page.getByRole('navigation', { name: 'Navigasi mobile' }).waitFor()
}

async function audit(page, name) {
  await page.evaluate(() => document.fonts.ready)
  const layout = await page.evaluate(() => {
    const hero = document.querySelector('.auth-reference-visual')
    const input = document.querySelector('.reference-input input')
    const submit = document.querySelector('.reference-submit').getBoundingClientRect()
    const controls = [...document.querySelectorAll('.reference-input, .reference-submit, .reference-demo')]
    return {
      width: innerWidth,
      overflow: document.documentElement.scrollWidth > innerWidth,
      heroVisible: Boolean(hero?.getClientRects().length),
      inputFontSize: Number.parseFloat(getComputedStyle(input).fontSize),
      submitBottom: submit.bottom,
      controlsFit: controls.every((element) => {
        const box = element.getBoundingClientRect()
        return box.left >= 0 && box.right <= innerWidth && box.height >= 44
      }),
    }
  })
  assert.equal(layout.overflow, false, `${name}: horizontal overflow`)
  assert.equal(layout.heroVisible, true, `${name}: missing branded header`)
  assert.equal(layout.controlsFit, true, `${name}: controls are clipped or too small`)
  if (layout.width <= 850) assert.ok(layout.inputFontSize >= 16, `${name}: input may trigger mobile zoom`)
  results.push({ name, ...layout })
}

await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ executablePath, headless: true })
let profile
const profileDirs = []

try {
  const context = await browser.newContext(mobileOptions)
  await mockFirebase(context)
  const page = await context.newPage()
  for (const width of [320, 360, 390, 430, 768, 850, 851, 1440]) {
    await page.setViewportSize({ width, height: width > 850 ? 1000 : 844 })
    await visit(page, '/login')
    await loginVisible(page)
    await audit(page, `login-${width}`)
    if ([390, 768, 1440].includes(width)) await page.screenshot({ path: `${outputDir}/login-${width}.png`, fullPage: true })
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => localStorage.setItem('financemy-theme', 'dark'))
  await page.reload()
  await loginVisible(page)
  await audit(page, 'login-dark')
  await page.screenshot({ path: `${outputDir}/login-dark.png`, fullPage: true })
  await page.evaluate(() => localStorage.setItem('financemy-theme', 'light'))
  await page.reload()
  await loginVisible(page)

  await page.getByRole('button', { name: 'Masuk ke FinanceMy' }).click()
  await page.getByText('Email wajib diisi.', { exact: true }).waitFor()
  await page.getByText('Password wajib diisi.', { exact: true }).waitFor()
  await page.getByPlaceholder('Minimal 8 karakter').fill('qa-password-only')
  await page.getByRole('button', { name: 'Tampilkan password', exact: true }).click()
  assert.equal(await page.getByPlaceholder('Minimal 8 karakter').getAttribute('type'), 'text')
  await page.getByRole('button', { name: 'Sembunyikan password', exact: true }).click()
  assert.equal(await page.getByPlaceholder('Minimal 8 karakter').getAttribute('type'), 'password')

  await page.setViewportSize({ width: 390, height: 500 })
  await page.getByRole('button', { name: 'Masuk ke FinanceMy' }).scrollIntoViewIfNeeded()
  const submit = await page.locator('.reference-submit').boundingBox()
  assert.ok(submit.y >= 0 && submit.y + submit.height <= 500, 'Submit cannot be reached with a short viewport')
  await page.setViewportSize({ width: 390, height: 844 })

  await page.getByRole('link', { name: 'Lupa password?' }).click()
  await page.getByRole('heading', { name: 'Atur ulang password', exact: true }).waitFor()
  await audit(page, 'forgot-password')
  await page.screenshot({ path: `${outputDir}/forgot-password.png`, fullPage: true })
  await page.getByPlaceholder('Masukkan alamat email').fill(email)
  await page.getByRole('button', { name: 'Kirim tautan reset' }).click()
  await page.getByRole('status').filter({ hasText: 'Tautan reset password sudah dikirim.' }).waitFor()
  assert.equal(requests.reset, 1)
  await page.getByRole('link', { name: 'Kembali ke login', exact: true }).click()
  await loginVisible(page)

  await page.getByRole('button', { name: 'Lihat dashboard demo', exact: true }).click()
  await dashboardVisible(page)
  await visit(page, '/login')
  await dashboardVisible(page)
  await page.getByRole('button', { name: 'Buka menu', exact: true }).click()
  await page.getByTitle('Keluar dari akun', { exact: true }).click()
  await loginVisible(page)
  await visit(page, '/')
  await page.locator('.marketing-page').waitFor()
  assert.equal(new URL(page.url()).pathname, '/', 'Public landing page must stay available')
  await context.close()
  results.push({ name: 'form-validation-password-toggle-reset-demo-public-landing', passed: true })

  for (const storage of ['IndexedDB', 'localStorage']) {
    const profileDir = await mkdtemp(join(tmpdir(), 'financemy-auth-qa-'))
    profileDirs.push(profileDir)
    const expectedLogins = requests.login + 1
    for (let run = 0; run < 3; run++) {
      profile = await chromium.launchPersistentContext(profileDir, { executablePath, headless: true, ...mobileOptions })
      if (storage === 'localStorage') {
        await profile.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: undefined }))
      }
      await mockFirebase(profile)
      const app = await profile.newPage()
      await app.addInitScript(() => {
        Object.defineProperty(navigator, 'standalone', { get: () => true })
        if (location.search === '?stale-demo') sessionStorage.setItem('financemy-demo', '1')
      })
      if (run === 0) {
        await visit(app, '/')
        await app.waitForURL('**/login')
        await loginVisible(app)
        await app.getByPlaceholder('Masukkan alamat email').fill(email)
        await app.getByPlaceholder('Minimal 8 karakter').fill('qa-password-only')
        await app.getByRole('button', { name: 'Masuk ke FinanceMy', exact: true }).click()
        await dashboardVisible(app)
        await app.reload()
        await dashboardVisible(app)
        assert.equal(requests.login, expectedLogins)
        results.push({ name: 'login-and-reload', storage, passed: true })
      } else if (run === 1) {
        await visit(app, '/login?stale-demo')
        await dashboardVisible(app)
        assert.equal(await app.evaluate(() => sessionStorage.getItem('financemy-demo')), null, 'Restored Firebase session should clear stale demo mode')
        await visit(app, '/')
        await dashboardVisible(app)
        assert.equal(requests.login, expectedLogins, 'Reopening the installed app must not require another login')
        await app.getByRole('button', { name: 'Buka menu', exact: true }).click()
        await app.getByTitle('Keluar dari akun', { exact: true }).click()
        await loginVisible(app)
        results.push({ name: 'cold-restart-login-shortcut-installed-home-and-logout', storage, passed: true })
      } else {
        await visit(app, '/dashboard')
        await app.waitForURL('**/login')
        await loginVisible(app)
        results.push({ name: 'logout-remains-signed-out-after-cold-restart', storage, passed: true })
      }
      await profile.close()
      profile = undefined
    }
  }

  assert.deepEqual(errors, [], 'Browser runtime errors')
  console.log(JSON.stringify({ results, mockedAuthRequests: requests, runtimeErrors: errors }, null, 2))
} finally {
  await browser.close()
  if (profile) await profile.close()
  // Only remove the disposable profile created by this script inside the OS temp directory.
  for (const profileDir of profileDirs) {
    if (resolve(profileDir).startsWith(`${resolve(tmpdir())}${sep}financemy-auth-qa-`)) {
      await rm(profileDir, { recursive: true, force: true })
    }
  }
}
