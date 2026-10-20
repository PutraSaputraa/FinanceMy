import { jakartaDateKey, monthLabel, monthOffset } from './assistantReports.js'

const dayMs = 86400000
const colors = ['#0b8f68', '#4386cb', '#db9c35', '#9875d6', '#dc7771', '#4ba8a1', '#84938b']
const dayFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' })
const shortFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const weekdayFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', weekday: 'long' })
const safeAmount = (value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0
const utcDate = (key) => new Date(`${key}T00:00:00Z`)

export const transactionDateKey = (item) => (item.date ? jakartaDateKey(item.date) : null) || (item.transactionDate ? jakartaDateKey(item.transactionDate) : null)
export const shiftDay = (key, days) => new Date(utcDate(key).getTime() + days * dayMs).toISOString().slice(0, 10)
export const daysBetween = (start, end) => Math.round((utcDate(end) - utcDate(start)) / dayMs) + 1
export const displayDay = (key, short = false) => key ? (short ? shortFormat : dayFormat).format(utcDate(key)) : 'Tanpa tanggal'
export const displayRange = (start, end) => start === end ? displayDay(start) : `${displayDay(start)} – ${displayDay(end)}`

export function monthBounds(period) {
  const next = monthOffset(period, 1)
  return { start: `${period}-01`, end: shiftDay(`${next}-01`, -1) }
}

export function periodFromParams(params, today, defaultMode = 'all') {
  return {
    mode: ['all', 'month', 'range'].includes(params.get('period')) ? params.get('period') : defaultMode,
    month: params.has('month') ? params.get('month') : today.slice(0, 7),
    start: params.has('start') ? params.get('start') : `${today.slice(0, 7)}-01`,
    end: params.has('end') ? params.get('end') : today,
  }
}

export function setPeriodParams(params, period) {
  const next = new URLSearchParams(params)
  for (const key of ['period', 'month', 'start', 'end']) next.delete(key)
  next.set('period', period.mode)
  if (period.mode === 'month') next.set('month', period.month)
  if (period.mode === 'range') { next.set('start', period.start); next.set('end', period.end) }
  return next
}

export function resolvePeriod(period, { today = jakartaDateKey(), throughToday = false } = {}) {
  if (period.mode === 'all') return { start: null, end: null, label: 'Semua waktu', error: '' }
  if (period.mode === 'month') {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period.month) || period.month < '1900-01' || period.month > '9998-12') return { error: 'Pilih bulan yang valid, dari Januari 1900 sampai Desember 9998.' }
    const bounds = monthBounds(period.month)
    if (throughToday && period.month === today.slice(0, 7)) bounds.end = today
    return { ...bounds, label: monthLabel(period.month), error: '' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period.start || '') || !/^\d{4}-\d{2}-\d{2}$/.test(period.end || '') || !jakartaDateKey(period.start) || !jakartaDateKey(period.end)) return { error: 'Isi tanggal mulai dan tanggal akhir yang valid.' }
  if (period.start < '1900-01-01' || period.end > '9998-12-31') return { error: 'Pilih tanggal antara tahun 1900 dan 9998.' }
  if (period.start > period.end) return { error: 'Tanggal akhir harus sama dengan atau setelah tanggal mulai.' }
  return { start: period.start, end: period.end, label: displayRange(period.start, period.end), error: '' }
}

export function inDateRange(item, range) {
  if (range.error) return false
  const date = transactionDateKey(item)
  if (!range.start && !range.end) return true
  return Boolean(date && (!range.start || date >= range.start) && (!range.end || date <= range.end))
}

export function transactionTime(item) {
  if (/^([01]\d|2[0-3]):[0-5]\d/.test(item.time || '')) return item.time.slice(0, 5)
  const value = item.transactionDate || (typeof item.date === 'string' && item.date.includes('T') ? item.date : null)
  if (!value) return ''
  const date = value?.toDate ? value.toDate() : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
}

export function expenseCategory(item) {
  if (item.type === 'transfer') return safeAmount(item.adminFee) > 0 ? 'Biaya admin transfer' : null
  if (item.type === 'expense' || item.type === 'refund') return item.categoryName || item.category || 'Pengeluaran Lainnya'
  return null
}

export function summarizeTransactions(items) {
  const summary = { income: 0, expense: 0, grossExpense: 0, refunds: 0, transferAmount: 0, transferFees: 0, transferCount: 0, adjustmentCount: 0, count: 0 }
  const categories = new Map()
  for (const item of items) {
    const amount = safeAmount(item.amount)
    let cost = 0
    if (item.type === 'income') { summary.income += amount; summary.count++ }
    if (item.type === 'expense') { summary.grossExpense += amount; cost = amount; summary.count++ }
    if (item.type === 'refund') { summary.refunds += amount; cost = -amount; summary.count++ }
    if (item.type === 'transfer') {
      cost = safeAmount(item.adminFee)
      summary.transferFees += cost
      summary.transferAmount += amount
      summary.transferCount++
      if (cost) summary.count++
    }
    if (item.type === 'adjustment') summary.adjustmentCount++
    summary.expense += cost
    if (cost) {
      const name = expenseCategory(item)
      categories.set(name, (categories.get(name) || 0) + cost)
    }
  }
  return {
    ...summary,
    net: summary.income - summary.expense,
    categories: [...categories].filter(([, value]) => value !== 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'id'))
      .map(([name, value], index) => ({ name, value, color: colors[index % colors.length] })),
  }
}

export function groupTransactionsByDay(items, today = jakartaDateKey()) {
  const groups = new Map()
  const sorted = [...items].sort((a, b) => (transactionDateKey(b) || '').localeCompare(transactionDateKey(a) || '') || transactionTime(b).localeCompare(transactionTime(a)) || String(b.id).localeCompare(String(a.id)))
  for (const item of sorted) {
    const key = transactionDateKey(item) || ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(item)
  }
  return [...groups].map(([date, transactions]) => ({
    date, transactions, summary: summarizeTransactions(transactions),
    title: date === today ? 'Hari ini' : date === shiftDay(today, -1) ? 'Kemarin' : displayDay(date),
    subtitle: date ? `${weekdayFormat.format(utcDate(date))}, ${displayDay(date)}` : 'Periksa kembali tanggal transaksi ini.',
  }))
}

export function comparisonPeriod(period, range, today = jakartaDateKey()) {
  if (range.error || period.mode === 'all') return null
  if (period.mode === 'month') {
    const previous = monthBounds(monthOffset(period.month, -1))
    if (period.month === today.slice(0, 7)) previous.end = previous.end.slice(0, 8) + String(Math.min(Number(today.slice(-2)), Number(previous.end.slice(-2)))).padStart(2, '0')
    return { ...previous, label: displayRange(previous.start, previous.end) }
  }
  const days = daysBetween(range.start, range.end)
  const end = shiftDay(range.start, -1)
  const start = shiftDay(range.start, -days)
  return { start, end, label: displayRange(start, end) }
}

export function reportRange(range, items) {
  if (range.error || range.start) return range
  const dates = items.map(transactionDateKey).filter(Boolean).sort()
  return { ...range, start: dates[0] || null, end: dates.at(-1) || null }
}

export function buildRangeSeries(items, range) {
  if (range.error || !range.start || !range.end) return { rows: [], unit: 'hari' }
  const days = daysBetween(range.start, range.end)
  const unit = days <= 45 ? 'hari' : days <= 100 ? 'minggu' : days <= 1096 ? 'bulan' : 'tahun'
  const buckets = []
  let start = range.start
  while (start <= range.end) {
    let end
    if (unit === 'hari') end = start
    else if (unit === 'minggu') end = shiftDay(start, 6)
    else if (unit === 'bulan') end = monthBounds(start.slice(0, 7)).end
    else end = `${start.slice(0, 4)}-12-31`
    end = end > range.end ? range.end : end
    const label = unit === 'bulan' ? monthLabel(start.slice(0, 7)).replace(/(\S{3})\S* (\d{4})/, '$1 $2') : unit === 'tahun' ? start.slice(0, 4) : displayDay(start, true)
    buckets.push({ start, end, label, income: 0, expense: 0, count: 0 })
    start = shiftDay(end, 1)
  }
  // Assign each transaction once, including zero-activity days in the series.
  for (const item of items) {
    const date = transactionDateKey(item)
    if (!date || date < range.start || date > range.end) continue
    const index = unit === 'hari' ? daysBetween(range.start, date) - 1 : unit === 'minggu' ? Math.floor((daysBetween(range.start, date) - 1) / 7) : buckets.findIndex((bucket) => date >= bucket.start && date <= bucket.end)
    const bucket = buckets[index]
    if (!bucket) continue
    const summary = summarizeTransactions([item])
    bucket.income += summary.income
    bucket.expense += summary.expense
    bucket.count += summary.count
  }
  let running = 0
  return { unit, rows: buckets.map((bucket) => {
    const net = bucket.income - bucket.expense
    running += net
    return { ...bucket, net, cumulative: running }
  }) }
}

export function transactionLink(range, extra = {}) {
  const params = new URLSearchParams()
  if (range.start && range.end) { params.set('period', 'range'); params.set('start', range.start); params.set('end', range.end) }
  for (const [key, value] of Object.entries(extra)) if (value) params.set(key, value)
  return `/transaksi${params.size ? `?${params}` : ''}`
}
