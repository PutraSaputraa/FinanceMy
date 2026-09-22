import { useState } from 'react'
import { CalendarDays, Plus, Sparkles, TrendingDown } from 'lucide-react'
import BudgetCard from '../../components/budgets/BudgetCard'
import BudgetForm from '../../components/forms/BudgetForm'
import Modal from '../../components/common/Modal'
import PageTitle from '../../components/common/PageTitle'
import ProgressBar from '../../components/common/ProgressBar'
import { useFinance } from '../../context/FinanceContext'
import { dailyBudgetSummary, todayBudgetExpense } from '../../utils/budgets'
import { getMonthInfo } from '../../utils/analytics'
import { formatCurrency } from '../../utils/formatters'

export default function BudgetsPage() {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [deletingBusy, setDeletingBusy] = useState(false)
  const { budgets, transactions, removeBudget } = useFinance()
  const month = getMonthInfo()
  const total = budgets.reduce((sum, budget) => sum + Number(budget.amount || 0), 0)
  const spent = budgets.reduce((sum, budget) => sum + Number(budget.spent || 0), 0)
  const todayExpense = todayBudgetExpense(transactions, budgets)
  const usage = total ? (spent / total) * 100 : 0
  const daily = dailyBudgetSummary(budgets, month, transactions)

  const confirmDelete = async () => {
    if (deletingBusy) return
    setDeletingBusy(true)
    setDeleteError('')
    try {
      await removeBudget(deleting.id)
      setDeleting(null)
    } catch (error) {
      setDeleteError(error.message || 'Budget gagal dihapus. Coba lagi.')
    } finally {
      setDeletingBusy(false)
    }
  }

  return <>
    <PageTitle eyebrow="RENCANA BULANAN" title="Budget" subtitle="Buat batas pengeluaran yang bisa dipilih saat mencatat transaksi." action={<div className="page-actions budget-actions"><span className="budget-period"><CalendarDays/>{month.label}</span><button className="primary-btn" onClick={() => setOpen(true)}><Plus/>Buat budget</button></div>}/>
    <section className="budget-explainer card" aria-label="Cara kerja budget"><strong>Cara kerja budget</strong><p>Berikan nama dan batas bulanan, lalu pilih budget saat mencatat pengeluaran. Pilihan Tanpa budget tidak mengurangi budget mana pun. Transaksi lama yang belum punya pilihan tetap dihitung seperti sebelumnya berdasarkan kategori. Budget hanya aktif selama {month.label}; bulan depan buat budget baru.</p></section>
    <section className="budget-hero card"><div><span>Total batas bulan ini</span><strong>{formatCurrency(total)}</strong><p><TrendingDown/> {budgets.length} budget aktif</p></div><div className="budget-hero-progress"><ProgressBar value={usage}/><p><span>Terpakai<strong>{formatCurrency(spent)}</strong></span><span>Tersisa<strong>{formatCurrency(total - spent)}</strong></span><b>{Math.round(usage)}%</b></p></div></section>
    {budgets.length > 0 && <section className="adaptive-banner"><div className="adaptive-icon"><Sparkles/></div><div><span>PANDUAN HARIAN</span><h2>Hari ini sekitar {formatCurrency(daily.availableToday)}</h2><p>Gabungan panduan harian dari budget aktifmu. Pengeluaran hari ini hanya menghitung transaksi yang masuk budget.</p></div><div><small>Pengeluaran hari ini</small><strong>{formatCurrency(todayExpense)}</strong><span>Sisa panduan hari ini {formatCurrency(daily.availableToday - todayExpense)}</span></div></section>}
    {budgets.length ? <div className="budget-page-grid">{budgets.map((budget) => <BudgetCard key={budget.id} budget={budget} onDelete={(item) => { setDeleting(item); setDeleteError('') }}/>)}</div> : <div className="card empty-state"><Sparkles/><h3>Belum ada budget bulan ini</h3><p>Buat budget untuk mulai memantau pengeluaran yang kamu pilih.</p></div>}
    <Modal open={open} onClose={() => setOpen(false)} title="Buat budget bulan ini" description="Isi nama, nominal, dan cara menghitung panduan harian."><BudgetForm onDone={() => setOpen(false)}/></Modal>
    <Modal open={!!deleting} onClose={() => !deletingBusy && setDeleting(null)} title={`Hapus budget ${deleting?.name || ''}?`} description="Budget ini akan dihapus dari bulan berjalan.">
      <div className="confirm-account-action"><p>Transaksi yang sudah dicatat tetap tersimpan. Budget yang dihapus tidak lagi dihitung dalam ringkasan.</p>{deleteError && <p className="form-feedback error" role="alert">{deleteError}</p>}<div className="form-actions"><button className="secondary-btn" onClick={() => setDeleting(null)} disabled={deletingBusy}>Batal</button><button className="danger-btn" onClick={confirmDelete} disabled={deletingBusy}>{deletingBusy ? 'Menghapus...' : 'Hapus budget'}</button></div></div>
    </Modal>
  </>
}
