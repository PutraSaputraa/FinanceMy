import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { formatCurrency, formatDate } from '../../utils/formatters'
import { recurringDueDate, recurringTransactionType } from '../../utils/recurring'

export default function RecurringPaymentForm({ item, accounts, onPay, onDone }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  const availableAccounts = accounts.filter((account) => account.isActive !== false)
  const selectedAccount = availableAccounts.find((account) => account.id === item.accountId || account.name === item.accountName || account.name === item.account)
  const income = recurringTransactionType(item.type) === 'income'
  const due = recurringDueDate(item)

  const submit = async (event) => {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError('')
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget))
      await onPay(item.id, due, values.accountId, Number(values.amount))
      onDone()
    } catch (payError) {
      setError(payError.message || 'Pencatatan gagal. Coba lagi.')
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return <form className="finance-form" onSubmit={submit}>
    <p className="form-note">Jatuh tempo {formatDate(`${due}T12:00:00`, 'd MMMM yyyy')}. Transaksi akan dicatat pada tanggal pembayaran, {format(new Date(), 'd MMMM yyyy')}.</p>
    <div className="form-grid">
      <label>Nominal (Rp)<input name="amount" type="number" min="1" step="1" required defaultValue={item.amount} /></label>
      <label>{income ? 'Akun penerima' : 'Sumber dana'}<select name="accountId" required defaultValue={selectedAccount?.id || availableAccounts[0]?.id || ''} disabled={!availableAccounts.length}>{availableAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {formatCurrency(account.currentBalance)}</option>)}</select></label>
    </div>
    <p className="form-note">{income ? 'Setelah dicatat, saldo akun bertambah.' : 'Setelah dibayar, saldo akun berkurang dan pengeluaran masuk ke Transaksi serta budget kategorinya.'} Jatuh tempo akan maju satu periode.</p>
    {!availableAccounts.length && <p className="form-feedback error">Tidak ada akun aktif untuk pencatatan ini.</p>}
    {error && <p className="form-feedback error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="secondary-btn" onClick={onDone} disabled={busy}>Batal</button><button className="primary-btn" disabled={busy || !availableAccounts.length}>{busy ? 'Mencatat...' : income ? 'Catat pemasukan' : 'Bayar sekarang'}</button></div>
  </form>
}
