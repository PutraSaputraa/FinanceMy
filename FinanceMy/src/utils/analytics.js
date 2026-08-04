import { format, isSameDay, isSameMonth, subMonths } from 'date-fns'
import { id } from 'date-fns/locale'

const chartColors = ['#087f5b', '#2271b3', '#e08a17', '#8b5cf6', '#e05252', '#0f766e', '#64748b']

export function toDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value?.toDate === 'function') return value.toDate()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function amountFor(transaction, type) {
  const amount = Number(transaction.amount || 0)
  if (type === 'income') return transaction.type === 'income' ? amount : 0
  if (transaction.type === 'expense') return amount
  if (transaction.type === 'refund') return -amount
  if (transaction.type === 'transfer') return Number(transaction.adminFee || 0)
  return 0
}

export function getPeriodSummary(transactions, date = new Date()) {
  return transactions.reduce((summary, transaction) => {
    const transactionDate = toDate(transaction.date || transaction.transactionDate)
    if (!transactionDate || !isSameMonth(transactionDate, date)) return summary
    summary.income += amountFor(transaction, 'income')
    summary.expense += amountFor(transaction, 'expense')
    return summary
  }, { income: 0, expense: 0 })
}

export function getTodayExpense(transactions, date = new Date()) {
  return transactions.reduce((total, transaction) => {
    const transactionDate = toDate(transaction.date || transaction.transactionDate)
    return transactionDate && isSameDay(transactionDate, date)
      ? total + amountFor(transaction, 'expense')
      : total
  }, 0)
}

export function buildMonthlyCashFlow(transactions, referenceDate = new Date(), months = 6) {
  const periods = Array.from({ length: months }, (_, index) => subMonths(referenceDate, months - index - 1))
  let runningBalance = 0
  return periods.map((period) => {
    const summary = getPeriodSummary(transactions, period)
    runningBalance += summary.income - summary.expense
    return {
      month: format(period, 'MMM', { locale: id }),
      income: summary.income,
      expense: summary.expense,
      balance: runningBalance,
    }
  })
}

export function buildCategoryData(transactions, date = new Date()) {
  const grouped = new Map()
  transactions.forEach((transaction) => {
    const transactionDate = toDate(transaction.date || transaction.transactionDate)
    if (!transactionDate || !isSameMonth(transactionDate, date)) return
    const value = amountFor(transaction, 'expense')
    if (!value) return
    const name = transaction.categoryName || transaction.category || 'Lainnya'
    grouped.set(name, Math.max((grouped.get(name) || 0) + value, 0))
  })
  return [...grouped.entries()]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], index) => ({ name, value, color: chartColors[index % chartColors.length] }))
}

export function percentageChange(current, previous) {
  if (!previous) return current ? 100 : 0
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10
}

export function getMonthInfo(date = new Date()) {
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return {
    daysInMonth,
    daysElapsed: date.getDate(),
    daysRemaining: Math.max(daysInMonth - date.getDate() + 1, 1),
    label: format(date, 'MMMM yyyy', { locale: id }),
    fullDate: format(date, 'EEEE, d MMMM yyyy', { locale: id }),
  }
}

export function getGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

export function firstName(user) {
  return (user?.displayName || user?.email?.split('@')[0] || 'Pengguna').trim().split(/\s+/)[0]
}
