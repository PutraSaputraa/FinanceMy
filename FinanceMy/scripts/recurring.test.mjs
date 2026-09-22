import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRecurringPayment, nextRecurringDate, recurringDueDate, recurringStatus } from '../src/utils/recurring.js'

test('monthly due dates retain the original day after a short month', () => {
  assert.equal(nextRecurringDate('2027-01-31', 'Bulanan', '2027-01-31'), '2027-02-28')
  assert.equal(nextRecurringDate('2027-02-28', 'Bulanan', '2027-01-31'), '2027-03-31')
  assert.equal(nextRecurringDate('2028-02-29', 'Tahunan', '2024-02-29'), '2029-02-28')
  assert.equal(nextRecurringDate('2026-12-29', 'Mingguan'), '2027-01-05')
})

test('reminders begin seven days before an unpaid due date and remain overdue', () => {
  const item = { nextDate: '2026-10-15', isActive: true }
  assert.equal(recurringStatus(item, new Date(2026, 9, 7)).needsReminder, false)
  assert.equal(recurringStatus(item, new Date(2026, 9, 8)).label, 'H-7')
  assert.equal(recurringStatus(item, new Date(2026, 9, 15)).label, 'Jatuh tempo hari ini')
  assert.equal(recurringStatus(item, new Date(2026, 10, 1)).needsReminder, true)
  assert.equal(recurringStatus({ ...item, isActive: false }, new Date(2026, 10, 1)).needsReminder, false)
})

test('manual payment produces a regular expense and advances only one unpaid period', () => {
  const item = { name: 'Internet', type: 'Langganan', frequency: 'Bulanan', nextDate: '2026-09-15', anchorDate: '2026-09-15', amount: 150000, categoryName: 'Langganan' }
  const account = { id: 'bank', name: 'Bank', currentBalance: 500000, isActive: true }
  const result = buildRecurringPayment('schedule-1', item, account, 160000, new Date(2026, 9, 2), 'jajan')
  assert.equal(recurringDueDate(item), '2026-09-15')
  assert.equal(result.nextDate, '2026-10-15')
  assert.equal(result.transaction.type, 'expense')
  assert.equal(result.transaction.amount, 160000)
  assert.equal(result.transaction.accountId, 'bank')
  assert.equal(result.transaction.categoryName, 'Langganan')
  assert.equal(result.transaction.budgetId, 'jajan')
  assert.equal(result.transaction.occurrenceKey, 'schedule-1_2026-09-15')
  assert.equal(result.transaction.date, '2026-10-02')
  assert.throws(() => buildRecurringPayment('schedule-1', item, { ...account, currentBalance: 100000 }, 160000), /Saldo akun/)
})

test('routine income is recorded into the selected account', () => {
  const result = buildRecurringPayment('salary', { name: 'Gaji', type: 'Pemasukan rutin', frequency: 'Bulanan', nextDate: '2026-09-30' }, { id: 'bank', name: 'Bank', currentBalance: 0 }, 5000000, new Date(2026, 8, 30))
  assert.equal(result.transaction.type, 'income')
  assert.equal(result.transaction.budgetId, null)
  assert.equal(result.transaction.categoryName, 'Pemasukan lainnya')
  assert.equal(result.nextDate, '2026-10-30')
})
