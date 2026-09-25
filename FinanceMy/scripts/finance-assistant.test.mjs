import assert from 'node:assert/strict'
import test from 'node:test'
import { answerFinanceQuery, extractGoalPlanHints, parseAssistantIntent } from '../netlify/functions/_lib/finance-assistant.mjs'

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
    { name: 'Dana darurat', accountId: 'a1', saved: 4_000_000, target: 10_000_000, deadline: '2027-09-01', status: 'Aktif' },
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
  budgetView: 'monthly',
  adviceType: 'general',
  scenarioAmount: null,
  scenarioTitle: '',
  budget: '',
  targetAmount: null,
  currentSaved: null,
  targetDate: null,
  monthlyIncome: null,
  incomeDay: null,
  goalName: '',
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
  assert.equal(query.plan.budgetView, 'monthly')
  const daily = parseAssistantIntent('{"kind":"finance_query","topics":["budgets"],"mode":"advice","budgetView":"daily","search":"Jajan"}', today)
  assert.equal(daily.plan.budgetView, 'daily')
  const advice = parseAssistantIntent('{"kind":"finance_query","topics":["overview","budgets"],"mode":"advice","scenarioAmount":600000,"scenarioTitle":"Sepatu","budget":"Jajan","account":"BCA"}', today)
  assert.equal(advice.plan.scenarioAmount, 600000)
  assert.equal(advice.plan.scenarioTitle, 'Sepatu')
  assert.equal(advice.plan.budget, 'Jajan')
  assert.equal(advice.plan.account, 'BCA')
  const goalPlan = parseAssistantIntent('{"kind":"finance_query","topics":["goals","overview"],"mode":"advice","adviceType":"goal_plan","targetAmount":20000000,"currentSaved":4000000,"targetDate":"2027-02-28","monthlyIncome":5700000,"incomeDay":9,"goalName":"Dana Februari"}', today)
  assert.equal(goalPlan.plan.adviceType, 'goal_plan')
  assert.equal(goalPlan.plan.targetAmount, 20000000)
  assert.equal(goalPlan.plan.currentSaved, 4000000)
  assert.equal(goalPlan.plan.targetDate, '2027-02-28')
  assert.equal(goalPlan.plan.monthlyIncome, 5700000)
  assert.equal(goalPlan.plan.incomeDay, 9)
  assert.deepEqual(parseAssistantIntent('{"kind":"unsupported"}', today), { kind: 'unsupported' })
})

test('extracts Indonesian savings target details as a deterministic fallback', () => {
  assert.deepEqual(
    extractGoalPlanHints('Rencana aku ingin dapat 20jt di bulan februari 2027, dan aku sekarang sudah mengumpulkan 4jt, jika setiap tanggal 9 aku mendapatkan gaji 5,7 berapa pengeluaran perbulan yang bagus untuk mencapai target ku itu'),
    {
      targetAmount: 20_000_000,
      currentSaved: 4_000_000,
      targetDate: '2027-02-28',
      monthlyIncome: 5_700_000,
      incomeDay: 9,
    },
  )
  assert.equal(
    extractGoalPlanHints('Target 10 juta tanggal 15 Februari 2027, gaji 5 juta tiap tanggal 9').targetDate,
    '2027-02-15',
  )
})

test('calculates account balances and manually assigned budget spending', () => {
  const accounts = answerFinanceQuery(plan(['accounts']), data, today)
  assert.match(accounts, /💰 \*SALDO AKUN\*/)
  assert.match(accounts, /\*Total saldo\*\nRp2\.750\.000/)
  assert.doesNotMatch(accounts, /Lama/)

  const budgets = answerFinanceQuery(plan(['budgets']), data, today)
  assert.match(budgets, /🎯 \*BUDGET SEPTEMBER 2026\*/)
  assert.match(budgets, /\*Jajan\*\n  Sisa \*Rp850\.000\*/)
  assert.match(budgets, /\*Transport\*\n  Sisa \*Rp400\.000\*/)
  assert.match(budgets, /Terpakai Rp150\.000 • Sisa/)
})

test('recommends a daily amount for a selected budget', () => {
  const dailyData = {
    ...data,
    transactions: [
      ...data.transactions,
      { title: 'Sarapan', type: 'expense', amount: 50_000, budgetId: 'b1', category: 'Makan & Minum', accountName: 'Tunai', date: today },
    ],
  }
  const answer = answerFinanceQuery(plan(['budgets'], {
    mode: 'advice', budgetView: 'daily', search: 'Jajan',
  }), dailyData, today)
  assert.match(answer, /\*PANDUAN BUDGET HARI INI\*/)
  assert.match(answer, /Batas aman hari ini: \*Rp106\.250\*/)
  assert.match(answer, /Sudah dipakai hari ini: Rp50\.000/)
  assert.match(answer, /Masih tersedia hari ini: \*Rp56\.250\*/)
  assert.match(answer, /Sisa bulanan: Rp800\.000/)
})

test('assesses a planned expense without recording it', () => {
  const answer = answerFinanceQuery(plan(['overview', 'budgets', 'recurring'], {
    mode: 'advice', scenarioAmount: 600_000, scenarioTitle: 'Sepatu', budget: 'Jajan', account: 'BCA',
  }), data, today)
  assert.match(answer, /\*MYOUI • CEK RENCANA\*/)
  assert.match(answer, /\*Sepatu\*\nRp600\.000/)
  assert.match(answer, /Saldo BCA setelah rencana: \*Rp1\.900\.000\*/)
  assert.match(answer, /Sisa budget Jajan: \*Rp250\.000\*/)
  assert.match(answer, /Perlu disisihkan dalam 7 hari: \*Rp350\.000\*/)
  assert.match(answer, /\*Penilaian Myoui: PERLU DIPERTIMBANGKAN\*/)
  assert.match(answer, /Belum ada transaksi yang dicatat/)
})

test('gives prioritized advice from the complete financial picture', () => {
  const answer = answerFinanceQuery(plan(['overview'], { mode: 'advice' }), data, today)
  assert.match(answer, /\*MYOUI • SARAN KEUANGAN\*/)
  assert.match(answer, /Total saldo aktif: \*Rp2\.750\.000\*/)
  assert.match(answer, /Jatuh tempo 7 hari: \*Rp350\.000\*/)
  assert.match(answer, /Utang\/cicilan per bulan: \*Rp1\.250\.000\*/)
  assert.match(answer, /Prioritas yang kusarankan/)
})

test('plans monthly spending to reach a future savings target', () => {
  const answer = answerFinanceQuery(plan(['goals', 'overview', 'recurring'], {
    mode: 'advice', adviceType: 'goal_plan', targetAmount: 20_000_000,
    currentSaved: 4_000_000, targetDate: '2027-02-28', monthlyIncome: 5_700_000,
    incomeDay: 9, goalName: 'Target Februari 2027',
  }), data, today)
  assert.match(answer, /\*MYOUI • RENCANA TARGET\*/)
  assert.match(answer, /Kurang \*Rp16\.000\.000\*/)
  assert.match(answer, /Tersisa 5 kali gajian/)
  assert.match(answer, /Pindahkan \*Rp3\.200\.000\* ke tabungan setiap tanggal 9/)
  assert.match(answer, /Batas pengeluaran maksimal agar tepat target: \*Rp2\.500\.000\/bulan\*/)
  assert.match(answer, /Target pengeluaran yang lebih aman: \*Rp2\.250\.000\/bulan\*/)
  assert.match(answer, /buffer sekitar \*Rp250\.000\/bulan\*/)
})

test('answers obligations, recurring transactions, and goals from stored values', () => {
  assert.match(answerFinanceQuery(plan(['debts']), data, today), /\*Pinjaman keluarga\*\n  Sisa \*Rp1\.500\.000\*/)
  assert.match(answerFinanceQuery(plan(['receivables']), data, today), /\*Dimas\*\n  Sisa \*Rp800\.000\*/)
  assert.match(answerFinanceQuery(plan(['installments']), data, today), /\*Laptop\*\n  Sisa \*Rp6\.000\.000\*/)
  assert.match(answerFinanceQuery(plan(['recurring']), data, today), /\*Internet\*\n  Rp350\.000 • Bulanan/)
  assert.match(answerFinanceQuery(plan(['goals']), data, today), /\*Dana darurat\* • 25%\n  Saldo BCA Rp2\.500\.000 dari Rp10\.000\.000/)
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
  assert.match(answer, /📊 \*RINGKASAN SEPTEMBER 2026\*/)
  assert.match(answer, /\*Saldo aktif\*\nRp2\.750\.000/)
  assert.match(answer, /Pemasukan  Rp3\.000\.000/)
  assert.match(answer, /Pengeluaran  Rp225\.000/)
  assert.match(answer, /\*Utang & cicilan\*\nSisa Rp7\.500\.000/)
  assert.match(answer, /_Myoui • data FinanceMy • 23 September 2026_$/)
  assert.ok(answer.length < 3900)
})
