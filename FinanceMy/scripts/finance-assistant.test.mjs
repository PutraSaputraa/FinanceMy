import assert from 'node:assert/strict'
import test from 'node:test'
import { answerFinanceQuery, parseAssistantIntent } from '../netlify/functions/_lib/finance-assistant.mjs'

const today = '2026-09-23'
const data = {
  accounts: [
    { id: 'a1', name: 'BCA', currentBalance: 2_500_000, isActive: true },
    { id: 'a2', name: 'Tunai', currentBalance: 250_000, isActive: true },
    { id: 'a3', name: 'Lama', currentBalance: 9_000_000, isActive: false },
  ],
  budgets: [
    { id: 'b1', name: 'Jajan', amount: 1_000_000, periodKey: '2026-09', trackingMode: 'manual', isActive: true },
    { id: 'b2', name: 'Transport', amount: 400_000, periodKey: '2026-09', trackingMode: 'manual', isActive: true },
    { id: 'old', name: 'Lama', amount: 5_000_000, periodKey: '2026-08', isActive: true },
  ],
  transactions: [
    { title: 'Makan', type: 'expense', amount: 200_000, budgetId: 'b1', category: 'Makan & Minum', accountName: 'BCA', date: '2026-09-10' },
    { title: 'Refund makan', type: 'refund', amount: 50_000, budgetId: 'b1', category: 'Refund', accountName: 'BCA', date: '2026-09-11' },
    { title: 'Ojek', type: 'expense', amount: 75_000, budgetId: null, category: 'Transportasi', accountName: 'Tunai', date: '2026-09-12' },
    { title: 'Gaji', type: 'income', amount: 3_000_000, category: 'Gaji', accountName: 'BCA', date: '2026-09-01' },
    { title: 'Bulan lalu', type: 'expense', amount: 999_000, budgetId: 'b1', category: 'Makan & Minum', accountName: 'BCA', date: '2026-08-20' },
  ],
  recurringTransactions: [
    { name: 'Internet', type: 'Tagihan', amount: 350_000, frequency: 'Bulanan', nextDate: '2026-09-25', accountName: 'BCA', isActive: true },
  ],
  goals: [
    { name: 'Dana darurat', saved: 4_000_000, target: 10_000_000, deadline: '2027-09-01', status: 'Aktif' },
  ],
  debts: [
    { name: 'Pinjaman keluarga', remaining: 1_500_000, monthly: 500_000, due: '2026-12-15', status: 'Aktif' },
  ],
  receivables: [
    { name: 'Dimas', remaining: 800_000, monthly: 0, status: 'Aktif' },
  ],
  installments: [
    { name: 'Laptop', remaining: 6_000_000, monthly: 750_000, status: 'Aktif' },
  ],
}

const plan = (topics, extra = {}) => ({
  topics,
  mode: 'summary',
  periodStart: null,
  periodEnd: null,
  transactionType: 'all',
  category: '',
  account: '',
  search: '',
  ...extra,
})

test('parses transaction, finance query, and unsupported intents', () => {
  const transaction = parseAssistantIntent('{"kind":"transaction","type":"expense","title":"Kopi","amount":18000,"category":"Makan & Minum","date":"2026-09-23","accountHint":"Tunai","budgetHint":"Jajan"}', today)
  assert.equal(transaction.kind, 'transaction')
  assert.equal(transaction.draft.parsed.amount, 18000)

  const query = parseAssistantIntent('{"kind":"finance_query","topics":["budgets","accounts","invalid"],"mode":"list","transactionType":"all","search":"Jajan"}', today)
  assert.deepEqual(query.plan.topics, ['budgets', 'accounts'])
  assert.equal(query.plan.search, 'Jajan')
  assert.deepEqual(parseAssistantIntent('{"kind":"unsupported"}', today), { kind: 'unsupported' })
})

test('calculates account balances and manually assigned budget spending', () => {
  const accounts = answerFinanceQuery(plan(['accounts']), data, today)
  assert.match(accounts, /Total: \*Rp2\.750\.000\*/)
  assert.doesNotMatch(accounts, /Lama/)

  const budgets = answerFinanceQuery(plan(['budgets']), data, today)
  assert.match(budgets, /Jajan: sisa \*Rp850\.000\*/)
  assert.match(budgets, /Transport: sisa \*Rp400\.000\*/)
  assert.match(budgets, /Total terpakai Rp150\.000/)
})

test('answers obligations, recurring transactions, and goals from stored values', () => {
  assert.match(answerFinanceQuery(plan(['debts']), data, today), /Pinjaman keluarga: sisa Rp1\.500\.000/)
  assert.match(answerFinanceQuery(plan(['receivables']), data, today), /Dimas: sisa Rp800\.000/)
  assert.match(answerFinanceQuery(plan(['installments']), data, today), /Laptop: sisa Rp6\.000\.000/)
  assert.match(answerFinanceQuery(plan(['recurring']), data, today), /Internet: Rp350\.000/)
  assert.match(answerFinanceQuery(plan(['goals']), data, today), /Dana darurat: Rp4\.000\.000 dari Rp10\.000\.000 \(40%\)/)
})

test('summarizes and lists filtered transactions for the requested period', () => {
  const summary = answerFinanceQuery(plan(['transactions'], {
    transactionType: 'expense', periodStart: '2026-09-01', periodEnd: '2026-09-30',
  }), data, today)
  assert.match(summary, /3 transaksi/)
  assert.match(summary, /Total pengeluaran: \*Rp225\.000\*/)
  assert.doesNotMatch(summary, /999\.000/)

  const list = answerFinanceQuery(plan(['transactions'], {
    mode: 'list', transactionType: 'expense', category: 'Transportasi', periodStart: '2026-09-01', periodEnd: '2026-09-30',
  }), data, today)
  assert.match(list, /Ojek/)
  assert.doesNotMatch(list, /Makan ·/)
})

test('provides an overview using current month figures', () => {
  const answer = answerFinanceQuery(plan(['overview']), data, today)
  assert.match(answer, /Saldo aktif: \*Rp2\.750\.000\*/)
  assert.match(answer, /Pemasukan: Rp3\.000\.000/)
  assert.match(answer, /Pengeluaran: Rp225\.000/)
  assert.match(answer, /Sisa utang & cicilan: \*Rp7\.500\.000\*/)
})

