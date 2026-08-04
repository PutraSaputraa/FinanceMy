import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, CircleAlert, Eye, EyeOff, Lightbulb, MoreHorizontal, ReceiptText, Sparkles, TrendingDown, TrendingUp, WalletCards } from 'lucide-react'
import PageTitle from '../../components/common/PageTitle'
import AccountCard from '../../components/accounts/AccountCard'
import TransactionItem from '../../components/transactions/TransactionItem'
import ProgressBar from '../../components/common/ProgressBar'
import { useFinance } from '../../context/FinanceContext'
import { useTheme } from '../../context/ThemeContext'
import { cashFlowData, categoryData } from '../../constants/demoData'
import { calculateAdaptiveBudget, calculateCashFlow } from '../../utils/calculations'
import { formatCompact, formatCurrency, formatDate } from '../../utils/formatters'

function MetricCard({ label, value, change, icon: Icon, tone, note }) {
  return <article className={`metric-card ${tone}`}><div className="metric-top"><span>{label}</span><i><Icon size={19}/></i></div><strong>{value}</strong><p className={change >= 0 ? 'positive' : 'negative'}>{change >= 0 ? <ArrowUpRight/> : <ArrowDownRight/>}{Math.abs(change)}% <span>{note}</span></p></article>
}

const tooltipFormatter = (value) => `${formatCompact(value * 1000)}`

export default function DashboardPage() {
  const { accounts, transactions, budgets, bills, payBill } = useFinance()
  const { hiddenAmounts, setHiddenAmounts } = useTheme()
  const navigate = useNavigate()
  const totalBalance = accounts.filter((a) => a.isActive).reduce((sum, account) => sum + account.currentBalance, 0)
  const income = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0)
  const expense = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
  const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0)
  const budgetSpent = budgets.reduce((sum, budget) => sum + budget.spent, 0)
  const adaptive = calculateAdaptiveBudget({ amount: totalBudget, spent: budgetSpent, daysInPeriod: 31, daysRemaining: 27, method: 'adaptive' })
  const forecast = calculateCashFlow({ balance: totalBalance, scheduledIncome: 0, obligations: 961000, dailyAverage: 82500, days: 19 })
  const amount = (value) => hiddenAmounts ? 'Rp ••••••••' : formatCurrency(value)
  const expensePercentage = Math.round((budgetSpent / totalBudget) * 100)

  return <div className="dashboard-page">
    <PageTitle eyebrow="SELASA, 4 AGUSTUS 2026" title="Selamat pagi, Raka 👋" subtitle="Ini ringkasan kondisi keuanganmu hari ini." action={<div className="period-select"><CalendarDays size={17}/><span>Agustus 2026</span><ChevronRight size={16}/></div>}/>

    <section className="metric-grid">
      <MetricCard label="Total saldo" value={amount(totalBalance)} change={6.2} note="dari bulan lalu" icon={WalletCards} tone="blue"/>
      <MetricCard label="Pemasukan bulan ini" value={amount(income)} change={4.8} note="dari bulan lalu" icon={TrendingUp} tone="green"/>
      <MetricCard label="Pengeluaran bulan ini" value={amount(expense)} change={-8.4} note="lebih rendah" icon={TrendingDown} tone="red"/>
      <MetricCard label="Arus kas bersih" value={amount(income-expense)} change={12.5} note="lebih baik" icon={Sparkles} tone="purple"/>
    </section>

    <section className="dashboard-grid account-section">
      <article className="card span-8"><div className="section-head"><div><h2>Saldo akun</h2><p>Semua akun aktifmu</p></div><button className="icon-text" onClick={()=>setHiddenAmounts(!hiddenAmounts)}>{hiddenAmounts ? <Eye/> : <EyeOff/>}{hiddenAmounts ? 'Tampilkan' : 'Sembunyikan'} nominal</button></div><div className="account-grid">{accounts.map((account)=><AccountCard key={account.id} account={account}/>)}</div><button className="link-btn" onClick={()=>navigate('/akun')}>Lihat semua akun <ArrowRight/></button></article>
      <article className="card span-4 daily-budget"><div className="section-head"><div><h2>Batas hari ini</h2><p>Budget harian adaptif</p></div><span className="status-pill success">Aman</span></div><div className="daily-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="43"/><circle className="value" cx="50" cy="50" r="43" style={{strokeDashoffset: `${270-(270*0.38)}`}}/></svg><div><small>Tersisa</small><strong>{formatCurrency(adaptive.availableToday - 43000)}</strong><span>dari {formatCurrency(adaptive.availableToday)}</span></div></div><div className="daily-stats"><span>Target tetap<strong>{formatCurrency(adaptive.fixedDaily)}</strong></span><span>Terpakai hari ini<strong>Rp43.000</strong></span></div><p className="daily-hint"><Sparkles/>Jika pola ini berlanjut, batas besok menjadi <strong>{formatCurrency(adaptive.nextDaily)}</strong>.</p></article>
    </section>

    <section className="dashboard-grid chart-section">
      <article className="card span-8 chart-card"><div className="section-head"><div><h2>Arus kas</h2><p>Pemasukan dan pengeluaran 6 bulan terakhir</p></div><button className="more-btn"><MoreHorizontal/></button></div><div className="chart-legend"><span><i className="green"/>Pemasukan</span><span><i className="red"/>Pengeluaran</span></div><ResponsiveContainer width="100%" height={260}><AreaChart data={cashFlowData} margin={{left:-20,right:8,top:10}}><defs><linearGradient id="income" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#099268" stopOpacity={.25}/><stop offset="100%" stopColor="#099268" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)"/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={(v)=>`${v/1000}jt`}/><Tooltip formatter={tooltipFormatter}/><Area type="monotone" dataKey="income" name="Pemasukan" stroke="#099268" strokeWidth={2.5} fill="url(#income)"/><Area type="monotone" dataKey="expense" name="Pengeluaran" stroke="#e05252" strokeWidth={2.5} fill="transparent"/></AreaChart></ResponsiveContainer></article>
      <article className="card span-4 chart-card donut-card"><div className="section-head"><div><h2>Pengeluaran</h2><p>Berdasarkan kategori</p></div><button className="more-btn"><MoreHorizontal/></button></div><div className="donut-wrap"><ResponsiveContainer width="100%" height={185}><PieChart><Pie data={categoryData} dataKey="value" innerRadius={58} outerRadius={78} paddingAngle={3}>{categoryData.map((item)=><Cell key={item.name} fill={item.color}/>)}</Pie><Tooltip formatter={(v)=>formatCurrency(v)}/></PieChart></ResponsiveContainer><div className="donut-center"><span>Total</span><strong>{formatCompact(categoryData.reduce((s,x)=>s+x.value,0))}</strong></div></div><div className="category-legend">{categoryData.map((item)=><span key={item.name}><i style={{background:item.color}}/>{item.name}<strong>{Math.round(item.value/categoryData.reduce((s,x)=>s+x.value,0)*100)}%</strong></span>)}</div></article>
    </section>

    <section className="dashboard-grid planning-section">
      <article className="card span-7"><div className="section-head"><div><h2>Ringkasan budget</h2><p>Agustus 2026</p></div><button className="link-inline" onClick={()=>navigate('/budget')}>Kelola budget <ArrowRight/></button></div><div className="budget-summary"><div><span>Total budget</span><strong>{formatCurrency(totalBudget)}</strong></div><div><span>Sudah digunakan</span><strong>{formatCurrency(budgetSpent)}</strong></div><div><span>Sisa budget</span><strong>{formatCurrency(totalBudget-budgetSpent)}</strong></div></div><ProgressBar value={expensePercentage} label={`${formatCurrency(budgetSpent)} dari ${formatCurrency(totalBudget)}`}/><div className="mini-budget-list">{budgets.slice(0,3).map((budget)=><div key={budget.id}><span className="budget-dot" style={{background:budget.color}}/><strong>{budget.name}</strong><div className="mini-progress"><i style={{width:`${Math.min(budget.spent/budget.amount*100,100)}%`,background:budget.color}}/></div><span>{Math.round(budget.spent/budget.amount*100)}%</span></div>)}</div></article>
      <article className="card span-5 forecast-card"><div className="section-head"><div><h2>Sampai gajian berikutnya</h2><p>19 hari lagi • 23 Agustus</p></div><span className="estimate-pill">ESTIMASI</span></div><div className="forecast-balance"><small>Perkiraan saldo tersisa</small><strong>{formatCurrency(forecast.projectedBalance)}</strong><span><TrendingUp/> Masih dalam batas aman</span></div><div className="forecast-flow"><div><i className="in"/><span>Saldo saat ini<small>{formatCurrency(totalBalance)}</small></span></div><div><i className="out"/><span>Kewajiban mendatang<small>−Rp961.000</small></span></div><div><i className="daily"/><span>Estimasi harian<small>−{formatCurrency(forecast.dailyEstimate)}</small></span></div></div><p><CircleAlert/>Perhitungan menggunakan rata-rata pengeluaran 30 hari terakhir.</p></article>
    </section>

    <section className="dashboard-grid bottom-section">
      <article className="card span-7"><div className="section-head"><div><h2>Transaksi terbaru</h2><p>Aktivitas keuangan terakhir</p></div><button className="link-inline" onClick={()=>navigate('/transaksi')}>Lihat semua <ArrowRight/></button></div><div className="transaction-list">{transactions.slice(0,5).map((transaction)=><TransactionItem key={transaction.id} transaction={transaction}/>)}</div></article>
      <div className="span-5 side-stack"><article className="card"><div className="section-head"><div><h2>Tagihan terdekat</h2><p>Jangan sampai terlewat</p></div><ReceiptText size={20}/></div><div className="bill-list">{bills.map((bill)=><div key={bill.id}><span className={`date-box ${bill.tone}`}><strong>{formatDate(bill.date,'d')}</strong><small>{formatDate(bill.date,'MMM')}</small></span><span><strong>{bill.title}</strong><small>{bill.account} • {formatCurrency(bill.amount)}</small></span>{bill.status === 'Sudah dibayar' ? <em className="paid">Lunas</em> : <button onClick={()=>payBill(bill.id)}>Bayar</button>}</div>)}</div></article>
        <article className="card insight-card"><div className="insight-title"><span><Lightbulb/></span><div><small>INSIGHT MINGGU INI</small><h2>Lebih hemat 12%</h2></div></div><p>Pengeluaran harianmu rata-rata <strong>Rp82.500</strong>, turun <strong>Rp11.200</strong> dibanding minggu lalu.</p><button>Lihat semua insight <ArrowRight/></button></article></div>
    </section>
  </div>
}
