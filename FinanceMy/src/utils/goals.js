export function linkedGoalAccount(goal, accounts) {
  if (!goal) return null
  return accounts.find((account) => account.id === goal.accountId)
    || accounts.find((account) => goal.accountName && account.name === goal.accountName)
    || null
}

export function goalSavedAmount(goal, accounts) {
  const account = linkedGoalAccount(goal, accounts)
  const value = account ? Number(account.currentBalance) : Number(goal?.saved)
  return Number.isFinite(value) ? Math.max(value, 0) : 0
}

export function goalProgress(goal, accounts) {
  const target = Number(goal?.target)
  return target > 0 ? goalSavedAmount(goal, accounts) / target * 100 : 0
}
