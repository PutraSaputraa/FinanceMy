import { useState } from 'react'
import { CalendarDays, ChevronDown, Plus, Sparkles, TrendingDown } from 'lucide-react'
import BudgetCard from '../../components/budgets/BudgetCard'
import BudgetForm from '../../components/forms/BudgetForm'
import Modal from '../../components/common/Modal'
import PageTitle from '../../components/common/PageTitle'
import ProgressBar from '../../components/common/ProgressBar'
import { useFinance } from '../../context/FinanceContext'
import { calculateAdaptiveBudget } from '../../utils/calculations'
import { getMonthInfo, getTodayExpense } from '../../utils/analytics'
import { formatCurrency } from '../../utils/formatters'

export default function BudgetsPage() {
  const [open, setOpen] = useState(false)
  const { budgets, transactions } = useFinance()
  const month = getMonthInfo()
  const total = budgets.reduce((sum, budget) => sum + Number(budget.amount || 0), 0)
  const spent = budgets.reduce((sum, budget) => sum + Number(budget.spent || 0), 0)
  const todayExpense = getTodayExpense(transactions)
  const usage = total ? (spent / total) * 100 : 0
  const adaptive = calculateAdaptiveBudget({ amount: total, spent, daysInPeriod: month.daysInMonth, daysRemaining: month.daysRemaining, method: 'adaptive' })

  return <>
    <PageTitle eyebrow="RENCANA BULANAN" title="Budget" subtitle="Jaga pengeluaran tetap terarah tanpa merasa dibatasi." action={<div className="page-actions"><button className="period-select"><CalendarDays/>{month.label}<ChevronDown/></button><button className="primary-btn" onClick={()=>setOpen(true)}><Plus/>Buat budget</button></div>}/>
    <section className="budget-hero card"><div><span>Budget bulan ini</span><strong>{formatCurrency(total)}</strong><p><TrendingDown/> Berdasarkan budget aktifmu</p></div><div className="budget-hero-progress"><ProgressBar value={usage}/><p><span>Terpakai<strong>{formatCurrency(spent)}</strong></span><span>Tersisa<strong>{formatCurrency(total-spent)}</strong></span><b>{Math.round(usage)}%</b></p></div></section>
    <section className="adaptive-banner"><div className="adaptive-icon"><Sparkles/></div><div><span>BUDGET HARIAN ADAPTIF</span><h2>Hari ini kamu dapat menggunakan hingga {formatCurrency(adaptive.availableToday)}</h2><p>Target harian tetapmu {formatCurrency(adaptive.fixedDaily)}. Batas tersedia menyesuaikan sisa budget dan {month.daysRemaining} hari tersisa—bukan target yang harus dihabiskan.</p></div><div><small>Pengeluaran hari ini</small><strong>{formatCurrency(todayExpense)}</strong><span>Sisa hari ini {formatCurrency(adaptive.availableToday-todayExpense)}</span></div></section>
    {budgets.length ? <div className="budget-page-grid">{budgets.map((budget)=><BudgetCard key={budget.id} budget={budget}/>)}</div> : <div className="card empty-state"><Sparkles/><h3>Belum ada budget</h3><p>Buat budget pertama untuk mengatur batas pengeluaranmu.</p></div>}
    <Modal open={open} onClose={()=>setOpen(false)} title="Buat budget baru" description="Pilih metode yang paling sesuai dengan cara kamu mengelola uang."><BudgetForm onDone={()=>setOpen(false)}/></Modal>
  </>
}
