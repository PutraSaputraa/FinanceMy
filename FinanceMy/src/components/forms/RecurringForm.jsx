import { useState } from 'react'
import { format } from 'date-fns'
import { recurringCategory, recurringDueDate } from '../../utils/recurring'
import { useFinance } from '../../context/FinanceContext'
import { categoryNames } from '../../utils/taxonomy'

export default function RecurringForm({ item, accounts, onSave, onDone }) {
  const { categories: allCategories } = useFinance()
  const [type, setType] = useState(item?.type || 'Langganan')
  const [category, setCategory] = useState(() => {
    const names = categoryNames(allCategories, item?.type === 'Pemasukan rutin' ? 'income' : 'expense')
    const preferred = recurringCategory(item?.type || 'Langganan', item?.categoryName || item?.category)
    return item || names.includes(preferred) ? preferred : names[0]
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const availableAccounts = accounts.filter((account) => account.isActive !== false)
  const selectedAccount = availableAccounts.find((account) => account.id === item?.accountId || account.name === item?.accountName || account.name === item?.account)
  const categories = categoryNames(allCategories, type === 'Pemasukan rutin' ? 'income' : 'expense')
  const retained = item?.type === type ? item.categoryName || item.category : null
  const categoryOptions = retained && !categories.includes(retained) ? [retained, ...categories] : categories
  const selectedCategory = categoryOptions.includes(category) ? category : categoryOptions[0]

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget))
      await onSave({ ...values, type, categoryName: selectedCategory })
      onDone()
    } catch (saveError) {
      setError(saveError.message || 'Jadwal gagal disimpan. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return <form className="finance-form" onSubmit={submit}>
    <p className="form-note">Jadwal ini menjadi pengingat. Saldo baru berubah setelah kamu mencatat pembayaran secara manual.</p>
    <div className="form-grid">
      <label>Nama<input name="name" required maxLength="120" defaultValue={item?.name || item?.title || ''} placeholder="Contoh: Internet rumah" /></label>
      <label>Jenis<select name="type" value={type} onChange={(event) => {
        const next = event.target.value
        setType(next)
        const names = categoryNames(allCategories, next === 'Pemasukan rutin' ? 'income' : 'expense')
        setCategory(names.includes(recurringCategory(next)) ? recurringCategory(next) : names[0])
      }}><option>Langganan</option><option>Tagihan</option><option>Cicilan</option><option>Pemasukan rutin</option></select></label>
      <label>Nominal (Rp)<input name="amount" required type="number" min="1" step="1" defaultValue={item?.amount || ''} /></label>
      <label>Frekuensi<select name="frequency" defaultValue={item?.frequency || 'Bulanan'}><option>Bulanan</option><option>Mingguan</option><option>Tahunan</option></select></label>
      <label>Tanggal jatuh tempo berikutnya<input name="nextDate" type="date" required defaultValue={recurringDueDate(item) || format(new Date(), 'yyyy-MM-dd')} /></label>
      <label>{type === 'Pemasukan rutin' ? 'Akun penerima bawaan' : 'Sumber dana bawaan'}<select name="accountId" required defaultValue={selectedAccount?.id || availableAccounts[0]?.id || ''} disabled={!availableAccounts.length}>{availableAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      <label>Kategori<select name="categoryName" value={selectedCategory} onChange={(event) => setCategory(event.target.value)}>{categoryOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
    </div>
    {!availableAccounts.length && <p className="form-feedback error">Buat akun keuangan terlebih dahulu sebelum menyimpan jadwal.</p>}
    {error && <p className="form-feedback error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="secondary-btn" onClick={onDone} disabled={busy}>Batal</button><button className="primary-btn" disabled={busy || !availableAccounts.length}>{busy ? 'Menyimpan...' : item ? 'Simpan perubahan' : 'Simpan jadwal'}</button></div>
  </form>
}
