import { useState } from 'react'
import { CalendarDays, ChevronDown, Plus, Sparkles, TrendingDown } from 'lucide-react'
import BudgetCard from '../../components/budgets/BudgetCard'
import BudgetForm from '../../components/forms/BudgetForm'
import Modal from '../../components/common/Modal'
import PageTitle from '../../components/common/PageTitle'
import ProgressBar from '../../components/common/ProgressBar'
import { useFinance } from '../../context/FinanceContext'
import { calculateAdaptiveBudget } from '../../utils/calculations'
import { formatCurrency } from '../../utils/formatters'

export default function BudgetsPage(){
 const [open,setOpen]=useState(false); const {budgets}=useFinance(); const total=budgets.reduce((s,b)=>s+b.amount,0);const spent=budgets.reduce((s,b)=>s+b.spent,0);const adaptive=calculateAdaptiveBudget({amount:total,spent,daysInPeriod:31,daysRemaining:27,method:'adaptive'})
 return <><PageTitle eyebrow="RENCANA BULANAN" title="Budget" subtitle="Jaga pengeluaran tetap terarah tanpa merasa dibatasi." action={<div className="page-actions"><button className="period-select"><CalendarDays/>Agustus 2026<ChevronDown/></button><button className="primary-btn" onClick={()=>setOpen(true)}><Plus/>Buat budget</button></div>}/>
 <section className="budget-hero card"><div><span>Budget bulan ini</span><strong>{formatCurrency(total)}</strong><p><TrendingDown/> Penggunaan 8% lebih rendah dari bulan lalu</p></div><div className="budget-hero-progress"><ProgressBar value={spent/total*100}/><p><span>Terpakai<strong>{formatCurrency(spent)}</strong></span><span>Tersisa<strong>{formatCurrency(total-spent)}</strong></span><b>{Math.round(spent/total*100)}%</b></p></div></section>
 <section className="adaptive-banner"><div className="adaptive-icon"><Sparkles/></div><div><span>BUDGET HARIAN ADAPTIF</span><h2>Hari ini kamu dapat menggunakan hingga {formatCurrency(adaptive.availableToday)}</h2><p>Target harian tetapmu {formatCurrency(adaptive.fixedDaily)}. Batas tersedia menyesuaikan sisa budget dan 27 hari tersisa—bukan target yang harus dihabiskan.</p></div><div><small>Pengeluaran hari ini</small><strong>Rp43.000</strong><span>Sisa hari ini {formatCurrency(adaptive.availableToday-43000)}</span></div></section>
 <div className="budget-page-grid">{budgets.map(budget=><BudgetCard key={budget.id} budget={budget}/>)}</div>
 <Modal open={open} onClose={()=>setOpen(false)} title="Buat budget baru" description="Pilih metode yang paling sesuai dengan cara kamu mengelola uang."><BudgetForm onDone={()=>setOpen(false)}/></Modal></>
}
