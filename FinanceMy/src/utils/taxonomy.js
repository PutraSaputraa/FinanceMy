const colors = ['#087f5b', '#2271b3', '#8b5cf6', '#e08a17']
const expenseNames = ['Makan & Minum', 'Transportasi', 'Belanja', 'Kebutuhan Rumah', 'Tagihan', 'Langganan', 'Hiburan', 'Pengeluaran Lainnya']
const incomeNames = ['Gaji', 'Freelance', 'Bonus', 'Refund', 'Pemasukan lainnya']

export const defaultCategories = [
  ...expenseNames.map((name, index) => ({ id: `expense_${index}`, name, type: 'expense', color: colors[index % colors.length], isDefault: true, isActive: true })),
  ...incomeNames.map((name, index) => ({ id: `income_${index}`, name, type: 'income', color: colors[index % colors.length], isDefault: true, isActive: true })),
]

export function normalizedName(value) {
  return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('id-ID')
}

export function mergeCategories(records = []) {
  return [...defaultCategories.map((item) => ({ ...item, isActive: records.find((record) => record.id === item.id)?.isActive !== false })),
    ...records.filter((item) => !defaultCategories.some((entry) => entry.id === item.id))]
}

export function categoryNames(categories, type = 'expense', retained = '') {
  const names = categories.filter((item) => item.type === (type === 'income' ? 'income' : 'expense') && item.isActive !== false).map((item) => item.name)
  return retained && !names.includes(retained) ? [retained, ...names] : names
}

export function taxonomyRecord(values, existing, kind = 'category') {
  const name = String(values.name || '').normalize('NFKC').trim().replace(/\s+/g, ' ')
  if (!name || name.length > 40 || /[\p{Cc}\p{Cf}]/u.test(name)) throw new Error('Nama harus berisi 1–40 karakter tanpa karakter kontrol.')
  const type = kind === 'tag' ? 'tag' : values.type
  if (!['expense', 'income', 'tag'].includes(type)) throw new Error('Jenis kategori tidak valid.')
  if (existing.some((item) => (kind === 'tag' || item.type === type) && normalizedName(item.name) === normalizedName(name))) {
    throw new Error('Nama ini sudah tersedia. Aktifkan kembali jika sedang nonaktif.')
  }
  return { id: `custom_${type}_${encodeURIComponent(normalizedName(name))}`, name, type, color: /^#[\da-f]{6}$/i.test(values.color) ? values.color : colors[0], isDefault: false, isActive: true }
}
