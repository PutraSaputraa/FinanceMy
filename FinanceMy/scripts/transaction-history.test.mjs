import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRangeSeries, comparisonPeriod, daysBetween, expenseCategory, groupTransactionsByDay, inDateRange, monthBounds, periodFromParams, reportRange, resolvePeriod, summarizeTransactions, transactionDateKey, transactionLink } from '../src/utils/transactionHistory.js'
import { encodeCsv, transactionCsvRows } from '../src/utils/csvExport.js'
import { buildMonthlyReport } from '../src/utils/assistantReports.js'

const transactions = [
  { id: 'before', date: '2026-02-19', type: 'expense', amount: 9999, category: 'Makan' },
  { id: 'income', date: '2026-02-20', time: '08:00', type: 'income', amount: 1000000, title: 'Gaji' },
  { id: 'expense', date: '2026-02-20', time: '12:00', type: 'expense', amount: 100000, category: 'Makan', title: 'Makan, "siang"' },
  { id: 'refund', date: '2026-02-21', type: 'refund', amount: 120000, category: 'Makan' },
  { id: 'transfer', date: '2026-03-05', type: 'transfer', amount: 500000, adminFee: 2500, category: 'Transfer' },
  { id: 'adjustment', date: '2026-03-05', type: 'adjustment', amount: 9000000, adjustmentDelta: 9000000 },
  { id: 'after', date: '2026-03-06', type: 'expense', amount: 9999, category: 'Makan' },
]
const custom = { mode: 'range', start: '2026-02-20', end: '2026-03-05' }

test('a range includes both boundaries across months and includes only matching financial activity', () => {
  const range = resolvePeriod(custom)
  const selected = transactions.filter((item) => inDateRange(item, range))
  assert.deepEqual(selected.map((item) => item.id), ['income', 'expense', 'refund', 'transfer', 'adjustment'])
  assert.equal(daysBetween(range.start, range.end), 14)
  const summary = summarizeTransactions(selected)
  assert.equal(summary.income, 1000000)
  assert.equal(summary.expense, -17500)
  assert.equal(summary.net, 1017500)
  assert.equal(summary.transferAmount, 500000)
  assert.equal(summary.adjustmentCount, 1)
  assert.equal(summary.count, 4)
  assert.deepEqual(summary.categories.map(({ name, value }) => ({ name, value })), [{ name: 'Biaya admin transfer', value: 2500 }, { name: 'Makan', value: -20000 }])
})

test('refund categories are order independent and reconcile exactly with the expense total', () => {
  const items = transactions.filter((item) => inDateRange(item, resolvePeriod(custom)))
  assert.deepEqual(summarizeTransactions(items), summarizeTransactions([...items].reverse()))
  const summary = summarizeTransactions(items)
  assert.equal(summary.categories.reduce((sum, item) => sum + item.value, 0), summary.expense)
})

test('every category drill-down reconciles with its report total, including fallback names and transfer fees', () => {
  const items = [
    { type: 'expense', category: 'Makan & Minum', amount: 50000 },
    { type: 'refund', categoryName: 'Makan & Minum', amount: 10000 },
    { type: 'income', category: 'Makan & Minum', amount: 900000 },
    { type: 'adjustment', category: 'Makan & Minum', amount: 800000 },
    { type: 'expense', amount: 20000 },
    { type: 'refund', amount: 30000 },
    { type: 'expense', category: 'Biaya admin transfer', amount: 1000 },
    { type: 'transfer', amount: 500000, adminFee: 2500 },
    { type: 'transfer', amount: 600000, adminFee: 0 },
  ]
  const report = summarizeTransactions(items)
  for (const category of report.categories) {
    const detail = items.filter((item) => expenseCategory(item) === category.name)
    assert.equal(summarizeTransactions(detail).expense, category.value)
    assert.equal(summarizeTransactions(detail).income, 0)
    assert.equal(detail.some((item) => item.type === 'adjustment'), false)
  }
  assert.equal(report.categories.find((item) => item.name === 'Pengeluaran Lainnya').value, -10000)
  assert.equal(report.categories.find((item) => item.name === 'Biaya admin transfer').value, 3500)
  assert.equal(items.filter((item) => expenseCategory(item) === 'Makan & Minum').length, 2)
})

test('calendar months cover leap days and years without leaking into the next month', () => {
  assert.deepEqual(monthBounds('2024-02'), { start: '2024-02-01', end: '2024-02-29' })
  assert.deepEqual(monthBounds('2026-12'), { start: '2026-12-01', end: '2026-12-31' })
  const range = resolvePeriod({ mode: 'month', month: '2026-02' })
  assert.equal(transactions.filter((item) => inDateRange(item, range)).length, 4)
})

test('incomplete, reversed and nonexistent date filters fail closed', () => {
  for (const value of [{ ...custom, start: '' }, { ...custom, end: '2026-02-19' }, { ...custom, start: '2026-02-30' }, { mode: 'month', month: '' }]) {
    const range = resolvePeriod(value)
    assert.ok(range.error)
    assert.equal(transactions.filter((item) => inDateRange(item, range)).length, 0)
    assert.deepEqual(buildRangeSeries(transactions, range).rows, [])
  }
  assert.equal(periodFromParams(new URLSearchParams('period=range&start=&end='), '2026-10-20').start, '')
})

test('a single selected date counts as one day', () => {
  const range = resolvePeriod({ mode: 'range', start: '2026-02-20', end: '2026-02-20' })
  assert.equal(daysBetween(range.start, range.end), 1)
  assert.equal(transactions.filter((item) => inDateRange(item, range)).length, 2)
})

test('history groups by financial date, sorts days and times descending, and never mutates the source', () => {
  const original = transactions.map((item) => item.id)
  const groups = groupTransactionsByDay(transactions, '2026-03-06')
  assert.equal(groups[0].title, 'Hari ini')
  assert.equal(groups[1].title, 'Kemarin')
  assert.deepEqual(groups.find((group) => group.date === '2026-02-20').transactions.map((item) => item.id), ['expense', 'income'])
  assert.deepEqual(transactions.map((item) => item.id), original)
})

test('Firestore timestamps use WIB while explicit calendar dates keep their selected day', () => {
  const item = { transactionDate: { toDate: () => new Date('2026-02-19T18:30:00Z') } }
  assert.equal(transactionDateKey(item), '2026-02-20')
  assert.equal(transactionDateKey({ ...item, date: '2026-02-19' }), '2026-02-19')
  assert.equal(transactionDateKey({ date: 'invalid' }), null)
  assert.equal(transactionDateKey({}), null)
  assert.equal(inDateRange({ date: 'invalid' }, resolvePeriod(custom)), false)
})

test('current month comparisons match elapsed dates, and completed months compare full months', () => {
  const period = { mode: 'month', month: '2026-10' }
  const range = resolvePeriod(period, { today: '2026-10-20', throughToday: true })
  assert.equal(range.end, '2026-10-20')
  const prior = comparisonPeriod(period, range, '2026-10-20')
  assert.equal(prior.start, '2026-09-01')
  assert.equal(prior.end, '2026-09-20')
  const march = { mode: 'month', month: '2026-03' }
  assert.equal(comparisonPeriod(march, resolvePeriod(march), '2026-03-31').end, '2026-02-28')
  assert.equal(comparisonPeriod(march, resolvePeriod(march), '2026-10-20').end, '2026-02-28')
})

test('custom comparisons use the immediately preceding range with equal inclusive duration', () => {
  const range = resolvePeriod(custom)
  const previous = comparisonPeriod(custom, range)
  assert.equal(previous.start, '2026-02-06')
  assert.equal(previous.end, '2026-02-19')
  assert.equal(daysBetween(previous.start, previous.end), daysBetween(range.start, range.end))
})

test('daily, weekly, monthly and yearly chart data reconcile with the same summary and retain empty periods', () => {
  for (const range of [resolvePeriod(custom), { start: '2026-02-01', end: '2026-04-30' }, { start: '2026-01-01', end: '2026-12-31' }, { start: '2024-01-01', end: '2027-12-31' }]) {
    const selected = transactions.filter((item) => inDateRange(item, range))
    const summary = summarizeTransactions(selected)
    const { rows } = buildRangeSeries(selected, range)
    assert.equal(rows.reduce((sum, row) => sum + row.income, 0), summary.income)
    assert.equal(rows.reduce((sum, row) => sum + row.expense, 0), summary.expense)
    assert.equal(rows.at(-1).cumulative, summary.net)
    assert.equal(rows[0].start, range.start)
    assert.equal(rows.at(-1).end, range.end)
  }
  const daily = buildRangeSeries(transactions, resolvePeriod(custom))
  assert.equal(daily.rows.length, 14)
  assert.equal(daily.rows.find((row) => row.start === '2026-02-22').expense, 0)
})

test('web reports retain the established WhatsApp totals, including refunds and transfer fees', () => {
  const items = transactions.filter((item) => inDateRange(item, resolvePeriod({ mode: 'month', month: '2026-02' })))
  const web = summarizeTransactions(items)
  const whatsapp = buildMonthlyReport({ transactions }, '2026-02', '2026-10-20')
  for (const key of ['income', 'expense', 'net', 'count']) assert.equal(web[key], whatsapp[key])
  assert.deepEqual(web.categories.map(({ name, value }) => ({ name, value })), whatsapp.categories)
})

test('all-time empty reports remain valid, while drill-down links preserve exact range and category', () => {
  assert.equal(reportRange(resolvePeriod({ mode: 'all' }), []).start, null)
  const range = reportRange(resolvePeriod({ mode: 'all' }), transactions)
  assert.equal(range.start, '2026-02-19')
  assert.equal(range.end, '2026-03-06')
  const url = new URL(transactionLink(resolvePeriod(custom), { category: 'Makan & Minum' }), 'https://example.test')
  assert.equal(url.searchParams.get('start'), custom.start)
  assert.equal(url.searchParams.get('end'), custom.end)
  assert.equal(url.searchParams.get('category'), 'Makan & Minum')
})

test('CSV keeps quotes, commas, line breaks and numeric negatives without executing user text as formulas', () => {
  const csv = encodeCsv([['Makan, "siang"', '=SUM(A1:A5)', ' \t@SUM(A1:A5)', 'baris\nbaru', -20000]])
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes('"Makan, ""siang"""'))
  assert.ok(csv.includes('"\'=SUM(A1:A5)"'))
  assert.ok(csv.includes('"\' \t@SUM(A1:A5)"'))
  assert.ok(csv.includes('"baris\nbaru"'))
  assert.ok(csv.endsWith('"-20000"'))
  assert.equal(transactionCsvRows([transactions[2]]).length, 2)
})
