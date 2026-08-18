import { useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, ChevronRight, CircleAlert, Eye, EyeOff, Lightbulb, MoreHorizontal, ReceiptText, Sparkles, TrendingDown, TrendingUp, WalletCards } from 'lucide-react'
import PageTitle from '../../components/common/PageTitle'
import AccountCard from '../../components/accounts/AccountCard'
import TransactionItem from '../../components/transactions/TransactionItem'
import ProgressBar from '../../components/common/ProgressBar'
import { useFinance } from '../../context/FinanceContext'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { calculateAdaptiveBudget, calculateCashFlow } from '../../utils/calculations'
import { buildCategoryData, buildMonthlyCashFlow, firstName, getGreeting, getMonthInfo, getPeriodSummary, getTodayExpense, percentageChange } from '../../utils/analytics'
import { formatCompact, formatCurrency, formatDate } from '../../utils/formatters'

function MetricCard({ label, value, change, icon: Icon, tone, note }) {
  return <article className={`metric-card ${tone}`}>
    <div className="metric-top"><span>{label}</span><i><Icon size={19}/></i></div>
    <strong>{value}</strong>
    <p className={change >= 0 ? 'positive' : 'negative'}>{change >= 0 ? <ArrowUpRight/> : <ArrowDownRight/>}{Math.abs(change)}% <span>{note}</span></p>
  </article>
}

const tooltipFormatter = (value) => formatCurrency(value)

export default function DashboardPage() {
  const { accounts, transactions, budgets, bills, payBill } = useFinance()
  const { user } = useAuth()
  const { hiddenAmounts, setHiddenAmounts } = useTheme()
  const navigate = useNavigate()
  const now = new Date()
  const month = getMonthInfo(now)
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const currentSummary = getPeriodSummary(transactions, now)
  const previousSummary = getPeriodSummary(transactions, previousMonth)
  const cashFlowData = buildMonthlyCashFlow(transactions, now)
  const categoryData = buildCategoryData(transactions, now)
  const activeAccounts = accounts.filter((account) => account.isActive !== false)
  const totalBalance = activeAccounts.reduce((sum, account) => sum + Number(account.currentBalance || 0), 0)
  const income = currentSummary.income
  const expense = currentSummary.expense
  const previousBalance = totalBalance - (income - expense)
  const totalBudget = budgets.reduce((sum, budget) => sum + Number(budget.amount || 0), 0)
  const budgetSpent = budgets.reduce((sum, budget) => sum + Number(budget.spent || 0), 0)
  const todayExpense = getTodayExpense(transactions, now)
  const dailyAverage = expense / Math.max(month.daysElapsed, 1)
  const obligations = bills
    .filter((bill) => !['Sudah dibayar', 'Lunas', 'Dibatalkan'].includes(bill.status))
    .reduce((sum, bill) => sum + Number(bill.amount || 0), 0)
  const adaptive = calculateAdaptiveBudget({ amount: totalBudget, spent: budgetSpent, daysInPeriod: month.daysInMonth, daysRemaining: month.daysRemaining, method: 'adaptive' })
  const forecast = calculateCashFlow({ balance: totalBalance, obligations, dailyAverage, days: month.daysRemaining })
  const amount = (value) => hiddenAmounts ? 'Rp ••••••••' : formatCurrency(value)
  const expensePercentage = totalBudget ? Math.round((budgetSpent / totalBudget) * 100) : 0
  const dailyRemaining = adaptive.availableToday - todayExpense
  const dailyRatio = adaptive.availableToday ? Math.max(Math.min(dailyRemaining / adaptive.availableToday, 1), 0) : 0
  const topCategory = categoryData[0]

  return <div className="dashboard-page">
    <PageTitle eyebrow={month.fullDate.toUpperCase()} title={`${getGreeting(now)}, ${firstName(user)} 👋`} subtitle="Ini ringkasan kondisi keuanganmu hari ini." action={<div className="period-select"><CalendarDays size={17}/><span>{month.label}</span><ChevronRight size={16}/></div>}/>

    <section className="metric-grid">
      <MetricCard label="Total saldo" value={amount(totalBalance)} change={percentageChange(totalBalance, previousBalance)} note="dari bulan lalu" icon={WalletCards} tone="blue"/>
      <MetricCard label="Pemasukan bulan ini" value={amount(income)} change={percentageChange(income, previousSummary.income)} note="dari bulan lalu" icon={TrendingUp} tone="green"/>
      <MetricCard label="Pengeluaran bulan ini" value={amount(expense)} change={-percentageChange(expense, previousSummary.expense)} note="dibanding bulan lalu" icon={TrendingDown} tone="red"/>
      <MetricCard label="Arus kas bersih" value={amount(income-expense)} change={percentageChange(income-expense, previousSummary.income-previousSummary.expense)} note="dari bulan lalu" icon={Sparkles} tone="purple"/>
    </section>

    <section className="dashboard-grid account-section">
      <article className="card span-8">
        <div className="section-head"><div><h2>Saldo akun</h2><p>Semua akun aktifmu</p></div><button className="icon-text" onClick={()=>setHiddenAmounts(!hiddenAmounts)}>{hiddenAmounts ? <Eye/> : <EyeOff/>}{hiddenAmounts ? 'Tampilkan' : 'Sembunyikan'} nominal</button></div>
        {activeAccounts.length ? <div className="account-grid">{activeAccounts.map((account)=><AccountCard key={account.id} account={account}/>)}</div> : <div className="empty-state"><WalletCards/><h3>Belum ada akun aktif</h3><p>Tambahkan atau aktifkan kembali akun untuk mulai mencatat.</p></div>}
        <button className="link-btn" onClick={()=>navigate('/akun')}>{accounts.length ? 'Lihat semua akun' : 'Tambah akun'} <ArrowRight/></button>
      </article>
      <article className="card span-4 daily-budget">
        <div className="section-head"><div><h2>Batas hari ini</h2><p>Budget harian adaptif</p></div><span className={`status-pill ${dailyRemaining < 0 ? 'danger' : 'success'}`}>{totalBudget ? dailyRemaining < 0 ? 'Terlewati' : 'Aman' : 'Belum diatur'}</span></div>
        <div className="daily-ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="43"/><circle className="value" cx="50" cy="50" r="43" style={{strokeDashoffset: `${270-(270*dailyRatio)}`}}/></svg><div><small>Tersisa</small><strong>{formatCurrency(dailyRemaining)}</strong><span>dari {formatCurrency(adaptive.availableToday)}</span></div></div>
        <div className="daily-stats"><span>Target tetap<strong>{formatCurrency(adaptive.fixedDaily)}</strong></span><span>Terpakai hari ini<strong>{formatCurrency(todayExpense)}</strong></span></div>
        <p className="daily-hint"><Sparkles/>{totalBudget ? <>Batas berdasarkan sisa budget untuk <strong>{month.daysRemaining} hari</strong> tersisa.</> : <>Buat budget agar batas harian dapat dihitung.</>}</p>
      </article>
    </section>

    <section className="dashboard-grid chart-section">
      <article className="card span-8 chart-card">
        <div className="section-head"><div><h2>Arus kas</h2><p>Pemasukan dan pengeluaran 6 bulan terakhir</p></div><button className="more-btn"><MoreHorizontal/></button></div>
        <div className="chart-legend"><span><i className="green"/>Pemasukan</span><span><i className="red"/>Pengeluaran</span></div>
        <ResponsiveContainer width="100%" height={260}><AreaChart data={cashFlowData} margin={{left:-20,right:8,top:10}}><defs><linearGradient id="income" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#099268" stopOpacity={.25}/><stop offset="100%" stopColor="#099268" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)"/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={formatCompact}/><Tooltip formatter={tooltipFormatter}/><Area type="monotone" dataKey="income" name="Pemasukan" stroke="#099268" strokeWidth={2.5} fill="url(#income)"/><Area type="monotone" dataKey="expense" name="Pengeluaran" stroke="#e05252" strokeWidth={2.5} fill="transparent"/></AreaChart></ResponsiveContainer>
      </article>
      <article className="card span-4 chart-card donut-card">
        <div className="section-head"><div><h2>Pengeluaran</h2><p>Berdasarkan kategori</p></div><button className="more-btn"><MoreHorizontal/></button></div>
        {categoryData.length ? <><div className="donut-wrap"><ResponsiveContainer width="100%" height={185}><PieChart><Pie data={categoryData} dataKey="value" innerRadius={58} outerRadius={78} paddingAngle={3}>{categoryData.map((item)=><Cell key={item.name} fill={item.color}/>)}</Pie><Tooltip formatter={(value)=>formatCurrency(value)}/></PieChart></ResponsiveContainer><div className="donut-center"><span>Total</span><strong>{formatCompact(categoryData.reduce((sum,item)=>sum+item.value,0))}</strong></div></div><div className="category-legend">{categoryData.map((item)=><span key={item.name}><i style={{background:item.color}}/>{item.name}<strong>{Math.round(item.value/categoryData.reduce((sum,entry)=>sum+entry.value,0)*100)}%</strong></span>)}</div></> : <div className="empty-state"><ReceiptText/><h3>Belum ada pengeluaran</h3><p>Grafik kategori akan muncul setelah transaksi dicatat.</p></div>}
      </article>
    </section>

    <section className="dashboard-grid planning-section">
      <article className="card span-7">
        <div className="section-head"><div><h2>Ringkasan budget</h2><p>{month.label}</p></div><button className="link-inline" onClick={()=>navigate('/budget')}>Kelola budget <ArrowRight/></button></div>
        <div className="budget-summary"><div><span>Total budget</span><strong>{formatCurrency(totalBudget)}</strong></div><div><span>Sudah digunakan</span><strong>{formatCurrency(budgetSpent)}</strong></div><div><span>Sisa budget</span><strong>{formatCurrency(totalBudget-budgetSpent)}</strong></div></div>
        <ProgressBar value={expensePercentage} label={`${formatCurrency(budgetSpent)} dari ${formatCurrency(totalBudget)}`}/>
        <div className="mini-budget-list">{budgets.slice(0,3).map((budget)=>{const usage=budget.amount?budget.spent/budget.amount*100:0;return <div key={budget.id}><span className="budget-dot" style={{background:budget.color}}/><strong>{budget.name}</strong><div className="mini-progress"><i style={{width:`${Math.min(usage,100)}%`,background:budget.color}}/></div><span>{Math.round(usage)}%</span></div>})}</div>
      </article>
      <article className="card span-5 forecast-card">
        <div className="section-head"><div><h2>Sampai akhir bulan</h2><p>{month.daysRemaining} hari tersisa</p></div><span className="estimate-pill">ESTIMASI</span></div>
        <div className="forecast-balance"><small>Perkiraan saldo tersisa</small><strong>{formatCurrency(forecast.projectedBalance)}</strong><span className={forecast.projectedBalance >= 0 ? '' : 'negative'}><TrendingUp/> {forecast.projectedBalance >= 0 ? 'Masih dalam batas aman' : 'Perlu perhatian'}</span></div>
        <div className="forecast-flow"><div><i className="in"/><span>Saldo saat ini<small>{formatCurrency(totalBalance)}</small></span></div><div><i className="out"/><span>Kewajiban mendatang<small>−{formatCurrency(obligations)}</small></span></div><div><i className="daily"/><span>Estimasi pengeluaran<small>−{formatCurrency(forecast.dailyEstimate)}</small></span></div></div>
        <p><CircleAlert/>Perhitungan menggunakan rata-rata pengeluaran bulan berjalan.</p>
      </article>
    </section>

    <section className="dashboard-grid bottom-section">
      <article className="card span-7">
        <div className="section-head"><div><h2>Transaksi terbaru</h2><p>Aktivitas keuangan terakhir</p></div><button className="link-inline" onClick={()=>navigate('/transaksi')}>Lihat semua <ArrowRight/></button></div>
        {transactions.length ? <div className="transaction-list">{transactions.slice(0,5).map((transaction)=><TransactionItem key={transaction.id} transaction={transaction}/>)}</div> : <div className="empty-state"><ReceiptText/><h3>Belum ada transaksi</h3><p>Tambahkan transaksi pertama untuk melihat aktivitasmu.</p></div>}
      </article>
      <div className="span-5 side-stack">
        <article className="card"><div className="section-head"><div><h2>Tagihan terdekat</h2><p>Jangan sampai terlewat</p></div><ReceiptText size={20}/></div>{bills.length ? <div className="bill-list">{bills.slice(0,5).map((bill)=><div key={bill.id}><span className={`date-box ${bill.tone || 'neutral'}`}><strong>{bill.date ? formatDate(bill.date,'d') : '–'}</strong><small>{bill.date ? formatDate(bill.date,'MMM') : ''}</small></span><span><strong>{bill.title}</strong><small>{bill.account} • {formatCurrency(bill.amount)}</small></span>{['Sudah dibayar', 'Lunas'].includes(bill.status) ? <em className="paid">Lunas</em> : <button onClick={()=>payBill(bill.id)}>Bayar</button>}</div>)}</div> : <div className="empty-state"><CalendarDays/><h3>Belum ada tagihan</h3><p>Tagihan mendatang akan tampil di sini.</p></div>}</article>
        <article className="card insight-card"><div className="insight-title"><span><Lightbulb/></span><div><small>INSIGHT BULAN INI</small><h2>{topCategory ? `${topCategory.name} paling besar` : 'Belum ada insight'}</h2></div></div><p>{topCategory ? <>Pengeluaran terbesar bulan ini adalah <strong>{topCategory.name}</strong> sebesar <strong>{formatCurrency(topCategory.value)}</strong>.</> : <>Catat pengeluaran agar FinanceMy dapat menghitung insight berdasarkan datamu.</>}</p><button onClick={()=>navigate('/laporan')}>Lihat laporan <ArrowRight/></button></article>
      </div>
    </section>
  </div>
}
