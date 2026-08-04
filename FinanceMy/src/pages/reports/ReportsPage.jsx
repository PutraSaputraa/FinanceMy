import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays, ChevronDown, Download, Info, ReceiptText, TrendingDown, TrendingUp } from 'lucide-react'
import PageTitle from '../../components/common/PageTitle'
import ProgressBar from '../../components/common/ProgressBar'
import { useFinance } from '../../context/FinanceContext'
import { buildCategoryData, buildMonthlyCashFlow, getMonthInfo, getPeriodSummary, percentageChange } from '../../utils/analytics'
import { formatCompact, formatCurrency } from '../../utils/formatters'

export default function ReportsPage() {
  const { accounts, transactions, bills } = useFinance()
  const now = new Date()
  const month = getMonthInfo(now)
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const current = getPeriodSummary(transactions, now)
  const previous = getPeriodSummary(transactions, previousMonth)
  const cashFlowData = buildMonthlyCashFlow(transactions, now)
  const categoryData = buildCategoryData(transactions, now)
  const totalIncome = cashFlowData.reduce((sum, item) => sum + item.income, 0)
  const totalExpense = cashFlowData.reduce((sum, item) => sum + item.expense, 0)
  const totalSaved = totalIncome - totalExpense
  const averageDaily = current.expense / Math.max(month.daysElapsed, 1)
  const savingRatio = totalIncome ? Math.max((totalSaved / totalIncome) * 100, 0) : 0
  const expenseRatio = totalIncome ? (totalExpense / totalIncome) * 100 : 0
  const totalBalance = accounts.filter((account) => account.isActive).reduce((sum, account) => sum + Number(account.currentBalance || 0), 0)
  const emergencyMonths = averageDaily ? totalBalance / (averageDaily * 30) : 0
  const lateBills = bills.filter((bill) => ['Terlambat', 'Belum dibayar'].includes(bill.status)).length
  const hasData = transactions.length > 0
  const healthLabel = !hasData ? 'Belum cukup data' : savingRatio >= 20 && lateBills === 0 ? 'Baik' : savingRatio >= 10 ? 'Cukup' : 'Perlu perhatian'

  return <>
    <PageTitle eyebrow="ANALISIS KEUANGAN" title="Laporan" subtitle="Lihat pola, bandingkan periode, dan pahami kebiasaanmu." action={<div className="page-actions"><button className="period-select"><CalendarDays/>6 bulan terakhir<ChevronDown/></button><button className="secondary-btn"><Download/>Ekspor</button></div>}/>
    <section className="report-metrics">
      <article><span>Total pemasukan</span><strong>{formatCurrency(totalIncome)}</strong><p className={percentageChange(current.income, previous.income) >= 0 ? 'positive' : 'negative'}><TrendingUp/> {Math.abs(percentageChange(current.income, previous.income))}% dari bulan lalu</p></article>
      <article><span>Total pengeluaran</span><strong>{formatCurrency(totalExpense)}</strong><p className={percentageChange(current.expense, previous.expense) <= 0 ? 'positive' : 'negative'}><TrendingDown/> {Math.abs(percentageChange(current.expense, previous.expense))}% dari bulan lalu</p></article>
      <article><span>Total tersimpan</span><strong>{formatCurrency(totalSaved)}</strong><p className={totalSaved >= 0 ? 'positive' : 'negative'}><TrendingUp/> Rasio tabungan {savingRatio.toFixed(1)}%</p></article>
      <article><span>Rata-rata harian</span><strong>{formatCurrency(averageDaily)}</strong><p><Info/> Berdasarkan {month.daysElapsed} hari bulan ini</p></article>
    </section>
    <div className="reports-grid">
      <article className="card report-wide"><div className="section-head"><div><h2>Pemasukan vs pengeluaran</h2><p>Enam bulan terakhir</p></div></div><ResponsiveContainer width="100%" height={300}><BarChart data={cashFlowData}><CartesianGrid vertical={false} stroke="var(--line)"/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={formatCompact}/><Tooltip formatter={(value)=>formatCurrency(value)}/><Bar dataKey="income" name="Pemasukan" fill="#099268" radius={[5,5,0,0]}/><Bar dataKey="expense" name="Pengeluaran" fill="#e05252" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></article>
      <article className="card"><div className="section-head"><div><h2>Pengeluaran per kategori</h2><p>{month.label}</p></div></div>{categoryData.length ? <><ResponsiveContainer width="100%" height={215}><PieChart><Pie data={categoryData} dataKey="value" innerRadius={55} outerRadius={82}>{categoryData.map((item)=><Cell key={item.name} fill={item.color}/>)}</Pie><Tooltip formatter={(value)=>formatCurrency(value)}/></PieChart></ResponsiveContainer><div className="category-legend report">{categoryData.map((item)=><span key={item.name}><i style={{background:item.color}}/>{item.name}<strong>{formatCurrency(item.value)}</strong></span>)}</div></> : <div className="empty-state"><ReceiptText/><h3>Belum ada pengeluaran</h3><p>Data kategori akan muncul setelah transaksi dicatat.</p></div>}</article>
      <article className="card report-wide"><div className="section-head"><div><h2>Perubahan arus kas</h2><p>Akumulasi pemasukan dikurangi pengeluaran</p></div></div><ResponsiveContainer width="100%" height={250}><LineChart data={cashFlowData}><CartesianGrid vertical={false} stroke="var(--line)"/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={formatCompact}/><Tooltip formatter={(value)=>formatCurrency(value)}/><Line type="monotone" dataKey="balance" name="Arus kas bersih" stroke="#2271b3" strokeWidth={3} dot={{fill:'#2271b3',r:4}}/></LineChart></ResponsiveContainer></article>
      <article className="card health-card"><div className="section-head"><div><h2>Kesehatan keuangan</h2><p>Komponen transparan, bukan skor misterius</p></div><em>{healthLabel}</em></div><div className="health-list"><span>Rasio tabungan<strong>{savingRatio.toFixed(1)}%</strong><ProgressBar value={Math.min(savingRatio,100)}/></span><span>Pengeluaran / pemasukan<strong>{expenseRatio.toFixed(1)}%</strong><ProgressBar value={Math.min(expenseRatio,100)} color="#2271b3"/></span><span>Dana tersedia<strong>{emergencyMonths.toFixed(1)} bulan</strong><ProgressBar value={Math.min((emergencyMonths/6)*100,100)} color="#e08a17"/></span><span>Tagihan terlambat<strong>{lateBills}</strong><ProgressBar value={lateBills ? 0 : 100}/></span></div><p><Info/>Ringkasan ini dihitung dari data pengguna dan bukan penilaian finansial profesional.</p></article>
    </div>
  </>
}
