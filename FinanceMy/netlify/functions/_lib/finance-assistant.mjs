import { parseWhatsAppDraft } from './whatsapp-draft.mjs'

const rupiah = new Intl.NumberFormat('id-ID')
const allowedTopics = new Set([
  'overview', 'accounts', 'budgets', 'debts', 'receivables', 'installments',
  'recurring', 'goals', 'transactions',
])

function jsonObject(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const parsed = JSON.parse(trimmed)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function validDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}

function textValue(value, max = 80) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

export function parseAssistantIntent(content, fallbackDate) {
  const result = jsonObject(content)
  if (result?.kind === 'transaction') {
    return { kind: 'transaction', draft: parseWhatsAppDraft(JSON.stringify(result), fallbackDate) }
  }
  if (result?.kind !== 'finance_query') return { kind: 'unsupported' }

  const requestedTopics = Array.isArray(result.topics) ? result.topics : [result.topic]
  const topics = [...new Set(requestedTopics.filter((topic) => allowedTopics.has(topic)))].slice(0, 4)
  if (!topics.length) return { kind: 'unsupported' }
  const transactionType = ['expense', 'income', 'transfer'].includes(result.transactionType)
    ? result.transactionType : 'all'
  return {
    kind: 'finance_query',
    plan: {
      topics,
      mode: ['list', 'summary', 'advice'].includes(result.mode) ? result.mode : 'summary',
      periodStart: validDateKey(result.periodStart),
      periodEnd: validDateKey(result.periodEnd),
      transactionType,
      category: textValue(result.category),
      account: textValue(result.account),
      search: textValue(result.search, 120),
    },
  }
}

function normalized(value) {
  return String(value || '').trim().toLocaleLowerCase('id-ID')
}

function number(value) {
  const result = Number(value)
  return Number.isFinite(result) ? result : 0
}

function money(value) {
  const amount = number(value)
  return `${amount < 0 ? '-' : ''}Rp${rupiah.format(Math.abs(Math.round(amount)))}`
}

function dateKey(value) {
  if (!value) return null
  if (typeof value === 'string') {
    const direct = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0]
    if (direct) return validDateKey(direct)
  }
  const date = typeof value?.toDate === 'function' ? value.toDate() : value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date?.getTime?.())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthBounds(today) {
  const [year, month] = today.split('-').map(Number)
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { start: `${year}-${String(month).padStart(2, '0')}-01`, end: `${year}-${String(month).padStart(2, '0')}-${last}` }
}

function periodLabel(start, end) {
  return start === end ? start : `${start} s.d. ${end}`
}

function itemDate(item) {
  return dateKey(item.transactionDate || item.date || item.createdAt)
}

function transactionCategory(item) {
  return item.categoryName || item.category || 'Lainnya'
}

function transactionAccount(item) {
  return item.accountName || item.account || 'Akun'
}

function expenseValue(item) {
  if (item.type === 'expense') return number(item.amount)
  if (item.type === 'refund') return -number(item.amount)
  if (item.type === 'transfer') return number(item.adminFee)
  return 0
}

function incomeValue(item) {
  return item.type === 'income' ? number(item.amount) : 0
}

function active(items) {
  return items.filter((item) => item.isActive !== false && normalized(item.status) !== 'lunas')
}

function searched(items, query, fields) {
  const needle = normalized(query)
  if (!needle) return items
  return items.filter((item) => fields.some((field) => normalized(field(item)).includes(needle)))
}

function limitedLines(items, render, limit = 12) {
  const visible = items.slice(0, limit).map(render)
  if (items.length > limit) visible.push(`• dan ${items.length - limit} data lainnya`)
  return visible
}

function budgetPeriodKey(item, today) {
  return item.periodKey || dateKey(item.createdAt)?.slice(0, 7) || today.slice(0, 7)
}

function currentBudgets(data, today) {
  const budgets = data.budgets.filter((item) => item.isActive !== false && budgetPeriodKey(item, today) === today.slice(0, 7))
  return budgets.map((budget) => {
    const spent = data.transactions.reduce((total, item) => {
      if (itemDate(item)?.slice(0, 7) !== today.slice(0, 7)) return total
      const hasBudgetId = Object.hasOwn(item, 'budgetId')
      const assigned = hasBudgetId
        ? item.budgetId === budget.id
        : budget.trackingMode !== 'manual' && transactionCategory(item) === budget.name
      return assigned ? total + expenseValue(item) : total
    }, 0)
    return { ...budget, spent: Math.max(spent, 0), remaining: number(budget.amount) - Math.max(spent, 0) }
  })
}

function accountsAnswer(data, plan) {
  let items = data.accounts.filter((item) => item.isActive !== false)
  items = searched(items, plan.search || plan.account, [(item) => item.name, (item) => item.type])
  if (!items.length) return 'Belum ada akun aktif yang cocok.'
  const total = items.reduce((sum, item) => sum + number(item.currentBalance), 0)
  return [`*Saldo akun*`, ...limitedLines(items, (item) => `• ${item.name}: ${money(item.currentBalance)}`), `Total: *${money(total)}*`].join('\n')
}

function budgetsAnswer(data, plan, today) {
  let items = currentBudgets(data, today)
  items = searched(items, plan.search, [(item) => item.name])
  if (!items.length) return `Belum ada budget ${plan.search ? `yang cocok dengan “${plan.search}” ` : ''}untuk ${today.slice(0, 7)}.`
  const amount = items.reduce((sum, item) => sum + number(item.amount), 0)
  const spent = items.reduce((sum, item) => sum + item.spent, 0)
  const lines = limitedLines(items, (item) => {
    const suffix = item.remaining < 0 ? ` (terlampaui ${money(-item.remaining)})` : ''
    return `• ${item.name}: sisa *${money(item.remaining)}* dari ${money(item.amount)}${suffix}`
  })
  return [`*Budget ${today.slice(0, 7)}*`, ...lines, `Total terpakai ${money(spent)} dari ${money(amount)}. Sisa *${money(amount - spent)}*.`].join('\n')
}

function obligationAnswer(title, items, plan) {
  let records = active(items).filter((item) => number(item.remaining) > 0)
  records = searched(records, plan.search, [(item) => item.name])
  if (!records.length) return `Belum ada ${title.toLocaleLowerCase('id-ID')} aktif${plan.search ? ' yang cocok' : ''}.`
  const remaining = records.reduce((sum, item) => sum + number(item.remaining), 0)
  const monthly = records.reduce((sum, item) => sum + number(item.monthly), 0)
  return [
    `*${title}*`,
    ...limitedLines(records, (item) => `• ${item.name}: sisa ${money(item.remaining)}${number(item.monthly) ? `, ${money(item.monthly)}/bulan` : ''}${item.due ? `, jatuh tempo ${dateKey(item.due) || item.due}` : ''}`),
    `Total sisa: *${money(remaining)}*${monthly ? `\nKewajiban per bulan: *${money(monthly)}*` : ''}`,
  ].join('\n')
}

function recurringAnswer(data, plan) {
  let items = data.recurringTransactions.filter((item) => item.isActive !== false)
  items = searched(items, plan.search, [(item) => item.name || item.title, (item) => item.type, (item) => item.categoryName])
  if (!items.length) return `Belum ada transaksi rutin aktif${plan.search ? ' yang cocok' : ''}.`
  items.sort((a, b) => String(dateKey(a.nextDate || a.date || a.dueDate) || '9999').localeCompare(String(dateKey(b.nextDate || b.date || b.dueDate) || '9999')))
  const expense = items.filter((item) => item.type !== 'Pemasukan rutin').reduce((sum, item) => sum + number(item.amount), 0)
  return [
    '*Transaksi rutin aktif*',
    ...limitedLines(items, (item) => `• ${item.name || item.title}: ${money(item.amount)} · ${item.frequency || 'Bulanan'} · berikutnya ${dateKey(item.nextDate || item.date || item.dueDate) || 'belum diatur'} · ${item.accountName || item.account || 'akun belum dipilih'}`),
    `Total nominal rutin pengeluaran: *${money(expense)}* per siklus masing-masing.`,
  ].join('\n')
}

function goalsAnswer(data, plan) {
  let items = data.goals.filter((item) => normalized(item.status) !== 'selesai')
  items = searched(items, plan.search, [(item) => item.name])
  if (!items.length) return `Belum ada target keuangan aktif${plan.search ? ' yang cocok' : ''}.`
  const saved = items.reduce((sum, item) => sum + number(item.saved), 0)
  const target = items.reduce((sum, item) => sum + number(item.target), 0)
  return [
    '*Target keuangan*',
    ...limitedLines(items, (item) => {
      const targetValue = number(item.target)
      const progress = targetValue ? Math.min(Math.round(number(item.saved) / targetValue * 100), 100) : 0
      return `• ${item.name}: ${money(item.saved)} dari ${money(targetValue)} (${progress}%)${item.deadline ? ` · target ${dateKey(item.deadline) || item.deadline}` : ''}`
    }),
    `Total terkumpul: *${money(saved)}* dari ${money(target)}.`,
  ].join('\n')
}

function transactionMatches(item, plan, start, end) {
  const date = itemDate(item)
  if (!date || date < start || date > end) return false
  if (plan.transactionType === 'expense' && !['expense', 'refund'].includes(item.type)) return false
  if (plan.transactionType === 'income' && item.type !== 'income') return false
  if (plan.transactionType === 'transfer' && item.type !== 'transfer') return false
  if (plan.category && !normalized(transactionCategory(item)).includes(normalized(plan.category))) return false
  if (plan.account && !normalized(transactionAccount(item)).includes(normalized(plan.account))) return false
  const query = normalized(plan.search)
  return !query || [item.title, transactionCategory(item), transactionAccount(item)].some((value) => normalized(value).includes(query))
}

function transactionsAnswer(data, plan, today) {
  const month = monthBounds(today)
  const start = plan.periodStart || month.start
  const end = plan.periodEnd || month.end
  if (start > end) return 'Rentang tanggal pertanyaan tidak valid.'
  const items = data.transactions.filter((item) => transactionMatches(item, plan, start, end))
    .sort((a, b) => String(itemDate(b) || '').localeCompare(String(itemDate(a) || '')))
  if (!items.length) return `Tidak ada transaksi yang cocok pada ${periodLabel(start, end)}.`
  if (plan.mode === 'list') {
    return [
      `*Transaksi ${periodLabel(start, end)}*`,
      ...limitedLines(items, (item) => {
        const sign = item.type === 'income' || item.type === 'refund' ? '+' : '-'
        return `• ${itemDate(item)} · ${item.title || 'Transaksi'} · ${sign}${money(item.amount)} · ${transactionAccount(item)}`
      }, 10),
    ].join('\n')
  }
  const income = items.reduce((sum, item) => sum + incomeValue(item), 0)
  const expense = items.reduce((sum, item) => sum + expenseValue(item), 0)
  const categories = new Map()
  for (const item of items) {
    const value = expenseValue(item)
    if (value) categories.set(transactionCategory(item), Math.max((categories.get(transactionCategory(item)) || 0) + value, 0))
  }
  const top = [...categories.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const typeLine = plan.transactionType === 'income'
    ? `Total pemasukan: *${money(income)}*`
    : plan.transactionType === 'expense'
      ? `Total pengeluaran: *${money(expense)}*`
      : `Pemasukan: *${money(income)}*\nPengeluaran: *${money(expense)}*\nSelisih: *${money(income - expense)}*`
  return [`*Ringkasan ${periodLabel(start, end)}*`, `${items.length} transaksi`, typeLine, ...(top.length ? ['Kategori pengeluaran terbesar:', ...top.map(([name, value]) => `• ${name}: ${money(value)}`)] : [])].join('\n')
}

function overviewAnswer(data, today) {
  const month = monthBounds(today)
  const current = data.transactions.filter((item) => {
    const date = itemDate(item)
    return date && date >= month.start && date <= month.end
  })
  const income = current.reduce((sum, item) => sum + incomeValue(item), 0)
  const expense = current.reduce((sum, item) => sum + expenseValue(item), 0)
  const balance = data.accounts.filter((item) => item.isActive !== false).reduce((sum, item) => sum + number(item.currentBalance), 0)
  const budgets = currentBudgets(data, today)
  const budgetAmount = budgets.reduce((sum, item) => sum + number(item.amount), 0)
  const budgetSpent = budgets.reduce((sum, item) => sum + item.spent, 0)
  const obligations = [...active(data.debts), ...active(data.installments)].reduce((sum, item) => sum + number(item.remaining), 0)
  const notes = []
  if (expense > income && income > 0) notes.push(`Pengeluaran bulan ini lebih besar ${money(expense - income)} daripada pemasukan.`)
  const exceeded = budgets.filter((item) => item.remaining < 0)
  if (exceeded.length) notes.push(`${exceeded.length} budget sudah terlampaui: ${exceeded.map((item) => item.name).join(', ')}.`)
  return [
    `*Ringkasan keuangan ${today.slice(0, 7)}*`,
    `Saldo aktif: *${money(balance)}*`,
    `Pemasukan: ${money(income)}`,
    `Pengeluaran: ${money(expense)}`,
    `Arus kas: *${money(income - expense)}*`,
    budgets.length ? `Sisa budget: *${money(budgetAmount - budgetSpent)}*` : 'Budget: belum dibuat bulan ini',
    `Sisa utang & cicilan: *${money(obligations)}*`,
    ...(notes.length ? ['', '*Catatan*', ...notes.map((note) => `• ${note}`)] : []),
  ].join('\n')
}

export function answerFinanceQuery(plan, data, today) {
  const answers = plan.topics.map((topic) => {
    if (topic === 'overview') return overviewAnswer(data, today)
    if (topic === 'accounts') return accountsAnswer(data, plan)
    if (topic === 'budgets') return budgetsAnswer(data, plan, today)
    if (topic === 'debts') return obligationAnswer('Utang aktif', data.debts, plan)
    if (topic === 'receivables') return obligationAnswer('Piutang aktif', data.receivables, plan)
    if (topic === 'installments') return obligationAnswer('Cicilan aktif', data.installments, plan)
    if (topic === 'recurring') return recurringAnswer(data, plan)
    if (topic === 'goals') return goalsAnswer(data, plan)
    return transactionsAnswer(data, plan, today)
  })
  const result = answers.join('\n\n').slice(0, 3900)
  return `${result}\n\nData dibaca dari FinanceMy pada ${today}.`
}

