import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMonthlyReport, jakartaDateKey, monthOffset, monthlyReportDetails, notificationCandidates } from '../src/utils/assistantReports.js'
import { categoryNames, mergeCategories, taxonomyRecord } from '../src/utils/taxonomy.js'
import { parseWhatsAppDraft } from '../netlify/functions/_lib/whatsapp-draft.mjs'
import { simpleRevision } from '../netlify/functions/_lib/whatsapp-chat.mjs'

const transactions = [
  { type: 'income', amount: 8_000_000, date: '2026-09-01' },
  { type: 'expense', amount: 400_000, date: '2026-08-15', category: 'Transportasi' },
  { type: 'expense', amount: 700_000, date: '2026-09-15', category: 'Transportasi' },
  { type: 'expense', amount: 1_800_000, date: '2026-09-05', category: 'Kos' },
  { type: 'refund', amount: 100_000, date: '2026-09-16', category: 'Transportasi' },
  { type: 'transfer', amount: 1_000_000, adminFee: 2500, date: '2026-09-17' },
  { type: 'adjustment', amount: 50_000_000, date: '2026-09-17' },
  { type: 'income', amount: 99_000_000, date: '2026-10-01' },
]
const recurring = { id: 'rent', name: 'Kos', amount: 1_800_000, type: 'Tagihan', nextDate: '2026-10-08' }

test('monthly report excludes transfer principal/adjustments and nets refunds, including fees', () => {
  const report = buildMonthlyReport({ transactions, recurringTransactions: [recurring] }, '2026-09', '2026-10-01')
  assert.equal(report.income, 8_000_000)
  assert.equal(report.expense, 2_402_500)
  assert.equal(report.net, 5_597_500)
  assert.equal(report.categories.reduce((sum, item) => sum + item.value, 0), report.expense)
  assert.match(report.insight, /Kenaikan terbesar: Kos/)
  assert.match(report.text, /8 Oktober: Kos/)
  assert.ok(report.text.split(/\s+/).length <= 85)
  assert.match(monthlyReportDetails(report), /Transfer antar-akun dikecualikan/)
})

test('no misleading comparison without prior expense data; empty months are not pushed', () => {
  const report = buildMonthlyReport({ transactions: transactions.filter((item) => item.date.startsWith('2026-09')) }, '2026-09')
  assert.doesNotMatch(report.insight, /naik|turun|%/)
  assert.match(report.insight, /terbesar: Kos/)
  assert.deepEqual(notificationCandidates({ transactions: [] }, { monthlyReport: true }, new Date('2026-10-01T02:00:00Z')), [])
})

test('Jakarta boundaries, leap year, new year and Firestore timestamps', () => {
  assert.equal(jakartaDateKey('2026-09-30T17:00:00Z'), '2026-10-01')
  assert.equal(jakartaDateKey('2026-02-30'), null)
  assert.equal(monthOffset('2026-01', -1), '2025-12')
  assert.equal(monthOffset('2024-03', -1), '2024-02')
  assert.equal(buildMonthlyReport({ transactions: [{ type: 'income', amount: 20, transactionDate: { toDate: () => new Date('2026-09-30T17:00:00Z') } }] }, '2026-09').income, 0)
  assert.equal(buildMonthlyReport({ transactions: [{ type: 'income', amount: 20, transactionDate: { toDate: () => new Date('2026-09-30T17:00:00Z') } }] }, '2026-10').income, 20)
})

test('notifications respect opt-in, 09–21 WIB, day 1–3 catch-up and H-7/H-3/H-0', () => {
  const data = { transactions, recurringTransactions: [recurring] }
  assert.deepEqual(notificationCandidates(data, {}, new Date('2026-10-01T02:00:00Z')), [])
  const prefs = { monthlyReport: true, recurringReminder: true, reminderDays: 7 }
  assert.equal(notificationCandidates(data, prefs, new Date('2026-10-01T01:59:00Z')).length, 0)
  assert.equal(notificationCandidates(data, prefs, new Date('2026-10-01T02:00:00Z')).length, 2)
  assert.equal(notificationCandidates(data, prefs, new Date('2026-10-01T14:00:00Z')).length, 0)
  assert.equal(notificationCandidates(data, prefs, new Date('2026-10-03T02:00:00Z')).length, 1)
  assert.equal(notificationCandidates(data, prefs, new Date('2026-10-04T02:00:00Z')).length, 0)
  assert.equal(notificationCandidates(data, { recurringReminder: true, reminderDays: 3 }, new Date('2026-10-05T02:00:00Z')).length, 1)
  assert.equal(notificationCandidates(data, { recurringReminder: true, reminderDays: 0 }, new Date('2026-10-08T02:00:00Z')).length, 1)
  assert.equal(notificationCandidates(data, { recurringReminder: true, reminderDays: 0 }, new Date('2026-10-09T02:00:00Z')).length, 0)
  assert.equal(notificationCandidates({ recurringTransactions: [{ ...recurring, isActive: false }] }, prefs, new Date('2026-10-01T02:00:00Z')).length, 0)
  const changed = notificationCandidates(data, { recurringReminder: true, reminderDays: 3 }, new Date('2026-10-05T02:00:00Z'))[0]
  const original = notificationCandidates(data, prefs, new Date('2026-10-01T02:00:00Z')).find((item) => item.kind === 'recurring')
  assert.equal(changed.key, original.key, 'changing lead time must not create another notification for the same due date')
})

test('custom categories preserve defaults, reject duplicates, support inactive historical selections and WA', () => {
  const defaults = mergeCategories()
  assert.throws(() => taxonomyRecord({ name: '  makan &   minum ', type: 'expense' }, defaults), /sudah tersedia/)
  assert.throws(() => taxonomyRecord({ name: ' ', type: 'expense' }, defaults), /1–40/)
  assert.throws(() => taxonomyRecord({ name: 'a'.repeat(41), type: 'expense' }, defaults), /1–40/)
  const custom = taxonomyRecord({ name: 'Pendidikan', type: 'expense' }, defaults)
  const categories = mergeCategories([custom, { id: 'expense_0', isActive: false }])
  assert.ok(!categoryNames(categories).includes('Makan & Minum'))
  assert.ok(categoryNames(categories, 'expense', 'Makan & Minum').includes('Makan & Minum'))
  assert.ok(categoryNames(categories).includes('Pendidikan'))
  assert.ok(!categoryNames(categories, 'income').includes('Pendidikan'))
  const choices = { expense: categoryNames(categories), income: categoryNames(categories, 'income') }
  const draft = parseWhatsAppDraft(JSON.stringify({ kind: 'transaction', type: 'expense', title: 'Buku', amount: 50_000, category: 'Pendidikan' }), '2026-10-01', choices)
  assert.equal(draft.parsed.category, 'Pendidikan')
  assert.equal(simpleRevision({ ...draft.parsed, category: 'Belanja' }, 'kategori pendidikan', choices).category, 'Pendidikan')
  assert.equal(simpleRevision(draft.parsed, 'kategori Makan & Minum', choices), null)
  assert.throws(() => taxonomyRecord({ name: 'pendidikan', type: 'expense' }, categories), /sudah tersedia/)
  assert.equal(taxonomyRecord({ name: 'Liburan' }, [], 'tag').type, 'tag')
})
