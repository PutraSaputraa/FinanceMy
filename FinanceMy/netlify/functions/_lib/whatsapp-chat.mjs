import { expenseCategories, incomeCategories } from './whatsapp-draft.mjs'

const rupiah = new Intl.NumberFormat('id-ID')

export function chatCommand(text) {
  const value = typeof text === 'string' ? text.trim() : ''
  if (/^(submit|catat)$/i.test(value)) return { kind: 'submit' }
  if (/^(batal|batalkan)$/i.test(value)) return { kind: 'cancel' }
  const revision = value.match(/^revisi(?:\s+|:)(.+)$/i)
  if (revision) return { kind: 'revise', text: revision[1].trim() }
  if (/^revisi$/i.test(value)) return { kind: 'revise', text: '' }
  return { kind: 'other' }
}

export function simpleRevision(parsed, text) {
  const value = String(text || '').trim()
  let match = value.match(/^akun(?: sumber dana)?\s+(.+)$/i)
  if (match) return { ...parsed, accountHint: match[1].trim().slice(0, 80) }
  if (/^tanpa budget$/i.test(value)) return { ...parsed, budgetHint: '' }
  match = value.match(/^budget\s+(.+)$/i)
  if (match) return { ...parsed, budgetHint: match[1].trim().slice(0, 80) }
  match = value.match(/^nominal\s+(?:rp\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+)(?:\s*(ribu|rb|k|juta|jt))?$/i)
  if (match) {
    const multiplier = /^(ribu|rb|k)$/i.test(match[2] || '') ? 1000 : /^(juta|jt)$/i.test(match[2] || '') ? 1_000_000 : 1
    const amount = Number(match[1].replace(/[.,]/g, '')) * multiplier
    return Number.isSafeInteger(amount) && amount > 0 && amount <= 1_000_000_000_000 ? { ...parsed, amount } : null
  }
  match = value.match(/^(?:nama|judul)\s+(.+)$/i)
  if (match) return { ...parsed, title: match[1].trim().slice(0, 120) }
  match = value.match(/^tanggal\s+(\d{4}-\d{2}-\d{2})$/i)
  if (match) {
    const date = new Date(`${match[1]}T12:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === match[1] ? { ...parsed, date: match[1] } : null
  }
  match = value.match(/^kategori\s+(.+)$/i)
  if (match) {
    const categories = parsed.type === 'income' ? incomeCategories : expenseCategories
    const category = categories.find((item) => normalized(item) === normalized(match[1]))
    return category ? { ...parsed, category } : null
  }
  return null
}

function normalized(value) { return String(value || '').trim().toLocaleLowerCase('id-ID') }

function matchByName(items, hint) {
  const query = normalized(hint)
  if (!query) return null
  const exact = items.find((item) => normalized(item.name) === query)
  if (exact) return exact
  const partial = items.filter((item) => normalized(item.name).includes(query) || query.includes(normalized(item.name)))
  return partial.length === 1 ? partial[0] : null
}

export function resolveDraftChoices(parsed, accounts, budgets) {
  const activeAccounts = accounts.filter((item) => item.isActive !== false)
  const account = parsed?.accountHint
    ? matchByName(activeAccounts, parsed.accountHint)
    : activeAccounts.length === 1 ? activeAccounts[0] : null
  const activeBudgets = budgets.filter((item) => item.isActive !== false && (item.periodKey || item.createdAt?.toDate?.().toISOString().slice(0, 7)) === parsed?.date?.slice(0, 7))
  const budget = parsed?.budgetHint ? matchByName(activeBudgets, parsed.budgetHint) : null
  return { account, budget, activeAccounts, activeBudgets }
}

export function draftConfirmation(parsed, accounts, budgets) {
  const { account, budget, activeAccounts } = resolveDraftChoices(parsed, accounts, budgets)
  const amount = Number.isSafeInteger(parsed?.amount) && parsed.amount > 0 ? `Rp${rupiah.format(parsed.amount)}` : 'belum jelas'
  const type = parsed?.type === 'income' ? 'Pemasukan' : 'Pengeluaran'
  const accountLabel = account?.name || `belum dipilih${parsed?.accountHint ? ` (tertulis: ${parsed.accountHint})` : ''}`
  const budgetLabel = parsed?.budgetHint ? budget?.name || `tidak ditemukan (${parsed.budgetHint})` : 'tanpa budget'
  const accountHelp = !account && activeAccounts.length ? `\nPilihan akun: ${activeAccounts.slice(0, 8).map((item) => item.name).join(', ')}.` : ''
  return `Draf FinanceMy\nJenis: ${type}\nNama: ${parsed?.title || 'belum jelas'}\nNominal: ${amount}\nAkun: ${accountLabel}\nKategori: ${parsed?.category || 'belum jelas'}\nBudget: ${budgetLabel}\nTanggal: ${parsed?.date || 'belum jelas'}${accountHelp}\n\nBalas SUBMIT untuk mencatat, REVISI diikuti perubahan (contoh: REVISI akun BCA), atau BATAL. Saldo baru berubah setelah SUBMIT.`
}

export function chatTransactionValues(parsed, accounts, budgets, time) {
  if (!['expense', 'income'].includes(parsed?.type) || !parsed.title || !Number.isSafeInteger(parsed.amount) || parsed.amount <= 0) {
    return { error: 'Nama atau nominal belum jelas. Balas REVISI diikuti koreksinya.' }
  }
  if (typeof parsed.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.date)) {
    return { error: 'Tanggal belum jelas. Balas REVISI tanggal, misalnya REVISI tanggal 2026-09-22.' }
  }
  const { account, budget, activeAccounts } = resolveDraftChoices(parsed, accounts, budgets)
  if (!account) {
    const list = activeAccounts.length ? ` Pilihan: ${activeAccounts.slice(0, 8).map((item) => item.name).join(', ')}.` : ' Tambahkan akun di web FinanceMy dahulu.'
    return { error: `Akun sumber dana belum cocok. Balas REVISI akun <nama>.${list}` }
  }
  if (parsed.budgetHint && !budget) return { error: 'Budget yang disebut belum cocok. Balas REVISI budget <nama>, atau REVISI tanpa budget.' }
  const transactionDate = new Date(`${parsed.date}T${time}:00+07:00`)
  if (Number.isNaN(transactionDate.getTime())) return { error: 'Tanggal transaksi tidak valid. Balas REVISI tanggal.' }
  return {
    values: {
      type: parsed.type,
      title: parsed.title,
      amount: parsed.amount,
      accountId: account.id,
      category: parsed.category,
      budgetId: budget?.id || null,
      date: parsed.date,
      time,
      needType: 'kebutuhan',
      note: '',
      transactionDate,
    },
  }
}
