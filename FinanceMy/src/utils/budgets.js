import { isSameMonth } from 'date-fns'
import { toDate } from './analytics'
import { calculateAdaptiveBudget } from './calculations'

export function budgetMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthlyBudgets(budgets, transactions, date = new Date()) {
  const periodKey = budgetMonthKey(date)
  return budgets
    .filter((budget) => {
      const created = toDate(budget.createdAt)
      return budget.isActive !== false && (budget.periodKey || budgetMonthKey(created || date)) === periodKey
    })
    .map((budget) => {
      const spent = transactions.reduce((total, transaction) => {
        const transactionDate = toDate(transaction.date || transaction.transactionDate)
        if (!transactionDate || !isSameMonth(transactionDate, date)) return total
        if ((transaction.categoryName || transaction.category) !== budget.name) return total
        if (transaction.type === 'expense') return total + Number(transaction.amount || 0)
        if (transaction.type === 'refund') return total - Number(transaction.amount || 0)
        return total
      }, 0)
      return { ...budget, spent: Math.max(spent, 0) }
    })
}

export function dailyBudgetSummary(budgets, month) {
  return budgets.reduce((summary, budget) => {
    const daily = calculateAdaptiveBudget({
      amount: Number(budget.amount || 0), spent: Number(budget.spent || 0),
      daysInPeriod: month.daysInMonth, daysRemaining: month.daysRemaining,
      method: budget.method || 'adaptive', rolloverPercentage: Number(budget.rolloverPercentage || 0),
    })
    return { fixedDaily: summary.fixedDaily + daily.fixedDaily, availableToday: summary.availableToday + daily.availableToday }
  }, { fixedDaily: 0, availableToday: 0 })
}

export function todayBudgetExpense(transactions, budgets, date = new Date()) {
  const categories = new Set(budgets.map((budget) => budget.name))
  return transactions.reduce((total, transaction) => {
    const transactionDate = toDate(transaction.date || transaction.transactionDate)
    if (!transactionDate || transactionDate.toDateString() !== date.toDateString()) return total
    if (!categories.has(transaction.categoryName || transaction.category)) return total
    if (transaction.type === 'expense') return total + Number(transaction.amount || 0)
    if (transaction.type === 'refund') return total - Number(transaction.amount || 0)
    return total
  }, 0)
}
