import { chromium } from 'playwright-core'
import { mkdir } from 'node:fs/promises'

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
const errors = []
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
page.on('pageerror', (error) => errors.push(error.message))
await mkdir('artifacts', { recursive: true })

await page.goto('http://127.0.0.1:4173/login', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Masuk dengan data demo' }).click()
await page.waitForURL('**/dashboard')
await page.getByRole('heading', { name: /Selamat pagi/ }).waitFor()
await page.screenshot({ path: 'artifacts/financemy-dashboard.png', fullPage: true })

await page.getByRole('link', { name: 'Transaksi', exact: true }).click()
await page.getByRole('button', { name: 'Tambah transaksi' }).click()
await page.getByPlaceholder('Contoh: Makan siang').fill('Sarapan QA')
await page.getByRole('spinbutton', { name: 'Nominal (Rp)' }).fill('35000')
await page.getByRole('button', { name: 'Simpan transaksi' }).click()
await page.getByText('Transaksi berhasil ditambahkan').waitFor()
await page.getByText('Sarapan QA').waitFor()

await page.setViewportSize({ width: 390, height: 844 })
await page.goto('http://127.0.0.1:4173/dashboard', { waitUntil: 'networkidle' })
await page.getByRole('navigation', { name: 'Navigasi mobile' }).waitFor()
await page.screenshot({ path: 'artifacts/financemy-mobile.png', fullPage: true })

console.log(JSON.stringify({ title: await page.title(), url: page.url(), consoleErrors: errors }, null, 2))
await browser.close()
