import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigationType } from 'react-router-dom'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Download, Plus, ReceiptText, Search, SlidersHorizontal, Wallet, X } from 'lucide-react'
import PageTitle from '../../components/common/PageTitle'
import DatePeriodFilter from '../../components/common/DatePeriodFilter'
import Modal from '../../components/common/Modal'
import TransactionForm from '../../components/forms/TransactionForm'
import TransactionItem from '../../components/transactions/TransactionItem'
import { useFinance } from '../../context/FinanceContext'
import { useTheme } from '../../context/ThemeContext'
import { toDate } from '../../utils/analytics'
import { jakartaDateKey } from '../../utils/assistantReports'
import { budgetIdForTransaction, budgetsForDate } from '../../utils/budgets'
import { downloadCsv, transactionCsvRows } from '../../utils/csvExport'
import { formatCurrency } from '../../utils/formatters'
import { useFilterParams } from '../../utils/useFilterParams'
import { expenseCategory, groupTransactionsByDay, inDateRange, periodFromParams, resolvePeriod, setPeriodParams, summarizeTransactions } from '../../utils/transactionHistory'
import './transactions.css'

export default function TransactionsPage() {
  const [params, setParams] = useFilterParams()
  const location = useLocation()
  const [localOpen, setLocalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deletingBusy, setDeletingBusy] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const searchInput = useRef(null)
  const navigationType = useNavigationType()
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }) }, [])
  const { transactions, budgetRecords, removeTransaction, today } = useFinance()
  const { hiddenAmounts } = useTheme()
  const dateKey = jakartaDateKey(today)
  const period = periodFromParams(params, dateKey)
  const range = resolvePeriod(period, { today: dateKey })
  const query = params.get('search') || ''
  const type = params.get('type') || 'all'
  const account = params.get('account') || ''
  const category = params.get('category') || ''
  const extraFilterCount = Number(Boolean(account)) + Number(type !== 'all')
  const reportSearch = typeof location.state?.reportSearch === 'string' ? location.state.reportSearch : setPeriodParams(new URLSearchParams(), period).toString()
  useEffect(() => {
    // Keep typing immediate while URL navigation renders in a transition.
    // External navigation and clearing filters still update the input.
    if (searchInput.current && (navigationType === 'POP' || document.activeElement !== searchInput.current)) searchInput.current.value = query
  }, [query, navigationType])
  const open = localOpen || params.get('add') === 'true'
  const changeParam = (key, value) => setParams((current) => {
    const next = new URLSearchParams(current)
    if (value) next.set(key, value)
    else next.delete(key)
    return next
  }, { replace: true })
  const closeAdd = () => { setLocalOpen(false); changeParam('add', '') }
  const filtered = transactions.filter((transaction) =>
    inDateRange(transaction, range) &&
    (type === 'all' || transaction.type === type || (type === 'expense' && transaction.type === 'refund')) &&
    (!account || (transaction.accountName || transaction.account) === account || (transaction.destinationAccountName || transaction.destinationAccount) === account) &&
    (!category || expenseCategory(transaction) === category) &&
    `${transaction.title || ''} ${transaction.categoryName || transaction.category || ''} ${transaction.accountName || transaction.account || ''} ${transaction.destinationAccountName || transaction.destinationAccount || ''} ${(transaction.tags || []).join(' ')} ${transaction.note || ''}`.toLocaleLowerCase('id').includes(query.trim().toLocaleLowerCase('id')),
  )
  const groups = groupTransactionsByDay(filtered, dateKey)
  const summary = summarizeTransactions(filtered)
  const accountNames = useMemo(() => [...new Set(transactions.flatMap((item) => [item.accountName || item.account, item.destinationAccountName || item.destinationAccount]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id')), [transactions])
  const money = (value) => hiddenAmounts ? '••••••' : formatCurrency(value)
  const transactionBudgetName = (transaction) => {
    const date = toDate(transaction.transactionDate || transaction.date)
    if (!date) return null
    const budgets = budgetsForDate(budgetRecords, date)
    const budgetId = budgetIdForTransaction(transaction, budgets)
    return budgets.find((budget) => budget.id === budgetId)?.name || null
  }
  const exportCsv = () => {
    downloadCsv(`transaksi-${range.start || 'semua'}${range.end ? `_${range.end}` : ''}.csv`, transactionCsvRows(groups.flatMap((group) => group.transactions)))
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

  return <div className="transactions-page">
    {category && <Link className="history-back-link" to={{ pathname: '/laporan', search: reportSearch }} state={{ monthlyReport: location.state?.monthlyReport }}><ArrowLeft size={15}/>Kembali ke laporan</Link>}
    <PageTitle eyebrow={category ? 'RINCIAN PENGELUARAN' : 'CATATAN KEUANGAN'} title={category ? 'Rincian kategori' : 'Transaksi'} subtitle={category ? `${category}${range.label ? ` · ${range.label}` : ''}` : 'Semua aktivitas keuanganmu, tersusun per hari.'} action={<div className="page-actions"><button className="secondary-btn" onClick={exportCsv} disabled={!filtered.length || Boolean(range.error)}><Download/>Ekspor CSV</button><button className="primary-btn" onClick={() => setLocalOpen(true)}><Plus/>Tambah transaksi</button></div>}/>
    <section className="card history-filters" aria-label="Filter transaksi">
      <DatePeriodFilter value={period} onChange={(patch) => setParams((current) => { const value = periodFromParams(current, dateKey); return setPeriodParams(current, { ...value, ...(typeof patch === 'function' ? patch(value) : patch) }) })} error={range.error}/>
      <div className="history-search-row">
        <label className="history-search"><Search size={17}/><input ref={searchInput} aria-label="Cari transaksi" defaultValue={query} onChange={(event) => changeParam('search', event.target.value)} placeholder="Cari transaksi..."/>{query && <button type="button" onClick={() => changeParam('search', '')} aria-label="Hapus pencarian"><X size={15}/></button>}</label>
        <button type="button" className="history-filter-toggle" aria-expanded={filtersOpen} aria-controls="history-extra-filters" onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={16}/>Filter{extraFilterCount > 0 && <span>{extraFilterCount}</span>}</button>
      </div>
      <div id="history-extra-filters" className={`history-extra-filters${filtersOpen ? ' is-open' : ''}`}>
        <label className="history-account"><Wallet size={16}/><select aria-label="Filter akun" value={account} onChange={(event) => changeParam('account', event.target.value)}><option value="">Semua akun</option>{accountNames.map((name) => <option key={name}>{name}</option>)}</select></label>
        <div className="history-types" role="group" aria-label="Jenis transaksi">{[['all', 'Semua'], ['income', 'Pemasukan'], ['expense', 'Pengeluaran'], ['transfer', 'Transfer'], ['adjustment', 'Penyesuaian']].map(([value, label]) => <button type="button" key={value} aria-pressed={type === value} className={type === value ? 'active' : ''} onClick={() => changeParam('type', value === 'all' ? '' : value)}>{label}</button>)}</div>
      </div>
      {category && <button className="history-filter-chip" onClick={() => changeParam('category', '')}>Kategori: {category}<X size={13}/><span className="sr-only">Hapus filter kategori</span></button>}
    </section>
    {!range.error && <>
      <section className="history-summary" aria-label="Ringkasan transaksi yang ditampilkan">
        <article><span className={`history-stat-icon ${category ? 'expense' : 'income'}`}>{category ? <ArrowUpRight size={18}/> : <ArrowDownLeft size={18}/>}</span><div><span>{category ? 'Sebelum refund' : 'Pemasukan'}</span><strong className={category ? 'expense' : 'income'}>{money(category ? summary.grossExpense + summary.transferFees : summary.income)}</strong></div></article>
        <article><span className={`history-stat-icon ${category ? 'income' : 'expense'}`}>{category ? <ArrowDownLeft size={18}/> : <ArrowUpRight size={18}/>}</span><div><span>{category ? 'Refund' : 'Pengeluaran bersih'}</span><strong className={category ? 'income' : 'expense'}>{money(category ? summary.refunds : summary.expense)}</strong></div></article>
        <article><span className="history-stat-icon net"><Wallet size={18}/></span><div><span>{category ? 'Pengeluaran bersih' : 'Arus kas bersih'}</span><strong>{money(category ? summary.expense : summary.net)}</strong></div></article>
      </section>
      <div className="history-results-head"><div><h2>{category ? `Transaksi ${category}` : 'Riwayat transaksi'}</h2><p>{range.label} <span>·</span> {filtered.length} transaksi <span>·</span> {groups.length} hari</p></div>{(query || account || category || type !== 'all') && <button className="history-clear" onClick={() => setParams((current) => { const next = new URLSearchParams(current); for (const key of ['search', 'account', 'category', 'type']) next.delete(key); return next }, { replace: true })}>Reset pencarian & filter</button>}</div>
      <div className="history-days">
        {groups.map((group) => <section className="card history-day" key={group.date || 'undated'} aria-label={group.subtitle}>
          <header className="history-day-header"><div><h3>{group.title}{group.date && (group.title === 'Hari ini' || group.title === 'Kemarin') && <time dateTime={group.date}>{group.subtitle.split(', ')[1]}</time>}</h3><span>{group.date && group.title !== 'Hari ini' && group.title !== 'Kemarin' ? group.subtitle.split(', ')[0] + ' · ' : ''}{group.transactions.length} transaksi</span></div><div className="history-day-total"><span>Pengeluaran bersih</span><strong>{money(group.summary.expense)}</strong></div></header>
          <div className="history-day-items">{group.transactions.map((transaction) => <TransactionItem key={transaction.id} grouped transaction={transaction} budgetName={transactionBudgetName(transaction)} onEdit={setEditing} onDelete={(item) => { setDeleting(item); setDeleteError('') }}/>)}</div>
        </section>)}
        {!filtered.length && <section className="card history-empty"><ReceiptText size={32}/><h3>{transactions.length ? 'Tidak ada transaksi yang cocok' : 'Mulai catatan keuanganmu'}</h3><p>{transactions.length ? 'Coba pilih periode lain atau ubah pencarian dan filter.' : 'Tambahkan transaksi pertamamu. Riwayat akan tersusun otomatis per hari.'}</p><button className="secondary-btn" onClick={() => setLocalOpen(true)}><Plus size={16}/>Tambah transaksi</button></section>}
      </div>
      <p className="history-footnote">Ringkasan mengikuti transaksi yang ditampilkan. Refund mengurangi pengeluaran; transfer hanya dihitung biaya adminnya. Penyesuaian saldo tidak masuk arus kas.</p>
    </>}
    <Modal open={open} onClose={closeAdd} title="Tambah transaksi" description="Catat aktivitas keuangan secara manual." size="wide"><TransactionForm onDone={closeAdd}/></Modal>
    <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit transaksi" description="Perubahan nominal atau akun akan memperbarui saldo terkait." size="wide">{editing && <TransactionForm key={editing.id} transaction={editing} onDone={() => setEditing(null)}/>}</Modal>
    <Modal open={!!deleting} onClose={() => !deletingBusy && setDeleting(null)} title={`Hapus transaksi ${deleting?.title || ''}?`} description="Saldo akun dan perhitungan budget akan diperbarui.">
      <div className="confirm-account-action"><p>Transaksi yang dihapus tidak dapat dipulihkan.</p>{deleteError && <p className="form-feedback error" role="alert">{deleteError}</p>}<div className="form-actions"><button className="secondary-btn" onClick={() => setDeleting(null)} disabled={deletingBusy}>Batal</button><button className="danger-btn" onClick={confirmDelete} disabled={deletingBusy}>{deletingBusy ? 'Menghapus...' : 'Hapus transaksi'}</button></div></div>
    </Modal>
  </div>
}
