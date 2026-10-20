import { transactionDateKey, transactionTime } from './transactionHistory.js'

export function encodeCsv(rows) {
  return '\uFEFF' + rows.map((row) => row.map((value) => {
    let text = String(value ?? '')
    // Spreadsheet apps must treat user-entered names and notes as text.
    if (typeof value === 'string' && /^[\s\uFEFF]*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }).join(',')).join('\r\n')
}

const typeLabels = { income: 'Pemasukan', expense: 'Pengeluaran', refund: 'Refund', transfer: 'Transfer', adjustment: 'Penyesuaian' }
export function transactionCsvRows(items) {
  return [
    ['Tanggal', 'Waktu (WIB)', 'Nama', 'Jenis', 'Kategori', 'Akun', 'Akun tujuan', 'Nominal (Rp)', 'Biaya admin (Rp)', 'Tag', 'Catatan'],
    ...items.map((item) => [transactionDateKey(item) || '', transactionTime(item), item.title, typeLabels[item.type] || item.type, item.categoryName || item.category, item.accountName || item.account, item.destinationAccountName || item.destinationAccount, Number(item.amount || 0), Number(item.adminFee || 0), (item.tags || []).join('; '), item.note]),
  ]
}

export function downloadCsv(filename, rows) {
  const url = URL.createObjectURL(new Blob([encodeCsv(rows)], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
