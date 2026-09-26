import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, Filter, Plus, Search, SlidersHorizontal } from 'lucide-react'
import PageTitle from '../../components/common/PageTitle'
import Modal from '../../components/common/Modal'
import TransactionForm from '../../components/forms/TransactionForm'
import TransactionItem from '../../components/transactions/TransactionItem'
import { useFinance } from '../../context/FinanceContext'
import { getMonthInfo, toDate } from '../../utils/analytics'
import { budgetIdForTransaction, budgetsForDate } from '../../utils/budgets'
import { formatCurrency } from '../../utils/formatters'

export default function TransactionsPage() {
  const [params, setParams] = useSearchParams()
  const [localOpen, setLocalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deletingBusy, setDeletingBusy] = useState(false)
  const [query, setQuery] = useState(params.get('search') || '')
  const [type, setType] = useState('all')
  const { transactions, budgetRecords, removeTransaction } = useFinance()
  const open = localOpen || params.get('add') === 'true'
  const month = getMonthInfo()
  const closeAdd = () => { setLocalOpen(false); setParams({}) }
  const filtered = useMemo(() => transactions.filter((transaction) =>
    (type === 'all' || transaction.type === type) &&
    `${transaction.title} ${transaction.category} ${transaction.account} ${(transaction.tags || []).join(' ')}`.toLowerCase().includes(query.toLowerCase()),
  ), [transactions, query, type])
  const transactionBudgetName = (transaction) => {
    const date = toDate(transaction.transactionDate || transaction.date)
    if (!date) return null
    const budgets = budgetsForDate(budgetRecords, date)
    const budgetId = budgetIdForTransaction(transaction, budgets)
    return budgets.find((budget) => budget.id === budgetId)?.name || null
  }
  const exportCsv = () => {
    const content = ['Nama,Jenis,Kategori,Akun,Nominal,Tanggal', ...transactions.map((transaction) =>
      [transaction.title, transaction.type, transaction.category, transaction.account, transaction.amount, transaction.date].join(','),
    )].join('\n')
    const blob = new Blob([content], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'transaksi-financemy.csv'
    link.click()
    URL.revokeObjectURL(url)
  }
  const confirmDelete = async () => {
    if (deletingBusy || !deleting) return
    setDeletingBusy(true)
    setDeleteError('')
    try {
      await removeTransaction(deleting.id)
      setDeleting(null)
    } catch (error) {
      setDeleteError(error.message || 'Transaksi gagal dihapus. Coba lagi.')
    } finally {
      setDeletingBusy(false)
    }
  }

  return <>
    <PageTitle eyebrow="CATATAN KEUANGAN" title="Transaksi" subtitle={`${filtered.length} transaksi pada ${month.label}`} action={<div className="page-actions"><button className="secondary-btn" onClick={exportCsv}><Download/>Ekspor</button><button className="primary-btn" onClick={() => setLocalOpen(true)}><Plus/>Tambah transaksi</button></div>}/>
    <section className="card filter-card"><label className="search-box page-search"><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari transaksi..."/></label><div className="filter-tabs">{[['all', 'Semua'], ['income', 'Pemasukan'], ['expense', 'Pengeluaran'], ['transfer', 'Transfer']].map(([value, label]) => <button key={value} className={type === value ? 'active' : ''} onClick={() => setType(value)}>{label}</button>)}</div><button className="secondary-btn filter-more"><SlidersHorizontal/>Filter</button></section>
    <section className="transaction-stats"><article><span>Total pemasukan</span><strong className="income">+{formatCurrency(transactions.filter((transaction) => transaction.type === 'income').reduce((sum, transaction) => sum + transaction.amount, 0))}</strong></article><article><span>Total pengeluaran</span><strong className="expense">−{formatCurrency(transactions.filter((transaction) => transaction.type === 'expense').reduce((sum, transaction) => sum + transaction.amount, 0))}</strong></article><article><span>Transfer</span><strong>{formatCurrency(transactions.filter((transaction) => transaction.type === 'transfer').reduce((sum, transaction) => sum + transaction.amount, 0))}</strong></article></section>
    <section className="card transactions-card"><div className="transaction-table-head"><span>TRANSAKSI</span><span>TANGGAL</span><span>NOMINAL</span><span>AKSI</span></div>{filtered.length ? filtered.map((transaction) => <TransactionItem key={transaction.id} transaction={transaction} budgetName={transactionBudgetName(transaction)} onEdit={setEditing} onDelete={(item) => { setDeleting(item); setDeleteError('') }}/>) : <div className="empty-state"><Filter/><h3>Belum ada transaksi</h3><p>Coba ubah filter atau tambahkan transaksi baru.</p></div>}</section>
    <Modal open={open} onClose={closeAdd} title="Tambah transaksi" description="Catat aktivitas keuangan secara manual." size="wide"><TransactionForm onDone={closeAdd}/></Modal>
    <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit transaksi" description="Perubahan nominal atau akun akan memperbarui saldo terkait." size="wide">{editing && <TransactionForm key={editing.id} transaction={editing} onDone={() => setEditing(null)}/>}</Modal>
    <Modal open={!!deleting} onClose={() => !deletingBusy && setDeleting(null)} title={`Hapus transaksi ${deleting?.title || ''}?`} description="Saldo akun dan perhitungan budget akan diperbarui.">
      <div className="confirm-account-action"><p>Transaksi yang dihapus tidak dapat dipulihkan.</p>{deleteError && <p className="form-feedback error" role="alert">{deleteError}</p>}<div className="form-actions"><button className="secondary-btn" onClick={() => setDeleting(null)} disabled={deletingBusy}>Batal</button><button className="danger-btn" onClick={confirmDelete} disabled={deletingBusy}>{deletingBusy ? 'Menghapus...' : 'Hapus transaksi'}</button></div></div>
    </Modal>
  </>
}
