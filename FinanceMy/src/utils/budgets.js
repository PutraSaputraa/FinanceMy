import { isSameMonth } from 'date-fns'
import { toDate } from './analytics.js'
import { calculateAdaptiveBudget } from './calculations.js'

export function budgetMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function budgetPeriodKey(budget, fallbackDate = new Date()) {
  return budget.periodKey || budgetMonthKey(toDate(budget.createdAt) || fallbackDate)
}

export function budgetsForDate(budgets, date = new Date()) {
  const periodKey = budgetMonthKey(date)
  return budgets.filter((budget) => budget.isActive !== false && budgetPeriodKey(budget, date) === periodKey)
}

export function budgetIdForTransaction(transaction, budgets) {
  if (transaction.type !== 'expense' && transaction.type !== 'refund') return null
  if (Object.hasOwn(transaction, 'budgetId')) return transaction.budgetId || null
  const category = transaction.categoryName || transaction.category
  return budgets.find((budget) => budget.trackingMode !== 'manual' && budget.name === category)?.id || null
}

export function monthlyBudgets(budgets, transactions, date = new Date()) {
  const currentBudgets = budgetsForDate(budgets, date)
  return currentBudgets
    .map((budget) => {
      const spent = transactions.reduce((total, transaction) => {
        const transactionDate = toDate(transaction.date || transaction.transactionDate)
        if (!transactionDate || !isSameMonth(transactionDate, date)) return total
        if (budgetIdForTransaction(transaction, currentBudgets) !== budget.id) return total
        if (transaction.type === 'expense') return total + Number(transaction.amount || 0)
        if (transaction.type === 'refund') return total - Number(transaction.amount || 0)
        return total
      }, 0)
      return { ...budget, spent: Math.max(spent, 0) }
    })
}

export function dailyBudgetSummary(budgets, month, transactions = [], date = new Date()) {
  return budgets.reduce((summary, budget) => {
    const spentBeforeToday = Number(budget.spent || 0) - todayBudgetExpense(transactions, [budget], date)
    const daily = calculateAdaptiveBudget({
      amount: Number(budget.amount || 0), spent: spentBeforeToday,
      daysInPeriod: month.daysInMonth, daysRemaining: month.daysRemaining,
      method: budget.method || 'adaptive', rolloverPercentage: Number(budget.rolloverPercentage || 0),
    })
    return { fixedDaily: summary.fixedDaily + daily.fixedDaily, availableToday: summary.availableToday + daily.availableToday }
  }, { fixedDaily: 0, availableToday: 0 })
}

export function todayBudgetExpense(transactions, budgets, date = new Date()) {
  const budgetIds = new Set(budgets.map((budget) => budget.id))
  return transactions.reduce((total, transaction) => {
    const transactionDate = toDate(transaction.date || transaction.transactionDate)
    if (!transactionDate || transactionDate.toDateString() !== date.toDateString()) return total
    if (!budgetIds.has(budgetIdForTransaction(transaction, budgets))) return total
    if (transaction.type === 'expense') return total + Number(transaction.amount || 0)
    if (transaction.type === 'refund') return total - Number(transaction.amount || 0)
    return total
  }, 0)
}
