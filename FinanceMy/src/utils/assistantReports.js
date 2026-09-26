const money = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })
const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
export const rupiah = (value) => `${value < 0 ? '-' : ''}Rp${money.format(Math.abs(value))}`
const safeName = (value) => String(value || '').replace(/[\p{Cc}\p{Cf}*_~`]/gu, '').trim().slice(0, 48)
const amount = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0

export function jakartaDateKey(value = new Date()) {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
  }
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function monthOffset(period, offset) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Bulan laporan tidak valid.')
  const [year, month] = period.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 7)
}

export function monthLabel(period) {
  monthOffset(period, 0)
  const [year, month] = period.split('-')
  return `${months[Number(month) - 1]} ${year}`
}

export function dateLabel(date) {
  const [, month, day] = date.split('-')
  return `${Number(day)} ${months[Number(month) - 1]}`
}

function monthTotals(transactions, period) {
  let income = 0, expense = 0, count = 0
  const categories = new Map()
  for (const item of transactions) {
    const date = jakartaDateKey(item.date || item.transactionDate)
    if (!date?.startsWith(period) || !['income', 'expense', 'refund', 'transfer'].includes(item.type)) continue
    const value = amount(item.amount)
    const cost = item.type === 'expense' ? value : item.type === 'refund' ? -value : item.type === 'transfer' ? amount(item.adminFee) : 0
    if (item.type === 'income') income += value
    if (item.type !== 'transfer' || cost > 0) count++
    expense += cost
    if (cost) {
      const category = item.type === 'transfer' ? 'Biaya admin transfer' : item.categoryName || item.category || 'Pengeluaran Lainnya'
      categories.set(category, (categories.get(category) || 0) + cost)
    }
  }
  return { income, expense, net: income - expense, count, categories: [...categories].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)) }
}

export function upcomingRecurring(items, today, days = 7) {
  return items.filter((item) => item.isActive !== false).map((item) => {
    const dueDate = jakartaDateKey(item.nextDate || item.date || item.dueDate)
    const daysUntil = dueDate ? Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000) : -1
    return { ...item, dueDate, daysUntil }
  }).filter((item) => item.dueDate && item.daysUntil >= 0 && item.daysUntil <= days && amount(item.amount) > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || String(a.id).localeCompare(String(b.id)))
}

export function buildMonthlyReport({ transactions = [], recurringTransactions = [] }, period, today = jakartaDateKey()) {
  const previousPeriod = monthOffset(period, -1)
  const current = monthTotals(transactions, period)
  const previous = monthTotals(transactions, previousPeriod)
  let insight = 'Belum ada transaksi tercatat untuk bulan ini.'
  if (current.count) {
    if (previous.count && previous.expense > 0 && current.expense >= 0) {
      const delta = current.expense - previous.expense
      const percent = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(Math.abs(delta / previous.expense * 100))
      const changes = current.categories.map((item) => ({ ...item, change: item.value - (previous.categories.find((old) => old.name === item.name)?.value || 0) })).sort((a, b) => b.change - a.change)
      insight = delta === 0 ? 'Pengeluaran sama dengan bulan sebelumnya.' : `Pengeluaran ${delta > 0 ? 'naik' : 'turun'} ${percent}% dari ${monthLabel(previousPeriod).split(' ')[0]}.`
      if (delta > 0 && changes[0]?.change > 0) insight += ` Kenaikan terbesar: ${safeName(changes[0].name)}.`
    } else {
      const largest = current.categories.find((item) => item.value > 0)
      insight = largest ? `Pengeluaran terbesar: ${safeName(largest.name)} (${rupiah(largest.value)}).` : 'Belum ada pengeluaran bersih positif yang tercatat.'
    }
  }
  const upcoming = upcomingRecurring(recurringTransactions, today).find((item) => item.type !== 'Pemasukan rutin')
  const reminder = upcoming ? `📅 ${dateLabel(upcoming.dueDate)}: ${safeName(upcoming.name || upcoming.title)} ${rupiah(amount(upcoming.amount))}.` : ''
  const text = [`📊 *Keuangan ${monthLabel(period)}*`, '', `💰 Pemasukan: ${rupiah(current.income)}`, `💸 Pengeluaran: ${rupiah(current.expense)}`, `↔️ Selisih: ${current.net > 0 ? '+' : ''}${rupiah(current.net)}`, '', insight, ...(reminder ? ['', reminder] : []), '', 'Balas *detail* untuk rincian.', '_Berdasarkan transaksi tercatat._'].join('\n')
  return { period, label: monthLabel(period), ...current, previous, insight, upcoming: upcoming || null, text }
}

export function monthlyReportDetails(report) {
  return [`📊 *Rincian ${report.label}*`, '', `Pemasukan: ${rupiah(report.income)}`, `Pengeluaran bersih: ${rupiah(report.expense)}`, `Selisih: ${rupiah(report.net)}`, '', ...report.categories.slice(0, 8).map((item) => `• ${safeName(item.name)}: ${rupiah(item.value)}`), ...(report.categories.length > 8 ? [`• Kategori lainnya: ${rupiah(report.categories.slice(8).reduce((sum, item) => sum + item.value, 0))}`] : []), '', report.insight, '', '_Refund mengurangi pengeluaran. Transfer antar-akun dikecualikan, kecuali biaya admin. Selisih bukan saldo atau tabungan._', 'Rincian lengkap tersedia di menu Laporan FinanceMy.'].join('\n')
}

export function assistantPreferences(settings = {}) {
  return { monthlyReport: settings.monthlyReport === true, recurringReminder: settings.recurringReminder === true, reminderDays: [0, 3, 7].includes(settings.reminderDays) ? settings.reminderDays : 7 }
}

export function notificationCandidates(data, settings, now = new Date()) {
  const prefs = assistantPreferences(settings)
  const today = jakartaDateKey(now)
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hourCycle: 'h23' }).format(now))
  if (hour < 9 || hour >= 21) return []
  const candidates = []
  const day = Number(today.slice(-2))
  if (prefs.monthlyReport && day <= 3) {
    const period = monthOffset(today.slice(0, 7), -1)
    const report = buildMonthlyReport(data, period, today)
    if (report.count) candidates.push({ key: `monthly_${period}`, kind: 'monthly', period, text: report.text })
  }
  if (prefs.recurringReminder) {
    for (const item of upcomingRecurring(data.recurringTransactions || [], today, prefs.reminderDays)) {
      if (item.daysUntil !== prefs.reminderDays || !item.id) continue
      const incoming = item.type === 'Pemasukan rutin'
      candidates.push({ key: `recurring_${item.id}_${item.dueDate}`, kind: 'recurring', recurringId: item.id, dueDate: item.dueDate,
        text: [`📅 *${incoming ? 'Pengingat pemasukan rutin' : 'Pengingat transaksi rutin'}*`, '', `${safeName(item.name || item.title)} · ${rupiah(amount(item.amount))}`, `${item.daysUntil === 0 ? 'Jatuh tempo hari ini' : `Jatuh tempo ${item.daysUntil} hari lagi`} (${dateLabel(item.dueDate)}).`, '', incoming ? 'Catat penerimaannya di FinanceMy setelah dana masuk.' : 'Siapkan dananya, lalu catat pembayaran di FinanceMy setelah dibayar.'].join('\n') })
    }
  }
  return candidates
}
