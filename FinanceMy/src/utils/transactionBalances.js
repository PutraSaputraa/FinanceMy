export function transactionEffects(record) {
  if (!record) return []
  const amount = Number(record.amount)
  const source = { accountId: record.accountId, accountName: record.accountName || record.account }
  if (record.type === 'adjustment') {
    return [{ ...source, delta: Number(record.adjustmentDelta) }]
  }
  if (record.type === 'transfer') {
    return [
      { ...source, delta: -amount - Number(record.adminFee || 0) },
      { accountId: record.destinationAccountId, accountName: record.destinationAccountName || record.destinationAccount, delta: amount },
    ]
  }
  return [{ ...source, delta: record.type === 'income' || record.type === 'refund' ? amount : -amount }]
}

export function balanceChanges(previous, next) {
  const changes = new Map()
  for (const [record, direction] of [[previous, -1], [next, 1]]) {
    for (const effect of transactionEffects(record)) {
      const key = effect.accountId || effect.accountName
      if (!key || !Number.isFinite(effect.delta)) throw new Error('Data saldo transaksi tidak lengkap.')
      const current = changes.get(key)
      changes.set(key, {
        accountId: effect.accountId || current?.accountId,
        accountName: effect.accountName || current?.accountName,
        delta: (current?.delta || 0) + direction * effect.delta,
      })
    }
  }
  return [...changes.values()].filter((change) => change.delta !== 0)
}
