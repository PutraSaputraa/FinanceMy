import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message))

async function goTo(path) {
  await page.locator(`a[href="${path}"]`).last().click()
  await page.waitForURL(`**${path}`)
}

async function balance(name) {
  const card = page.locator('.account-detail-card').filter({ has: page.locator('.account-card strong', { hasText: name }) }).first()
  await card.waitFor()
  return Number((await card.locator('.account-card p').textContent()).replace(/\D/g, ''))
}

try {
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Lihat dashboard demo' }).click()
  await page.waitForURL('**/dashboard')
  await goTo('/transaksi')

  await page.getByRole('button', { name: 'Tambah transaksi' }).last().click()
  let dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('Contoh: Makan siang').fill('Sarapan QA')
  await dialog.getByRole('spinbutton', { name: 'Nominal (Rp)' }).fill('35000')
  await dialog.getByRole('button', { name: 'Simpan transaksi' }).click()
  await page.getByText('Transaksi berhasil ditambahkan').waitFor()
  await page.getByRole('button', { name: 'Edit transaksi Sarapan QA' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('spinbutton', { name: 'Nominal (Rp)' }).fill('45000')
  await dialog.getByLabel('Akun pembayaran').selectOption({ label: 'Blu' })
  await dialog.getByRole('button', { name: 'Simpan perubahan' }).click()
  await page.getByText('Transaksi berhasil diperbarui').waitFor()
  await goTo('/akun')
  assert.equal(await balance('BSI'), 4500000)
  assert.equal(await balance('Blu'), 2955000)

  await goTo('/transaksi')
  await page.getByRole('button', { name: 'Hapus transaksi Sarapan QA' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Hapus transaksi' }).click()
  await page.getByText('Transaksi berhasil dihapus').waitFor()
  assert.equal(await page.getByText('Sarapan QA').count(), 0)
  await goTo('/akun')
  assert.equal(await balance('Blu'), 3000000)

  await goTo('/transaksi')
  await page.getByRole('button', { name: 'Tambah transaksi' }).last().click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Transfer' }).click()
  await dialog.getByRole('spinbutton', { name: 'Nominal (Rp)' }).fill('120000')
  await dialog.getByLabel('Akun tujuan').selectOption({ label: 'GoPay' })
  await dialog.getByRole('spinbutton', { name: 'Biaya admin' }).fill('2000')
  await dialog.getByRole('button', { name: 'Simpan transaksi' }).click()
  await page.getByText('Transaksi berhasil ditambahkan').waitFor()
  await page.getByRole('button', { name: 'Edit transaksi Transfer ke GoPay' }).click()
  dialog = page.getByRole('dialog')
  await dialog.getByRole('spinbutton', { name: 'Nominal (Rp)' }).fill('80000')
  await dialog.getByLabel('Akun tujuan').selectOption({ label: 'Blu' })
  await dialog.getByRole('spinbutton', { name: 'Biaya admin' }).fill('1000')
  await dialog.getByRole('button', { name: 'Simpan perubahan' }).click()
  await page.getByText('Transaksi berhasil diperbarui').waitFor()
  await goTo('/akun')
  assert.equal(await balance('BSI'), 4419000)
  assert.equal(await balance('GoPay'), 350000)
  assert.equal(await balance('Blu'), 3080000)

  await goTo('/transaksi')
  await page.getByRole('button', { name: 'Hapus transaksi Transfer ke Blu' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Hapus transaksi' }).click()
  await page.getByText('Transaksi berhasil dihapus').waitFor()
  await goTo('/akun')
  assert.equal(await balance('BSI'), 4500000)
  assert.equal(await balance('Blu'), 3000000)
  assert.deepEqual(pageErrors, [])
  console.log('Transaction create, edit, transfer, delete, and mobile balance checks passed.')
} catch (error) {
  console.error('Current URL:', page.url())
  console.error('Dialogs:', await page.getByRole('dialog').allTextContents())
  console.error('Page errors:', pageErrors)
  throw error
} finally {
  await browser.close()
}
