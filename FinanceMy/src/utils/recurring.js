const frequencies = new Set(['Mingguan', 'Bulanan', 'Tahunan'])

function parts(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
      ? { year, month, day } : null
  }
  const date = typeof value?.toDate === 'function' ? value.toDate() : value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
}

function key({ year, month, day }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function recurringDateKey(value) {
  if (!value) return null
  const date = parts(value)
  return date ? key(date) : null
}

export function recurringDueDate(item) {
  return recurringDateKey(item?.nextDate || item?.date || item?.dueDate)
}

export function nextRecurringDate(dueDate, frequency, anchorDate = dueDate) {
  const due = parts(dueDate)
  const anchor = parts(anchorDate)
  if (!due || !anchor || !frequencies.has(frequency)) throw new Error('Jadwal transaksi rutin tidak valid.')
  if (frequency === 'Mingguan') {
    const next = new Date(Date.UTC(due.year, due.month - 1, due.day + 7))
    return key({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() })
  }
  const targetYear = frequency === 'Tahunan' ? due.year + 1 : due.year + (due.month === 12 ? 1 : 0)
  const targetMonth = frequency === 'Tahunan' ? anchor.month : due.month === 12 ? 1 : due.month + 1
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()
  return key({ year: targetYear, month: targetMonth, day: Math.min(anchor.day, lastDay) })
}

export function recurringStatus(item, today = new Date()) {
  const due = recurringDueDate(item)
  if (!due || item?.isActive === false) return { label: 'Tidak aktif', tone: 'neutral', needsReminder: false }
  const current = recurringDateKey(today)
  const days = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${current}T00:00:00Z`)) / 86400000)
  if (days < 0) return { label: `Terlambat ${Math.abs(days)} hari`, tone: 'danger', needsReminder: true }
  if (days === 0) return { label: 'Jatuh tempo hari ini', tone: 'danger', needsReminder: true }
  if (days <= 7) return { label: `H-${days}`, tone: 'warning', needsReminder: true }
  return { label: `${days} hari lagi`, tone: 'neutral', needsReminder: false }
}

export function recurringTransactionType(type) {
  return type === 'Pemasukan rutin' ? 'income' : 'expense'
}

export function recurringCategory(type, category) {
  if (category) return category
  if (type === 'Pemasukan rutin') return 'Pemasukan lainnya'
  if (type === 'Langganan') return 'Langganan'
  return 'Tagihan'
}

export function buildRecurringPayment(id, item, account, amount, paidAt = new Date(), budgetId = null) {
  const due = recurringDueDate(item)
  const paid = recurringDateKey(paidAt)
  const value = Number(amount)
  if (!due || !paid || !frequencies.has(item.frequency || 'Bulanan')) throw new Error('Jadwal transaksi rutin tidak valid.')
  if (!Number.isFinite(value) || value <= 0) throw new Error('Nominal harus lebih dari nol.')
  if (!account || account.isActive === false) throw new Error('Pilih akun yang masih aktif.')
  const type = recurringTransactionType(item.type)
  if (type === 'expense' && !account.allowNegative && Number(account.currentBalance) < value) throw new Error('Saldo akun tidak mencukupi.')
  const category = recurringCategory(item.type, item.categoryName || item.category)
  return {
    nextDate: nextRecurringDate(due, item.frequency || 'Bulanan', item.anchorDate || due),
    transaction: {
      title: item.name || item.title,
      type,
      amount: value,
      accountId: account.id,
      accountName: account.name,
      account: account.name,
      categoryName: category,
      category,
      budgetId: type === 'expense' ? budgetId || null : null,
      recurringId: id,
      occurrenceKey: `${id}_${due}`,
      scheduledDate: due,
      transactionDate: paidAt,
      date: paid,
      ...(type === 'expense' ? { needType: 'wajib' } : {}),
    },
  }
}
