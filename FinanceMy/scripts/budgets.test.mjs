import assert from 'node:assert/strict'
import test from 'node:test'
import { budgetIdForTransaction, budgetsForDate, dailyBudgetSummary, monthlyBudgets, todayBudgetExpense } from '../src/utils/budgets.js'

const september = new Date(2026, 8, 22, 12)
const legacy = { id: 'makan', name: 'Makan & Minum', amount: 1000000, periodKey: '2026-09' }
const manual = { id: 'jajan', name: 'Jajan', amount: 1000000, periodKey: '2026-09', trackingMode: 'manual' }
const date = new Date(2026, 8, 22, 12)

test('old transactions retain category matching while new transactions use explicit budget choices', () => {
  const transactions = [
    { type: 'expense', category: 'Makan & Minum', amount: 100000, transactionDate: date },
    { type: 'expense', category: 'Makan & Minum', budgetId: null, amount: 50000, transactionDate: date },
    { type: 'expense', category: 'Makan & Minum', budgetId: 'jajan', amount: 30000, transactionDate: date },
    { type: 'expense', category: 'Belanja', budgetId: 'jajan', amount: 20000, transactionDate: date },
    { type: 'expense', category: 'Belanja', budgetId: 'makan', amount: 10000, transactionDate: date },
    { type: 'refund', category: 'Belanja', budgetId: 'makan', amount: 5000, transactionDate: date },
    { type: 'refund', category: 'Makan & Minum', amount: 3000, transactionDate: date },
  ]
  const budgets = monthlyBudgets([legacy, manual], transactions, september)
  assert.equal(budgets.find((budget) => budget.id === 'makan').spent, 102000)
  assert.equal(budgets.find((budget) => budget.id === 'jajan').spent, 50000)
  assert.equal(todayBudgetExpense(transactions, budgets, september), 152000)
})

test('editing an old transaction can clear or change its inferred budget', () => {
  const oldTransaction = { type: 'expense', category: 'Makan & Minum', amount: 100000 }
  assert.equal(budgetIdForTransaction(oldTransaction, [legacy, manual]), 'makan')
  assert.equal(budgetIdForTransaction({ ...oldTransaction, budgetId: null }, [legacy, manual]), null)
  assert.equal(budgetIdForTransaction({ ...oldTransaction, budgetId: 'jajan' }, [legacy, manual]), 'jajan')
  assert.equal(budgetIdForTransaction({ ...oldTransaction, category: 'Jajan' }, [legacy, manual]), null)
})

test('only budgets from the transaction month are available', () => {
  const october = { id: 'next', name: 'Jajan', periodKey: '2026-10', trackingMode: 'manual' }
  assert.deepEqual(budgetsForDate([legacy, manual, october], september).map((budget) => budget.id), ['makan', 'jajan'])
})

test('adaptive daily guidance subtracts today spending only once', () => {
  const budgets = [{ ...manual, amount: 300000, spent: 100000 }, { ...legacy, spent: 40000 }]
  const transactions = [
    { type: 'expense', category: 'Belanja', budgetId: 'jajan', amount: 30000, transactionDate: date },
    { type: 'expense', category: 'Makan & Minum', budgetId: 'makan', amount: 40000, transactionDate: date },
  ]
  const daily = dailyBudgetSummary(budgets, { daysInMonth: 30, daysRemaining: 10 }, transactions, september)
  assert.equal(daily.availableToday, 123000)
  assert.equal(todayBudgetExpense(transactions, [budgets[0]], september), 30000)
  assert.equal(daily.availableToday - todayBudgetExpense(transactions, budgets, september), 53000)
})
