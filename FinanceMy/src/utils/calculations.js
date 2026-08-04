export function calculateAdaptiveBudget({ amount, spent, daysInPeriod, daysRemaining, method = 'adaptive', rolloverPercentage = 0 }) {
  const fixedDaily = amount / Math.max(daysInPeriod, 1)
  const remaining = Math.max(amount - spent, 0)
  const adaptiveDaily = remaining / Math.max(daysRemaining, 1)
  const availableToday = method === 'fixed' || method === 'saving'
    ? fixedDaily
    : method === 'hybrid'
      ? fixedDaily + Math.max(adaptiveDaily - fixedDaily, 0) * (rolloverPercentage / 100)
      : adaptiveDaily
  return { fixedDaily, availableToday, remaining, nextDaily: adaptiveDaily }
}

export function calculateCashFlow({ balance, scheduledIncome = 0, obligations = 0, dailyAverage = 0, days = 0 }) {
  const dailyEstimate = dailyAverage * days
  return { projectedBalance: balance + scheduledIncome - obligations - dailyEstimate, dailyEstimate }
}

export function getBudgetStatus(percentage, thresholds = { attention: 75, warning: 90, exceeded: 100 }) {
  if (percentage >= thresholds.exceeded) return { label: 'Melebihi budget', tone: 'danger' }
  if (percentage >= thresholds.warning) return { label: 'Hampir habis', tone: 'warning' }
  if (percentage >= thresholds.attention) return { label: 'Perlu perhatian', tone: 'amber' }
  return { label: 'Aman', tone: 'success' }
}
