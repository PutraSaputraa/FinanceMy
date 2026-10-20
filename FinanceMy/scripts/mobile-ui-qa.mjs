import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright-core'

const auditOnly = process.env.MOBILE_QA_AUDIT === '1'
const capture = process.env.MOBILE_QA_CAPTURE === '1'
const outputDir = auditOnly ? join(tmpdir(), 'financemy-mobile-before') : 'artifacts/mobile'
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Jakarta' })
const errors = []
const results = []
page.on('pageerror', (error) => errors.push(error.message))
const routes = [
  ['/dashboard', /Selamat (pagi|siang|sore|malam)/], ['/transaksi', 'Transaksi'], ['/akun', 'Semua akun'],
  ['/budget', 'Budget'], ['/rutin', 'Transaksi rutin'], ['/target', 'Target keuangan'],
  ['/utang', 'Utang & Piutang'], ['/laporan', 'Laporan keuangan'], ['/pengaturan', 'Pengaturan'],
]

async function go(path, heading) {
  if (page.viewportSize().width <= 820) await page.getByRole('button', { name: 'Buka menu', exact: true }).click()
  await page.locator(`.side-nav a[href="${path}"]`).click()
  await page.waitForURL(`**${path}`)
  await page.getByRole('heading', { name: heading, level: 1 }).waitFor()
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  await page.evaluate(() => document.fonts.ready)
}

async function audit(name) {
  // Wait for the responsive charts to finish handling the viewport change.
  await page.waitForFunction(() => [...document.querySelectorAll('.recharts-responsive-container')].every((container) => {
    const surface = container.querySelector('.recharts-surface')
    return !surface || surface.getBoundingClientRect().width <= container.getBoundingClientRect().width + 1
  }))
  const result = await page.evaluate(() => {
    const root = document.querySelector('[role="dialog"]') || document.querySelector('.page-content') || document.body
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const moneyIssues = []
    let node
    while ((node = walker.nextNode())) {
      if (!node.parentElement.getClientRects().length || getComputedStyle(node.parentElement).visibility === 'hidden') continue
      for (const match of node.textContent.matchAll(/[+−-]?Rp[\s\u00a0]*-?[\d.,]+/gu)) {
        const range = document.createRange()
        range.setStart(node, match.index)
        range.setEnd(node, match.index + match[0].length)
        const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
        const lines = new Set(rects.map((rect) => Math.round(rect.top)))
        let clipped = false
        let parent = node.parentElement
        while (parent && parent !== root.parentElement) {
          const style = getComputedStyle(parent)
          if (['hidden', 'clip'].includes(style.overflowX)) {
            const box = parent.getBoundingClientRect()
            if (rects.some((rect) => rect.right > box.right + 1 || rect.left < box.left - 1)) clipped = true
          }
          parent = parent.parentElement
        }
        if (lines.size > 1 || clipped) moneyIssues.push({ text: match[0], class: node.parentElement.className, lines: lines.size, clipped })
      }
    }
    const overflowing = [...root.querySelectorAll('*')].filter((element) => {
      const rect = element.getBoundingClientRect()
      if (!rect.width || rect.right <= window.innerWidth + 1) return false
      let parent = element.parentElement
      while (parent && parent !== root) {
        if (['auto', 'scroll', 'hidden', 'clip'].includes(getComputedStyle(parent).overflowX)) return false
        parent = parent.parentElement
      }
      return true
    }).slice(0, 6).map((element) => ({ tag: element.tagName, class: element.getAttribute('class') }))
    return { width: window.innerWidth, documentWidth: document.documentElement.scrollWidth, moneyIssues, overflowing }
  })
  results.push({ name, ...result })
  if (capture && page.viewportSize().width === 390) {
    await page.screenshot({ path: join(outputDir, `${name}.png`), fullPage: true, animations: 'disabled' })
    if (['transaksi', 'dashboard', 'laporan'].includes(name)) await page.screenshot({ path: join(outputDir, `${name}-top.png`), animations: 'disabled' })
  }
  if (!auditOnly) {
    assert.ok(result.documentWidth <= result.width, `${name}: horizontal page overflow: ${JSON.stringify(result)}`)
    assert.deepEqual(result.moneyIssues, [], `${name}: money must stay readable on one line`)
    assert.deepEqual(result.overflowing, [], `${name}: content must remain inside the viewport`)
  }
}

try {
  await mkdir(outputDir, { recursive: true })
  await page.goto(new URL('/login', process.env.QA_URL || 'http://127.0.0.1:5173').href, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Lihat dashboard demo' }).click()
  await page.waitForURL('**/dashboard')
  await go('/transaksi', 'Transaksi')
  for (const [income, title, amount] of [[true, 'Pemasukan proyek QA mobile', '11869089'], [false, 'Belanja kebutuhan rumah QA mobile dengan nama panjang', '4020408']]) {
    await page.getByRole('button', { name: 'Tambah transaksi', exact: true }).last().click()
    const dialog = page.getByRole('dialog')
    if (income) await dialog.getByRole('button', { name: 'Pemasukan', exact: true }).click()
    await dialog.getByPlaceholder(income ? 'Contoh: Gaji bulanan' : 'Contoh: Makan siang').fill(title)
    await dialog.getByLabel('Nominal (Rp)').fill(amount)
    await dialog.getByRole('button', { name: 'Simpan transaksi', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
  }
  for (const width of [320, 360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: width > 820 ? 1000 : 844 })
    for (const [path, heading] of routes) {
      await go(path, heading)
      await audit(path.slice(1))
      if (path === '/pengaturan') {
        for (const [tab, name] of [['Preferensi', 'settings-preferences'], ['Kategori & tag', 'settings-categories'], ['WhatsApp', 'settings-whatsapp']]) {
          await page.getByRole('button', { name: tab, exact: true }).click()
          await audit(name)
        }
      }
    }
  }
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await go('/transaksi', 'Transaksi')
    assert.equal(await page.getByLabel('Filter akun').isVisible(), false)
    await page.getByRole('button', { name: /^Filter/ }).click()
    await page.getByLabel('Filter akun').waitFor()
    await page.getByLabel('Filter akun').selectOption('GoPay')
    await page.getByRole('button', { name: 'Pengeluaran', exact: true }).click()
    await page.getByRole('button', { name: /^Filter/ }).click()
    await page.waitForFunction(() => !document.querySelector('#history-extra-filters').getBoundingClientRect().height)
    assert.equal(await page.getByRole('button', { name: /^Filter/ }).getAttribute('aria-expanded'), 'false')
    assert.equal(await page.getByRole('button', { name: /^Filter/ }).locator('span').textContent(), '2')
    await audit('transaction-filter-collapsed')
    await page.getByRole('button', { name: 'Reset pencarian & filter', exact: true }).click()
    await page.waitForFunction(() => !new URLSearchParams(window.location.search).has('account'))
    for (const [path, heading, button, name] of [
      ['/transaksi', 'Transaksi', 'Tambah transaksi', 'form-transaction'],
      ['/akun', 'Semua akun', 'Tambah akun', 'form-account'],
      ['/budget', 'Budget', 'Buat budget', 'form-budget'],
      ['/target', 'Target keuangan', 'Tambah target', 'form-goal'],
      ['/rutin', 'Transaksi rutin', 'Tambah rutin', 'form-recurring'],
      ['/utang', 'Utang & Piutang', 'Tambah data', 'form-debt'],
    ]) {
      await go(path, heading)
      await page.getByRole('button', { name: button, exact: true }).last().click()
      await page.getByRole('dialog').waitFor()
      await audit(name)
      assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden')
      const smallInputs = await page.getByRole('dialog').locator('input:not([type="checkbox"]):not([type="color"]):not([type="hidden"]), select, textarea').evaluateAll((inputs) => inputs.filter((input) => parseFloat(getComputedStyle(input).fontSize) < 16).map((input) => input.type))
      assert.deepEqual(smallInputs, [], 'mobile form inputs should not trigger automatic text zoom')
      await page.setViewportSize({ width, height: 500 })
      const submit = page.getByRole('dialog').locator('.form-actions .primary-btn')
      await submit.scrollIntoViewIfNeeded()
      const submitBox = await submit.boundingBox()
      assert.ok(submitBox.y >= 0 && submitBox.y + submitBox.height <= 501, 'submit remains reachable with a shorter viewport')
      await page.setViewportSize({ width, height: 844 })
      await page.getByRole('button', { name: 'Tutup dialog', exact: true }).click()
      assert.equal(await page.evaluate(() => document.body.style.overflow), '')
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await go('/pengaturan', 'Pengaturan')
  await page.getByRole('button', { name: 'Preferensi', exact: true }).click()
  await page.getByRole('button', { name: /Mode gelap/ }).click()
  for (const [path, heading] of routes.filter(([path]) => ['/dashboard', '/transaksi', '/laporan'].includes(path))) {
    await go(path, heading)
    await audit(`${path.slice(1)}-dark`)
  }
  assert.deepEqual(errors, [])
  await writeFile(join(outputDir, 'audit.json'), JSON.stringify(results, null, 2))
  const issues = results.filter((result) => result.moneyIssues.length || result.overflowing.length || result.documentWidth > result.width)
  if (auditOnly) console.log(JSON.stringify({ total: results.length, issues }, null, 2))
  else console.log(`PASS: ${results.length} mobile/tablet/desktop page, settings and form checks; large amounts stay on one line without clipping or page overflow.`)
} catch (error) {
  await writeFile(join(outputDir, 'audit.json'), JSON.stringify(results, null, 2))
  await page.screenshot({ path: join(outputDir, 'failure.png'), fullPage: true, animations: 'disabled' })
  console.error('Current URL:', page.url(), 'Page errors:', errors)
  console.error('Last audit:', JSON.stringify(results.at(-1)))
  throw error
} finally { await browser.close() }
