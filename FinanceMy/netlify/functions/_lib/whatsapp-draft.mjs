export const expenseCategories = ['Makan & Minum', 'Transportasi', 'Belanja', 'Kebutuhan Rumah', 'Tagihan', 'Langganan', 'Hiburan', 'Pengeluaran Lainnya']
export const incomeCategories = ['Gaji', 'Freelance', 'Bonus', 'Refund', 'Pemasukan lainnya']

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

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function parseWhatsAppDraft(content, fallbackDate) {
  const result = jsonObject(content)
  if (result?.kind === 'ignore') return { status: 'ignored', parsed: null }

  const type = result?.type === 'income' ? 'income' : 'expense'
  const categories = type === 'income' ? incomeCategories : expenseCategories
  const amount = Number(result?.amount)
  const title = typeof result?.title === 'string' ? result.title.trim().slice(0, 120) : ''
  const category = categories.includes(result?.category) ? result.category : categories.at(-1)

  return {
    status: 'draft',
    parsed: {
      type,
      title,
      amount: Number.isFinite(amount) && amount > 0 && amount <= 1_000_000_000_000 ? amount : null,
      category,
      date: validDate(result?.date) ? result.date : fallbackDate,
      accountHint: typeof result?.accountHint === 'string' ? result.accountHint.trim().slice(0, 80) : '',
      budgetHint: typeof result?.budgetHint === 'string' ? result.budgetHint.trim().slice(0, 80) : '',
    },
  }
}
