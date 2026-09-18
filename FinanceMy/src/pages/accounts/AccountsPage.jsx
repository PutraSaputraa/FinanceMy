import { useState } from 'react'
import { Archive, ArrowDownLeft, ArrowRight, ArrowUpRight, Plus, RotateCcw, Scale } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AccountCard from '../../components/accounts/AccountCard'
import AccountForm from '../../components/forms/AccountForm'
import Modal from '../../components/common/Modal'
import PageTitle from '../../components/common/PageTitle'
import { useFinance } from '../../context/FinanceContext'
import { getPeriodSummary } from '../../utils/analytics'
import { formatCurrency } from '../../utils/formatters'

export default function AccountsPage() {
  const [open, setOpen] = useState(false)
  const [reconcile, setReconcile] = useState(null)
  const [actualBalance, setActualBalance] = useState('')
  const [reconcileError, setReconcileError] = useState('')
  const [reconcileSaving, setReconcileSaving] = useState(false)
  const [deactivating, setDeactivating] = useState(null)
  const { accounts, transactions, toggleAccountActive, reconcileBalance } = useFinance()
  const navigate = useNavigate()
  const activeAccounts = accounts.filter((account) => account.isActive !== false)
  const inactiveAccounts = accounts.filter((account) => account.isActive === false)
  const total = activeAccounts.reduce((sum, account) => sum + Number(account.currentBalance || 0), 0)
  const summary = getPeriodSummary(transactions)
  const currentAccount = accounts.find((account) => account.id === reconcile?.id) || reconcile
  const difference = Number(actualBalance) - Number(currentAccount?.currentBalance || 0)
  const validBalance = actualBalance !== '' && Number.isFinite(Number(actualBalance)) && Number(actualBalance) >= 0

  const startReconcile = (account) => {
    setReconcile(account)
    setActualBalance(String(account.currentBalance))
    setReconcileError('')
  }

  const saveReconcile = async (event) => {
    event.preventDefault()
    if (reconcileSaving) return
    if (!validBalance) {
      setReconcileError('Masukkan saldo nyata yang valid (minimal Rp0).')
      return
    }
    setReconcileSaving(true)
    setReconcileError('')
    try {
      await reconcileBalance(reconcile.id, actualBalance)
      setReconcile(null)
    } catch (error) {
      setReconcileError(error.message || 'Saldo gagal disimpan. Coba lagi.')
    } finally {
      setReconcileSaving(false)
    }
  }

  const renderAccount = (account) => {
    const accountTransactions = transactions.filter((transaction) => transaction.accountId === account.id || (!transaction.accountId && transaction.account === account.name))
    const accountIncome = accountTransactions.filter((transaction) => transaction.type === 'income').reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
    const accountExpense = accountTransactions.filter((transaction) => transaction.type === 'expense').reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0)
    return <article className={`account-detail-card card ${account.isActive === false ? 'account-inactive' : ''}`} key={account.id}>
      <AccountCard account={account}/>
      <div className="account-detail-stats"><span>Pemasukan<strong>{formatCurrency(accountIncome)}</strong></span><span>Pengeluaran<strong>{formatCurrency(accountExpense)}</strong></span></div>
      <div className="account-card-actions">
        {account.isActive === false
          ? <button onClick={() => toggleAccountActive(account.id, true)}><RotateCcw/>Aktifkan kembali</button>
          : <><button onClick={() => startReconcile(account)}><Scale/>Rekonsiliasi</button><button className="deactivate-account" onClick={() => setDeactivating(account)}><Archive/>Nonaktifkan</button></>}
        <button onClick={() => navigate(`/transaksi?search=${encodeURIComponent(account.name)}`)}>Riwayat <ArrowRight/></button>
      </div>
    </article>
  }

  return <>
    <PageTitle eyebrow="AKUN & DOMPET" title="Semua akun" subtitle="Pantau saldo dan aktivitas di setiap tempat uangmu tersimpan." action={<button className="primary-btn" onClick={() => setOpen(true)}><Plus/>Tambah akun</button>}/>
    <section className="account-overview card"><div><span>Total saldo aktif</span><strong>{formatCurrency(total)}</strong><small>{activeAccounts.length} akun aktif</small></div><div className="account-overview-stat"><i className="income"><ArrowDownLeft/></i><span>Pemasukan bulan ini<strong>{formatCurrency(summary.income)}</strong></span></div><div className="account-overview-stat"><i className="expense"><ArrowUpRight/></i><span>Pengeluaran bulan ini<strong>{formatCurrency(summary.expense)}</strong></span></div></section>
    {activeAccounts.length ? <div className="accounts-page-grid">{activeAccounts.map(renderAccount)}</div> : <div className="card empty-state"><Scale/><h3>Belum ada akun aktif</h3><p>Tambahkan akun baru atau aktifkan kembali akun lama.</p></div>}
    {inactiveAccounts.length > 0 && <section className="inactive-accounts"><div className="section-head"><div><h2>Akun nonaktif</h2><p>Tidak masuk saldo aktif dan tidak dapat dipakai untuk transaksi baru.</p></div></div><div className="accounts-page-grid">{inactiveAccounts.map(renderAccount)}</div></section>}
    <Modal open={open} onClose={() => setOpen(false)} title="Tambah akun" description="Pilih warna untuk mengenali akunmu."><AccountForm onDone={() => setOpen(false)}/></Modal>
    <Modal open={!!reconcile} onClose={() => !reconcileSaving && setReconcile(null)} title={`Rekonsiliasi ${currentAccount?.name || ''}`} description="Samakan saldo aplikasi dengan saldo nyata.">
      <form className="finance-form" onSubmit={saveReconcile}>
        <div className="reconcile-box"><span>Saldo aplikasi<strong>{formatCurrency(currentAccount?.currentBalance)}</strong></span><label>Saldo nyata<input type="number" min="0" step="1" required value={actualBalance} onChange={(event) => setActualBalance(event.target.value)} disabled={reconcileSaving}/></label></div>
        {validBalance && <p className="reconcile-difference">Selisih: <strong>{difference > 0 ? '+' : difference < 0 ? '−' : ''}{formatCurrency(Math.abs(difference))}</strong></p>}
        <p className="form-note">Selisih dicatat sebagai transaksi penyesuaian saldo. Pemasukan dan pengeluaran biasa tidak berubah.</p>
        {reconcileError && <p className="form-feedback error" role="alert">{reconcileError}</p>}
        <div className="form-actions"><button type="button" className="secondary-btn" onClick={() => setReconcile(null)} disabled={reconcileSaving}>Batal</button><button className="primary-btn" disabled={!validBalance || difference === 0 || reconcileSaving}>{reconcileSaving ? 'Menyimpan...' : 'Buat penyesuaian'}</button></div>
      </form>
    </Modal>
    <Modal open={!!deactivating} onClose={() => setDeactivating(null)} title={`Nonaktifkan ${deactivating?.name || ''}?`} description="Riwayat transaksi tetap tersimpan dan akun dapat diaktifkan kembali."><div className="confirm-account-action"><p>Akun ini tidak akan dihitung dalam total saldo dan tidak muncul saat membuat transaksi baru.</p><div className="form-actions"><button className="secondary-btn" onClick={() => setDeactivating(null)}>Batal</button><button className="danger-btn" onClick={async () => { await toggleAccountActive(deactivating.id, false); setDeactivating(null) }}><Archive/>Nonaktifkan akun</button></div></div></Modal>
  </>
}
